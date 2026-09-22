const express = require('express');
const mongoose = require('mongoose');
const CarCategory = require('../models/CarCategory');
const DocumentType = require('../models/DocumentType');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/**
 * Validates an array of DocumentType IDs:
 * - Each must be a valid ObjectId
 * - Each must exist in the database
 * - Each must be active
 * Returns { valid: true } or { valid: false, badIds: [...] }
 */
async function validateDocTypeIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { valid: true };

  const badIds = [];
  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      badIds.push({ id, reason: 'invalid ObjectId' });
      continue;
    }
    const found = await DocumentType.findById(id).select('_id active');
    if (!found) {
      badIds.push({ id, reason: 'not found' });
    } else if (!found.active) {
      badIds.push({ id, reason: 'inactive' });
    }
  }
  return badIds.length === 0 ? { valid: true } : { valid: false, badIds };
}

// ── POST /api/car-categories ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, requiredDocumentTypes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const check = await validateDocTypeIds(requiredDocumentTypes || []);
    if (!check.valid) {
      return res.status(400).json({
        error: 'Some requiredDocumentTypes IDs are invalid or inactive.',
        invalidIds: check.badIds,
      });
    }

    const category = await CarCategory.create({
      name: name.trim(),
      description: description?.trim() || '',
      requiredDocumentTypes: requiredDocumentTypes || [],
    });

    return res.status(201).json(category);
  } catch (err) {
    console.error('[POST /api/car-categories]', err);
    return res.status(500).json({ error: 'Server error creating car category.' });
  }
});

// ── GET /api/car-categories ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const categories = await CarCategory.find().sort({ name: 1 });
    return res.json(categories);
  } catch (err) {
    console.error('[GET /api/car-categories]', err);
    return res.status(500).json({ error: 'Server error fetching car categories.' });
  }
});

// ── GET /api/car-categories/:id ───────────────────────────────────────────────
// Populates requiredDocumentTypes with basic fields (shortName, code, active)
router.get('/:id', async (req, res) => {
  try {
    const category = await CarCategory.findById(req.params.id).populate(
      'requiredDocumentTypes',
      'shortName code active'
    );
    if (!category) return res.status(404).json({ error: 'Car category not found.' });
    return res.json(category);
  } catch (err) {
    console.error('[GET /api/car-categories/:id]', err);
    return res.status(500).json({ error: 'Server error fetching car category.' });
  }
});

// ── PATCH /api/car-categories/:id ────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const category = await CarCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Car category not found.' });

    const { name, description, requiredDocumentTypes, active } = req.body;
    const updates = {};

    if (requiredDocumentTypes !== undefined) {
      const check = await validateDocTypeIds(requiredDocumentTypes);
      if (!check.valid) {
        return res.status(400).json({
          error: 'Some requiredDocumentTypes IDs are invalid or inactive.',
          invalidIds: check.badIds,
        });
      }
      updates.requiredDocumentTypes = requiredDocumentTypes;
    }

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (active !== undefined) updates.active = Boolean(active);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const updated = await CarCategory.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('requiredDocumentTypes', 'shortName code active');

    return res.json(updated);
  } catch (err) {
    console.error('[PATCH /api/car-categories/:id]', err);
    return res.status(500).json({ error: 'Server error updating car category.' });
  }
});

module.exports = router;
