const express = require('express');
const DocumentType = require('../models/DocumentType');
const CarCategory = require('../models/CarCategory');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const File = require('../models/File');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/fileSize');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// ── Slug utility ──────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')      // keep alphanumeric, spaces, hyphens
    .replace(/\s+/g, '-')              // spaces → hyphens
    .replace(/-+/g, '-')               // collapse consecutive hyphens
    .replace(/^-|-$/g, '');            // trim edge hyphens
}

// ── Pricing validation ────────────────────────────────────────────────────────
/**
 * Returns a 400-ready { error } object if the pricing block violates the
 * hasTranslation rule, or null if everything is valid.
 */
function validatePricing(hasTranslation, pricing) {
  const ht = Boolean(hasTranslation);

  if (ht) {
    const op = pricing?.originalPlusTranslation;
    const to = pricing?.translationOnly;
    if (
      op?.clientPrice == null || op?.costPrice == null ||
      to?.clientPrice == null || to?.costPrice == null
    ) {
      return {
        error:
          'hasTranslation is true: both originalPlusTranslation and translationOnly ' +
          'prices (clientPrice + costPrice) are required.',
      };
    }
  } else {
    if (pricing?.originalPlusTranslation !== undefined || pricing?.translationOnly !== undefined) {
      return {
        error:
          'hasTranslation is false: do not include originalPlusTranslation or ' +
          'translationOnly pricing — they are not applicable.',
      };
    }
  }
  return null;
}

// ── POST /api/document-types ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, shortName, fullName, description, code, category, originLanguage,
      hasTranslation, pricing, defaultSource, estimatedTurnaroundDays,
      sortOrder, slug, translations,
    } = req.body;

    const resolvedName = (name || shortName || '').trim();
    const resolvedFullName = (fullName || resolvedName).trim();

    if (!resolvedName || !defaultSource) {
      return res.status(400).json({ error: 'Document name and defaultSource are required.' });
    }
    if (!['local', 'china', 'mixed'].includes(defaultSource)) {
      return res.status(400).json({ error: 'defaultSource must be "local", "china", or "mixed".' });
    }
    if (pricing?.originalOnly?.clientPrice == null || pricing?.originalOnly?.costPrice == null) {
      return res.status(400).json({ error: 'pricing.originalOnly (clientPrice + costPrice) is required.' });
    }

    // Pricing validation vs. hasTranslation
    const pricingError = validatePricing(hasTranslation, pricing);
    if (pricingError) return res.status(400).json(pricingError);

    // Slug: auto-generate from name if omitted
    let finalSlug = slug?.trim().toLowerCase();
    if (!finalSlug) finalSlug = slugify(resolvedName);
    if (!finalSlug) finalSlug = 'doc-' + Date.now();

    // Check if slug is taken; if user explicitly provided it and collision occurs, report 409
    const slugConflict = await DocumentType.findOne({ slug: finalSlug });
    if (slugConflict) {
      if (slug) {
        return res.status(409).json({ error: `Slug "${finalSlug}" is already in use.` });
      }
      // Auto-append timestamp for auto-generated slug so it never collides
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Build document
    const docData = {
      shortName: resolvedName,
      fullName: resolvedFullName,
      description: description?.trim() || '',
      category: category?.trim() || '',
      originLanguage: originLanguage?.trim() || '',
      hasTranslation: Boolean(hasTranslation),
      defaultSource,
      sortOrder: sortOrder ?? 0,
      slug: finalSlug,
      pricing: {
        originalOnly: {
          clientPrice: pricing.originalOnly.clientPrice,
          costPrice: pricing.originalOnly.costPrice,
        },
      },
    };

    // Code: only set if a non-empty value was actually provided
    const trimmedCode = code?.toString().trim();
    if (trimmedCode) docData.code = trimmedCode.toUpperCase();

    // Translation pricing
    if (Boolean(hasTranslation)) {
      docData.pricing.originalPlusTranslation = {
        clientPrice: pricing.originalPlusTranslation.clientPrice,
        costPrice: pricing.originalPlusTranslation.costPrice,
      };
      docData.pricing.translationOnly = {
        clientPrice: pricing.translationOnly.clientPrice,
        costPrice: pricing.translationOnly.costPrice,
      };
    }

    if (estimatedTurnaroundDays != null) {
      docData.estimatedTurnaroundDays = Number(estimatedTurnaroundDays);
    }

    if (translations && typeof translations === 'object') {
      docData.translations = {
        fr: {
          fullName: translations.fr?.fullName?.trim() || '',
          description: translations.fr?.description?.trim() || '',
          category: translations.fr?.category?.trim() || '',
        },
        ar: {
          fullName: translations.ar?.fullName?.trim() || '',
          description: translations.ar?.description?.trim() || '',
          category: translations.ar?.category?.trim() || '',
        },
      };
    }

    const doc = await DocumentType.create(docData);
    return res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `Duplicate value for ${field}.` });
    }
    console.error('[POST /api/document-types]', err);
    return res.status(500).json({ error: 'Server error creating document type.' });
  }
});

