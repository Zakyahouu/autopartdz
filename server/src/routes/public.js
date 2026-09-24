const express = require('express');
const mongoose = require('mongoose');
const DocumentType = require('../models/DocumentType');
const CarCategory = require('../models/CarCategory');
const Order = require('../models/Order');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const File = require('../models/File');
const { generateUniqueTrackingCode } = require('../utils/trackingCode');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveDocField(doc, field, locale) {
  if (locale && locale !== 'en' && doc.translations?.[locale]?.[field]) {
    return doc.translations[locale][field];
  }
  return doc[field] || '';
}

function resolveCategoryField(cat, field, locale) {
  if (locale && locale !== 'en' && cat.translations?.[locale]?.[field]) {
    return cat.translations[locale][field];
  }
  return cat[field] || '';
}

// ── GET /api/public/car-categories?locale=en|fr|ar ────────────────────────────
router.get('/car-categories', async (req, res) => {
  try {
    const locale = (req.query.locale || 'en').toLowerCase();
    const categories = await CarCategory.find({ active: true })
      .populate({
        path: 'requiredDocumentTypes',
        match: { active: true },
        select: '_id shortName fullName translations',
      })
      .sort({ name: 1 })
      .lean();

    const result = categories.map((cat) => ({
      id: cat._id.toString(),
      name: resolveCategoryField(cat, 'name', locale),
      description: resolveCategoryField(cat, 'description', locale),
      requiredDocumentTypes: (cat.requiredDocumentTypes || []).map((doc) => ({
        id: doc._id.toString(),
        fullName:
          resolveDocField(doc, 'fullName', locale) ||
          doc.shortName ||
          '',
      })),
    }));

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/public/car-categories]', err);
    return res.status(500).json({ error: 'Failed to fetch vehicle categories.' });
  }
});

// ── GET /api/public/document-types?locale=en|fr|ar ─────────────────────────────
// STRICT ALLOWLIST: NEVER leaks costPrice, defaultSource, or originLanguage!
router.get('/document-types', async (req, res) => {
  try {
    const locale = (req.query.locale || 'en').toLowerCase();
    const docs = await DocumentType.find({ active: true })
      .sort({ sortOrder: 1, shortName: 1 })
      .lean();

    const result = docs.map((doc) => {
      const pricing = {
        originalOnly: {
          clientPrice: doc.pricing?.originalOnly?.clientPrice ?? null,
        },
      };

      if (doc.hasTranslation) {
        pricing.originalPlusTranslation = {
          clientPrice: doc.pricing?.originalPlusTranslation?.clientPrice ?? null,
        };
        pricing.translationOnly = {
          clientPrice: doc.pricing?.translationOnly?.clientPrice ?? null,
        };
      }

      const item = {
        id: doc._id.toString(),
        fullName: resolveDocField(doc, 'fullName', locale) || doc.shortName || '',
        description: resolveDocField(doc, 'description', locale),
        category: resolveDocField(doc, 'category', locale),
        hasTranslation: Boolean(doc.hasTranslation),
        pricing,
        estimatedTurnaroundDays: doc.estimatedTurnaroundDays ?? null,
        exampleImageFileId: doc.exampleImageFileId ? doc.exampleImageFileId.toString() : null,
      };

      if (doc.code) {
        item.code = doc.code;
      }

      return item;
    });

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/public/document-types]', err);
    return res.status(500).json({ error: 'Failed to fetch document types.' });
  }
});

// ── GET /api/public/files/:id ─────────────────────────────────────────────────
// Serves file bytes ONLY if id matches exampleImageFileId of an active DocumentType
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Verify this file is an exampleImageFileId for an active DocumentType
    const matchingDoc = await DocumentType.findOne({
      exampleImageFileId: id,
      active: true,
    }).select('_id');

    if (!matchingDoc) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Length': file.size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename || 'example')}"`,
      'Cache-Control': 'public, max-age=86400',
    });

    return res.send(file.data);
  } catch (err) {
    console.error('[GET /api/public/files/:id]', err);
    return res.status(500).json({ error: 'Server error retrieving file.' });
  }
});