// ── GET /api/document-types ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const docs = await DocumentType.find().sort({ sortOrder: 1, shortName: 1 });
    return res.json(docs);
  } catch (err) {
    console.error('[GET /api/document-types]', err);
    return res.status(500).json({ error: 'Server error fetching document types.' });
  }
});

// ── GET /api/document-types/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const doc = await DocumentType.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document type not found.' });
    return res.json(doc);
  } catch (err) {
    console.error('[GET /api/document-types/:id]', err);
    return res.status(500).json({ error: 'Server error fetching document type.' });
  }
});

// ── PATCH /api/document-types/:id ────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const doc = await DocumentType.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document type not found.' });

    const {
      shortName, fullName, description, code, category, originLanguage,
      hasTranslation, pricing, defaultSource, estimatedTurnaroundDays,
      sortOrder, slug, active, translations,
    } = req.body;

    const updates = {};

    // ── Code immutability ────────────────────────────────────────────────────
    if (code !== undefined) {
      const incomingCode = code?.toString().trim().toUpperCase() || '';
      if (doc.code) {
        // Code already set — only allow sending the same value (no-op) or empty (reject)
        if (!incomingCode) {
          return res.status(400).json({
            error: 'Document code is immutable once set. It cannot be removed or changed.',
          });
        }
        if (incomingCode !== doc.code) {
          return res.status(400).json({
            error: `Document code is immutable once set. Current code: "${doc.code}".`,
          });
        }
        // Same value — no-op, don't add to updates
      } else if (incomingCode) {
        // No existing code — allow setting for the first time
        updates.code = incomingCode;
      }
      // If no existing code and incoming is empty → do nothing (leave absent)
    }

    // ── Slug ─────────────────────────────────────────────────────────────────
    if (slug !== undefined) {
      const newSlug = slug.trim().toLowerCase();
      if (newSlug && newSlug !== doc.slug) {
        const conflict = await DocumentType.findOne({ slug: newSlug, _id: { $ne: doc._id } });
        if (conflict) {
          return res.status(409).json({ error: `Slug "${newSlug}" is already in use.` });
        }
        updates.slug = newSlug;
      }
    }

    // ── hasTranslation + pricing ──────────────────────────────────────────────
    const effectiveHasTranslation = hasTranslation !== undefined
      ? Boolean(hasTranslation)
      : doc.hasTranslation;

    if (pricing !== undefined || hasTranslation !== undefined) {
      if (!effectiveHasTranslation) {
        if (pricing?.originalPlusTranslation !== undefined || pricing?.translationOnly !== undefined) {
          return res.status(400).json({
            error: 'hasTranslation is false: do not include originalPlusTranslation or translationOnly pricing — they are not applicable.',
          });
        }
        if (hasTranslation === false) {
          updates['pricing.originalPlusTranslation'] = { clientPrice: null, costPrice: null };
          updates['pricing.translationOnly'] = { clientPrice: null, costPrice: null };
        }
      } else {
        const mergedOp = pricing?.originalPlusTranslation ?? doc.pricing?.originalPlusTranslation;
        const mergedTo = pricing?.translationOnly ?? doc.pricing?.translationOnly;
        if (
          mergedOp?.clientPrice == null || mergedOp?.costPrice == null ||
          mergedTo?.clientPrice == null || mergedTo?.costPrice == null
        ) {
          return res.status(400).json({
            error: 'hasTranslation is true: both originalPlusTranslation and translationOnly prices (clientPrice + costPrice) are required.',
          });
        }
        if (pricing?.originalPlusTranslation) {
          updates['pricing.originalPlusTranslation'] = pricing.originalPlusTranslation;
        }
        if (pricing?.translationOnly) {
          updates['pricing.translationOnly'] = pricing.translationOnly;
        }
      }

      if (pricing?.originalOnly) {
        updates['pricing.originalOnly'] = {
          clientPrice: pricing.originalOnly.clientPrice ?? doc.pricing?.originalOnly?.clientPrice,
          costPrice: pricing.originalOnly.costPrice ?? doc.pricing?.originalOnly?.costPrice,
        };
      }
    }

    // ── Scalar fields ─────────────────────────────────────────────────────────
    if (req.body.name !== undefined) {
      updates.shortName = req.body.name.trim();
      if (!doc.fullName || doc.fullName === doc.shortName) {
        updates.fullName = req.body.name.trim();
      }
    }
    if (shortName !== undefined) updates.shortName = shortName.trim();
    if (fullName !== undefined) updates.fullName = fullName.trim();
    if (description !== undefined) updates.description = description.trim();
    if (category !== undefined) updates.category = category.trim();
    if (originLanguage !== undefined) updates.originLanguage = originLanguage.trim();
    if (hasTranslation !== undefined) updates.hasTranslation = Boolean(hasTranslation);
    if (defaultSource !== undefined) {
      if (!['local', 'china', 'mixed'].includes(defaultSource)) {
        return res.status(400).json({ error: 'defaultSource must be "local", "china", or "mixed".' });
      }
      updates.defaultSource = defaultSource;
    }
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
    if (active !== undefined) updates.active = Boolean(active);
    if (estimatedTurnaroundDays !== undefined) {
      updates.estimatedTurnaroundDays = estimatedTurnaroundDays === null
        ? null
        : Number(estimatedTurnaroundDays);
    }
    if (translations !== undefined && typeof translations === 'object') {
      updates.translations = {
        fr: {
          fullName: translations?.fr?.fullName !== undefined ? translations.fr.fullName.trim() : (doc.translations?.fr?.fullName || ''),
          description: translations?.fr?.description !== undefined ? translations.fr.description.trim() : (doc.translations?.fr?.description || ''),
          category: translations?.fr?.category !== undefined ? translations.fr.category.trim() : (doc.translations?.fr?.category || ''),
        },
        ar: {
          fullName: translations?.ar?.fullName !== undefined ? translations.ar.fullName.trim() : (doc.translations?.ar?.fullName || ''),
          description: translations?.ar?.description !== undefined ? translations.ar.description.trim() : (doc.translations?.ar?.description || ''),
          category: translations?.ar?.category !== undefined ? translations.ar.category.trim() : (doc.translations?.ar?.category || ''),
        },
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const updated = await DocumentType.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    return res.json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate value — code or slug already in use.' });
    }
    console.error('[PATCH /api/document-types/:id]', err);
    return res.status(500).json({ error: 'Server error updating document type.' });
  }
});