// ── POST /api/public/orders (Create New Order) ─────────────────────────────────
router.post('/orders', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      wilaya,
      address,
      email,
      importAgency,
      note,
      passportNumber,
      vin,
      carModel,
      carCategoryId,
      documents,
    } = req.body;

    // Required field validation
    if (!firstName?.trim()) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName?.trim()) return res.status(400).json({ error: 'Last name is required.' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Phone number is required.' });
    if (!wilaya?.trim()) return res.status(400).json({ error: 'Wilaya is required.' });
    if (!address?.trim()) return res.status(400).json({ error: 'Address is required.' });
    if (!vin?.trim()) return res.status(400).json({ error: 'VIN is required.' });

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'At least one document must be selected.' });
    }

    // Optional category validation
    let validCarCategoryId = null;
    if (carCategoryId) {
      if (!mongoose.Types.ObjectId.isValid(carCategoryId)) {
        return res.status(400).json({ error: 'Invalid car category ID.' });
      }
      const category = await CarCategory.findOne({ _id: carCategoryId, active: true });
      if (!category) {
        return res.status(400).json({ error: 'Selected car category is not active or does not exist.' });
      }
      validCarCategoryId = category._id;
    }

    // Validate documents and translation modes
    const preparedLines = [];
    for (const item of documents) {
      const { documentTypeId, translationMode } = item || {};
      if (!documentTypeId || !mongoose.Types.ObjectId.isValid(documentTypeId)) {
        return res.status(400).json({ error: `Invalid document type ID: ${documentTypeId}` });
      }

      const doc = await DocumentType.findOne({ _id: documentTypeId, active: true });
      if (!doc) {
        return res.status(400).json({ error: `Document type not found or inactive: ${documentTypeId}` });
      }

      if (!['original_only', 'original_plus_translation', 'translation_only'].includes(translationMode)) {
        return res.status(400).json({ error: `Invalid translation mode: ${translationMode}` });
      }

      if (!doc.hasTranslation && translationMode !== 'original_only') {
        return res.status(400).json({
          error: `Document "${doc.shortName}" does not offer translation services.`,
        });
      }

      // Snapshot prices
      let clientPrice = null;
      let costPrice = null;

      if (translationMode === 'original_only') {
        clientPrice = doc.pricing?.originalOnly?.clientPrice;
        costPrice = doc.pricing?.originalOnly?.costPrice;
      } else if (translationMode === 'original_plus_translation') {
        clientPrice = doc.pricing?.originalPlusTranslation?.clientPrice;
        costPrice = doc.pricing?.originalPlusTranslation?.costPrice;
      } else if (translationMode === 'translation_only') {
        clientPrice = doc.pricing?.translationOnly?.clientPrice;
        costPrice = doc.pricing?.translationOnly?.costPrice;
      }

      if (clientPrice == null || costPrice == null) {
        return res.status(400).json({
          error: `Pricing incomplete for document "${doc.shortName}" in mode "${translationMode}".`,
        });
      }

      // Pre-fill source from defaultSource
      let source = null;
      if (doc.defaultSource === 'local') {
        source = 'local';
      } else if (doc.defaultSource === 'china') {
        source = 'china';
      } else {
        // 'mixed' -> null
        source = null;
      }

      preparedLines.push({
        documentTypeId: doc._id,
        translationMode,
        clientPrice,
        costPrice,
        source,
      });
    }

    // Generate unique tracking code
    const trackingCode = await generateUniqueTrackingCode();

    // Create Order
    const order = await Order.create({
      trackingCode,
      orderType: 'new',
      status: 'pending',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim().toLowerCase() || '',
      phone: phone.trim(),
      wilaya: wilaya.trim(),
      address: address.trim(),
      passportNumber: passportNumber?.trim() || '',
      vin: vin.trim().toUpperCase(),
      carModel: carModel?.trim() || '',
      carCategoryId: validCarCategoryId,
      importAgency: importAgency?.trim() || '',
      note: note?.trim() || '',
    });

    // Create OrderDocumentLines
    const lineDocs = preparedLines.map((line) => ({
      orderId: order._id,
      documentTypeId: line.documentTypeId,
      translationMode: line.translationMode,
      clientPrice: line.clientPrice,
      costPrice: line.costPrice,
      source: line.source,
      status: 'needed',
    }));

    await OrderDocumentLine.insertMany(lineDocs);

    return res.status(201).json({
      message: 'Order created successfully.',
      trackingCode: order.trackingCode,
      orderId: order._id,
    });
  } catch (err) {
    console.error('[POST /api/public/orders]', err);
    return res.status(500).json({ error: 'Server error creating order.' });
  }
});