// ── POST /api/document-types/:id/example-image ───────────────────────────────
router.post(
  '/:id/example-image',
  ...uploadSingle('file'),
  async (req, res) => {
    try {
      const doc = await DocumentType.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document type not found.' });

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Send a file in the "file" field.' });
      }

      const fileRecord = await File.create({
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size,
        uploadedByUserId: req.user._id,
      });

      await DocumentType.findByIdAndUpdate(req.params.id, {
        $set: { exampleImageFileId: fileRecord._id },
      });

      return res.status(201).json({
        fileId: fileRecord._id,
        filename: fileRecord.filename,
        size: fileRecord.size,
        contentType: fileRecord.contentType,
      });
    } catch (err) {
      console.error('[POST /api/document-types/:id/example-image]', err);
      return res.status(500).json({ error: 'Server error uploading example image.' });
    }
  }
);

// ── DELETE /api/document-types/:id (Soft-delete / Move to History) ─────────
router.delete('/:id', async (req, res) => {
  try {
    const doc = await DocumentType.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Document type not found.' });
    return res.json({ message: 'Document moved to history.', doc });
  } catch (err) {
    console.error('[DELETE /api/document-types/:id]', err);
    return res.status(500).json({ error: 'Server error moving document type to history.' });
  }
});

// ── PATCH /api/document-types/:id/restore (Restore from History) ───────────
router.patch('/:id/restore', async (req, res) => {
  try {
    const doc = await DocumentType.findByIdAndUpdate(
      req.params.id,
      { $set: { active: true } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Document type not found.' });
    return res.json({ message: 'Document restored.', doc });
  } catch (err) {
    console.error('[PATCH /api/document-types/:id/restore]', err);
    return res.status(500).json({ error: 'Server error restoring document type.' });
  }
});

// ── DELETE /api/document-types/:id/permanent (Permanent Delete) ─────────────
router.delete('/:id/permanent', async (req, res) => {
  try {
    const doc = await DocumentType.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document type not found.' });

    // Gate against existing order references (Phase 3+ prevention)
    const orderRefCount = await OrderDocumentLine.countDocuments({ documentTypeId: doc._id });
    if (orderRefCount > 0) {
      return res.status(409).json({
        error: `Cannot permanently delete: ${orderRefCount} order(s) reference this document type. Keep it in History / Archive instead.`,
        orderRefCount,
      });
    }

    // Clean up reference in CarCategory if any
    await CarCategory.updateMany(
      { requiredDocumentTypes: doc._id },
      { $pull: { requiredDocumentTypes: doc._id } }
    );

    // Clean up example image file if exists
    if (doc.exampleImageFileId) {
      await File.findByIdAndDelete(doc.exampleImageFileId).catch(() => {});
    }

    await DocumentType.findByIdAndDelete(doc._id);
    return res.json({ message: 'Document permanently deleted.', id: doc._id });
  } catch (err) {
    console.error('[DELETE /api/document-types/:id/permanent]', err);
    return res.status(500).json({ error: 'Server error permanently deleting document type.' });
  }
});

module.exports = router;