// ── POST /api/public/orders/correction/lookup ─────────────────────────────────
// Requires trackingCode + (phone OR vin) per "code alone is not enough" security rule
router.get('/orders/correction/lookup', (req, res) => {
  return res.status(405).json({ error: 'Method not allowed. Use POST.' });
});

router.post('/orders/correction/lookup', async (req, res) => {
  try {
    const { trackingCode, phone, vin } = req.body;
    const locale = (req.query.locale || 'en').toLowerCase();

    if (!trackingCode?.trim()) {
      return res.status(400).json({ error: 'Tracking code is required.' });
    }

    const cleanPhone = phone?.trim();
    const cleanVin = vin?.trim().toUpperCase();

    if (!cleanPhone && !cleanVin) {
      return res.status(400).json({
        error: 'Verification required: provide either phone number or VIN along with tracking code.',
      });
    }

    const conditions = [{ trackingCode: trackingCode.trim().toUpperCase() }];
    const matchConditions = [];
    if (cleanPhone) matchConditions.push({ phone: cleanPhone });
    if (cleanVin) matchConditions.push({ vin: cleanVin });

    conditions.push({ $or: matchConditions });
    // Status gate: only orders whose status is NOT 'pending' can be looked up for correction
    conditions.push({ status: { $ne: 'pending' } });

    const order = await Order.findOne({ $and: conditions }).lean();

    if (!order) {
      // Generic 404 — does not reveal whether tracking code or phone/vin was mismatched or ineligible status
      return res.status(404).json({
        error: 'No matching order found. Please check your tracking code and phone number / VIN.',
      });
    }

    // Fetch lines for this order
    const lines = await OrderDocumentLine.find({ orderId: order._id })
      .populate({
        path: 'documentTypeId',
        select: '_id shortName fullName translations',
      })
      .lean();

    // STRICT ALLOWLIST: NEVER leak costPrice, activityLog, assignedAssociateId, or trackingCode!
    const sanitizedLines = lines.map((line) => {
      const doc = line.documentTypeId || {};
      const resolvedName =
        resolveDocField(doc, 'fullName', locale) ||
        doc.shortName ||
        'Document';

      return {
        id: line._id.toString(),
        documentType: {
          id: doc._id ? doc._id.toString() : null,
          fullName: resolvedName,
        },
        translationMode: line.translationMode,
        clientPrice: line.clientPrice,
        status: line.status,
      };
    });

    return res.json({
      id: order._id.toString(),
      trackingCode: order.trackingCode,
      firstName: order.firstName,
      lastName: order.lastName,
      phone: order.phone,
      wilaya: order.wilaya,
      address: order.address,
      email: order.email || '',
      vin: order.vin,
      carModel: order.carModel || '',
      importAgency: order.importAgency || '',
      orderDocumentLines: sanitizedLines,
    });
  } catch (err) {
    console.error('[POST /api/public/orders/correction/lookup]', err);
    return res.status(500).json({ error: 'Server error looking up order.' });
  }
});

// ── POST /api/public/orders/correction (Create Correction Order) ───────────────
router.post('/orders/correction', async (req, res) => {
  try {
    const { originalOrderId, corrections, updates } = req.body;

    if (!originalOrderId || !mongoose.Types.ObjectId.isValid(originalOrderId)) {
      return res.status(400).json({ error: 'Valid originalOrderId is required.' });
    }

    const originalOrder = await Order.findById(originalOrderId);
    if (!originalOrder || originalOrder.status === 'pending') {
      return res.status(404).json({ error: 'Original order not found or is ineligible for correction.' });
    }

    if (!Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({ error: 'At least one document line must be flagged for correction.' });
    }

    // Validate that each originalLineId belongs to originalOrder
    const originalLineIds = corrections.map((c) => c.originalLineId);
    for (const id of originalLineIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `Invalid line ID: ${id}` });
      }
    }

    const originalLines = await OrderDocumentLine.find({
      _id: { $in: originalLineIds },
      orderId: originalOrder._id,
    });

    if (originalLines.length !== corrections.length) {
      return res.status(400).json({
        error: 'One or more flagged lines do not belong to the referenced original order.',
      });
    }

    const lineMap = new Map();
    originalLines.forEach((l) => lineMap.set(l._id.toString(), l));

    // Prepare new lines for flagged items only
    const preparedNewLines = [];
    for (const item of corrections) {
      const { originalLineId, reason } = item || {};
      if (!reason?.trim()) {
        return res.status(400).json({
          error: `A correction reason is required for line ${originalLineId}.`,
        });
      }

      const origLine = lineMap.get(originalLineId.toString());
      if (!origLine) {
        return res.status(400).json({ error: `Line ${originalLineId} not found.` });
      }

      // Re-snapshot pricing from CURRENT catalog (prices may have changed)
      const currentDoc = await DocumentType.findById(origLine.documentTypeId);
      if (!currentDoc) {
        return res.status(400).json({
          error: `Document type for line ${originalLineId} is no longer in catalog.`,
        });
      }

      let clientPrice = null;
      let costPrice = null;

      if (origLine.translationMode === 'original_only') {
        clientPrice = currentDoc.pricing?.originalOnly?.clientPrice;
        costPrice = currentDoc.pricing?.originalOnly?.costPrice;
      } else if (origLine.translationMode === 'original_plus_translation') {
        clientPrice = currentDoc.pricing?.originalPlusTranslation?.clientPrice;
        costPrice = currentDoc.pricing?.originalPlusTranslation?.costPrice;
      } else if (origLine.translationMode === 'translation_only') {
        clientPrice = currentDoc.pricing?.translationOnly?.clientPrice;
        costPrice = currentDoc.pricing?.translationOnly?.costPrice;
      }

      // Fallback to original snapshot if current doc tier was somehow modified
      if (clientPrice == null) clientPrice = origLine.clientPrice;
      if (costPrice == null) costPrice = origLine.costPrice;

      let source = null;
      if (currentDoc.defaultSource === 'local') source = 'local';
      else if (currentDoc.defaultSource === 'china') source = 'china';
      else source = null; // 'mixed'

      preparedNewLines.push({
        documentTypeId: currentDoc._id,
        translationMode: origLine.translationMode,
        clientPrice,
        costPrice,
        source,
        correctionReason: reason.trim(),
      });
    }

    // Generate new tracking code
    const newTrackingCode = await generateUniqueTrackingCode();

    // Copy client info from original, allow optional updates object overrides
    const newOrder = await Order.create({
      trackingCode: newTrackingCode,
      orderType: 'correction',
      linkedOrderId: originalOrder._id,
      status: 'pending',
      firstName: updates?.firstName?.trim() || originalOrder.firstName,
      lastName: updates?.lastName?.trim() || originalOrder.lastName,
      email: updates?.email !== undefined ? updates.email.trim().toLowerCase() : originalOrder.email,
      phone: updates?.phone?.trim() || originalOrder.phone,
      wilaya: updates?.wilaya?.trim() || originalOrder.wilaya,
      address: updates?.address?.trim() || originalOrder.address,
      passportNumber: updates?.passportNumber !== undefined ? updates.passportNumber.trim() : originalOrder.passportNumber,
      vin: updates?.vin?.trim().toUpperCase() || originalOrder.vin,
      carModel: updates?.carModel !== undefined ? updates.carModel.trim() : originalOrder.carModel,
      carCategoryId: originalOrder.carCategoryId,
      importAgency: updates?.importAgency !== undefined ? updates.importAgency.trim() : originalOrder.importAgency,
      note: updates?.note !== undefined ? updates.note.trim() : originalOrder.note,
    });

    const newDocLines = preparedNewLines.map((line) => ({
      orderId: newOrder._id,
      documentTypeId: line.documentTypeId,
      translationMode: line.translationMode,
      clientPrice: line.clientPrice,
      costPrice: line.costPrice,
      source: line.source,
      status: 'needed',
      correctionReason: line.correctionReason,
    }));

    await OrderDocumentLine.insertMany(newDocLines);

    return res.status(201).json({
      message: 'Correction order submitted successfully.',
      trackingCode: newOrder.trackingCode,
      orderId: newOrder._id,
    });
  } catch (err) {
    console.error('[POST /api/public/orders/correction]', err);
    return res.status(500).json({ error: 'Server error creating correction order.' });
  }
});

// ── POST /api/public/orders/:trackingCode/correction (Phase 7 Client Route) ───
// Client-facing correction submission:
// Requires trackingCode + (phone OR vin) matching Case 5 tracking identity rule.
// Only allowed when parent order status is 'delivered' or 'completed'.
// Body: array of { originalLineId, reason } (or { phone, vin, lines: [...] })
// Guard: reject if any originalLineId already has an open (non-terminal) correction order.
// On success: creates new Order with isCorrection=true, parentOrderId, fresh trackingCode,
// and cloned lines with parentLineId, correctionReason, status='needed'.
// Parent order and its lines remain completely untouched.
router.post('/orders/:trackingCode/correction', async (req, res) => {
  try {
    const { trackingCode } = req.params;
    const phone = req.body?.phone || req.query?.phone;
    const vin = req.body?.vin || req.query?.vin;

    if (!trackingCode?.trim()) {
      return res.status(400).json({ error: 'Tracking code is required.' });
    }

    const cleanPhone = phone?.trim();
    const cleanVin = vin?.trim().toUpperCase();

    if (!cleanPhone && !cleanVin) {
      return res.status(400).json({
        error: 'Verification required: provide either phone number or VIN along with tracking code.',
      });
    }

    // Identity check — same rule as tracking route
    const conditions = [{ trackingCode: trackingCode.trim().toUpperCase() }];
    const matchConditions = [];
    if (cleanPhone) matchConditions.push({ phone: cleanPhone });
    if (cleanVin) matchConditions.push({ vin: cleanVin });
    conditions.push({ $or: matchConditions });

    const parentOrder = await Order.findOne({ $and: conditions });
    if (!parentOrder) {
      return res.status(404).json({
        error: 'No matching order found. Please check your tracking code and phone number / VIN.',
      });
    }

    // Gate: only allowed when parent order status is 'delivered' or 'completed'
    if (!['delivered', 'completed'].includes(parentOrder.status)) {
      return res.status(400).json({
        error: `Corrections are only permitted on delivered or completed orders. Current status: "${parentOrder.status}".`,
      });
    }

    // Extract items (support array directly or lines/corrections property)
    let items = [];
    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (Array.isArray(req.body?.lines)) {
      items = req.body.lines;
    } else if (Array.isArray(req.body?.corrections)) {
      items = req.body.corrections;
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'At least one document line must be selected for correction.',
      });
    }

    // Validate body structure and non-empty reasons
    const lineIds = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.originalLineId) {
        return res.status(400).json({ error: `Item ${i + 1}: originalLineId is required.` });
      }
      if (!mongoose.Types.ObjectId.isValid(item.originalLineId)) {
        return res.status(400).json({ error: `Item ${i + 1}: Invalid originalLineId format.` });
      }
      if (!item.reason || typeof item.reason !== 'string' || !item.reason.trim()) {
        return res.status(400).json({
          error: `A non-empty correction reason is required for line ${item.originalLineId}.`,
        });
      }
      lineIds.push(item.originalLineId);
    }

    // Check for duplicate line IDs in the request itself
    const uniqueLineIds = new Set(lineIds.map((id) => id.toString()));
    if (uniqueLineIds.size !== lineIds.length) {
      return res.status(400).json({
        error: 'Duplicate lines selected in correction request.',
      });
    }

    // Verify all original lines belong to this parent order
    const originalLines = await OrderDocumentLine.find({
      _id: { $in: lineIds },
      orderId: parentOrder._id,
    }).populate('documentTypeId', 'shortName fullName');

    if (originalLines.length !== lineIds.length) {
      return res.status(400).json({
        error: 'One or more selected lines do not belong to this order.',
      });
    }

    const origLineMap = new Map();
    originalLines.forEach((l) => origLineMap.set(l._id.toString(), l));

    // GUARD: reject if any selected originalLineId already has an open
    // (non-rejected, non-terminal) correction order referencing it.
    // Terminal statuses: 'rejected', 'completed'
    const existingCorrectionLines = await OrderDocumentLine.find({
      parentLineId: { $in: lineIds },
    }).populate({
      path: 'orderId',
      select: '_id trackingCode status isCorrection',
    }).populate('documentTypeId', 'shortName fullName');

    for (const corrLine of existingCorrectionLines) {
      const corrOrder = corrLine.orderId;
      if (corrOrder && !['rejected', 'completed'].includes(corrOrder.status)) {
        const docName =
          corrLine.documentTypeId?.fullName ||
          corrLine.documentTypeId?.shortName ||
          corrLine.parentLineId.toString();
        return res.status(400).json({
          error: `Line "${docName}" (ID: ${corrLine.parentLineId}) already has an open correction order (${corrOrder.trackingCode}, status: "${corrOrder.status}"). Duplicate correction claims on the same line are not allowed.`,
          conflictingLineId: corrLine.parentLineId,
          existingTrackingCode: corrOrder.trackingCode,
        });
      }
    }

    // Success: Create new correction Order
    const newTrackingCode = await generateUniqueTrackingCode();

    const newOrder = await Order.create({
      trackingCode: newTrackingCode,
      orderType: 'correction',
      isCorrection: true,
      parentOrderId: parentOrder._id,
      linkedOrderId: parentOrder._id,
      status: 'pending',
      firstName: parentOrder.firstName,
      lastName: parentOrder.lastName,
      email: parentOrder.email || '',
      phone: parentOrder.phone,
      wilaya: parentOrder.wilaya,
      address: parentOrder.address,
      passportNumber: parentOrder.passportNumber || '',
      vin: parentOrder.vin,
      carModel: parentOrder.carModel || '',
      carCategoryId: parentOrder.carCategoryId,
      importAgency: parentOrder.importAgency || '',
      note: parentOrder.note || '',
      passportFileId: parentOrder.passportFileId || null,
    });

    // Create new OrderDocumentLines
    const newLinesToInsert = items.map((item) => {
      const orig = origLineMap.get(item.originalLineId.toString());
      return {
        orderId: newOrder._id,
        documentTypeId: orig.documentTypeId._id || orig.documentTypeId,
        parentLineId: orig._id,
        correctionReason: item.reason.trim(),
        translationMode: orig.translationMode,
        clientPrice: orig.clientPrice,
        costPrice: orig.costPrice,
        source: orig.source,
        status: 'needed',
      };
    });

    const insertedLines = await OrderDocumentLine.insertMany(newLinesToInsert);

    return res.status(201).json({
      message: 'Correction order created successfully.',
      trackingCode: newOrder.trackingCode,
      orderId: newOrder._id,
      isCorrection: newOrder.isCorrection,
      parentOrderId: newOrder.parentOrderId,
      order: {
        _id: newOrder._id,
        trackingCode: newOrder.trackingCode,
        orderType: newOrder.orderType,
        isCorrection: newOrder.isCorrection,
        parentOrderId: newOrder.parentOrderId,
        status: newOrder.status,
      },
      lines: insertedLines.map((l) => ({
        _id: l._id,
        parentLineId: l.parentLineId,
        correctionReason: l.correctionReason,
        status: l.status,
        documentTypeId: l.documentTypeId,
      })),
    });
  } catch (err) {
    console.error('[POST /api/public/orders/:trackingCode/correction]', err);
    return res.status(500).json({ error: 'Server error processing correction submission.' });
  }
});

// ── Helper Status Mappers for Public Tracking ────────────────────────────────
function mapLineStatusToClient(status) {
  switch (status) {
    case 'needed':
      return 'needed';
    case 'sent_to_china':
    case 'shipped':
    case 'pending_admin_review':
    case 'needs_correction':
      return 'in_progress';
    case 'printed':
    case 'arrived_at_office':
    case 'packaged':
      return 'ready';
    case 'sent_to_client':
    case 'delivered':
      return 'delivered';
    default:
      return 'in_progress';
  }
}

function mapOrderStatusToClient(status) {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'confirmed':
    case 'in_progress':
      return 'in_progress';
    case 'ready_for_dispatch':
    case 'packaged':
      return 'ready';
    case 'sent_to_client':
    case 'delivered':
      return 'delivered';
    case 'completed':
      return 'completed';
    case 'rejected':
      return 'rejected';
    default:
      return 'in_progress';
  }
}

// ── GET /api/public/orders/track ───────────────────────────────────────────────
// Public tracking lookup: lookup by trackingCode OR vin (one or the other, not both).
// No status restriction. Strict allowlist: never leaks prices, logs, or internal statuses!
router.get('/orders/track', async (req, res) => {
  try {
    const { trackingCode, vin } = req.query;
    const locale = (req.query.locale || 'en').toLowerCase();

    const cleanCode = trackingCode?.trim().toUpperCase();
    const cleanVin = vin?.trim().toUpperCase();

    if (cleanCode && cleanVin) {
      return res.status(400).json({
        error: 'Please search using either tracking code or VIN, not both at the same time.',
      });
    }

    if (!cleanCode && !cleanVin) {
      return res.status(400).json({
        error: 'Please provide either a tracking code or VIN to track your dossier.',
      });
    }

    const query = cleanCode ? { trackingCode: cleanCode } : { vin: cleanVin };

    // Note: NO status restriction here (unlike correction lookup)
    const order = await Order.findOne(query).sort({ createdAt: -1 }).lean();

    if (!order) {
      return res.status(404).json({
        error: 'No matching order found. Please check your tracking code or VIN.',
      });
    }

    // Fetch lines for this order
    const lines = await OrderDocumentLine.find({ orderId: order._id })
      .populate({
        path: 'documentTypeId',
        select: '_id shortName fullName translations',
      })
      .lean();

    // STRICT ALLOWLIST: ONLY documentType fullName, status, isDelayed!
    // NEVER leak clientPrice, costPrice, activityLog, assignedAssociateId, or files!
    const sanitizedLines = lines.map((line) => {
      const doc = line.documentTypeId || {};
      const resolvedName =
        resolveDocField(doc, 'fullName', locale) ||
        doc.shortName ||
        'Document';

      return {
        documentType: {
          fullName: resolvedName,
        },
        status: mapLineStatusToClient(line.status),
        isDelayed: Boolean(line.isDelayed),
      };
    });

    return res.json({
      trackingCode: order.trackingCode,
      vin: order.vin,
      orderStatus: mapOrderStatusToClient(order.status),
      orderType: order.orderType,
      isCorrection: Boolean(order.isCorrection),
      lines: sanitizedLines,
    });
  } catch (err) {
    console.error('[GET /api/public/orders/track]', err);
    return res.status(500).json({ error: 'Server error looking up order tracking.' });
  }
});

module.exports = router;

