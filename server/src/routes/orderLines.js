const express = require('express');
const mongoose = require('mongoose');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const File = require('../models/File');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/fileSize');

const router = express.Router();

// All progression routes require authentication and must be either admin or china_associate
router.use(requireAuth, requireRole('admin', 'china_associate'));

/**
 * Helper to check role-based line ownership:
 * - Admin always passes for any line (China never touches platform fallback)
 * - China associate passes ONLY if assignedChinaAccountId === req.user._id
 */
function checkLineAccess(line, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'china_associate') {
    return (
      line.assignedChinaAccountId &&
      line.assignedChinaAccountId.toString() === user._id.toString()
    );
  }
  return false;
}

// ── POST /api/order-lines/:lineId/ship ────────────────────────────────────────
// Body: shippingTrackingCode (required), optional file upload (field: 'file')
// Valid when status is 'needed' or 'sent_to_china' -> transitions to 'shipped'
router.post('/:lineId/ship', uploadSingle('file'), async (req, res) => {
  try {
    const { lineId } = req.params;
    const { shippingTrackingCode, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (!shippingTrackingCode?.trim()) {
      return res.status(400).json({ error: 'shippingTrackingCode is required to ship a document line.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    // Source validation: only china-sourced lines can be shipped
    if (line.source !== 'china') {
      return res.status(400).json({
        error: 'Only china-sourced lines can be shipped.',
      });
    }

    // Ownership check
    if (!checkLineAccess(line, req.user)) {
      return res.status(403).json({
        error: 'Access denied: You are not assigned to this document line.',
      });
    }

    // Status validation
    if (!['needed', 'sent_to_china'].includes(line.status)) {
      return res.status(400).json({
        error: `Cannot ship line with status "${line.status}". Only "needed" or "sent_to_china" lines can be marked shipped.`,
      });
    }

    // Handle optional file upload
    let fileDoc = null;
    if (req.file) {
      fileDoc = await File.create({
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size,
        uploadedByUserId: req.user._id,
      });
      line.uploadedFiles.push(fileDoc._id);
    }

    // Transition status and record tracking code
    line.status = 'shipped';
    line.shippingTrackingCode = shippingTrackingCode.trim();

    // Append activityLog entry
    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'shipped',
      note: note?.trim() || `Shipped with tracking code ${shippingTrackingCode.trim()}`,
      fileId: fileDoc ? fileDoc._id : null,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate('assignedChinaAccountId', 'name email role')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      });

    return res.json({
      message: 'Document line marked as shipped.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/ship]', err);
    return res.status(500).json({ error: 'Server error marking document line as shipped.' });
  }
});

// ── POST /api/order-lines/:lineId/mark-printed ─────────────────────────────────
// For local-source lines: transitions 'needed' -> 'printed', optional file upload
router.post('/:lineId/mark-printed', uploadSingle('file'), async (req, res) => {
  try {
    const { lineId } = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    // Source validation: only local-sourced lines can be marked printed
    if (line.source !== 'local') {
      return res.status(400).json({
        error: 'Only local-sourced lines can be marked printed.',
      });
    }

    // Ownership check (admin can print any local line; china_associate cannot print local lines)
    if (!checkLineAccess(line, req.user)) {
      return res.status(403).json({
        error: 'Access denied: You are not authorized to mark this document line printed.',
      });
    }

    if (line.status !== 'needed') {
      return res.status(400).json({
        error: `Cannot mark printed: line status must be "needed". Current status: "${line.status}".`,
      });
    }

    let fileDoc = null;
    if (req.file) {
      fileDoc = await File.create({
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size,
        uploadedByUserId: req.user._id,
      });
      line.uploadedFiles.push(fileDoc._id);
    }

    line.status = 'printed';

    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'printed',
      note: note?.trim() || 'Marked printed locally',
      fileId: fileDoc ? fileDoc._id : null,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      });

    return res.json({
      message: 'Document line marked as printed.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/mark-printed]', err);
    return res.status(500).json({ error: 'Server error marking document line as printed.' });
  }
});

// ── PATCH /api/order-lines/:lineId/delay ──────────────────────────────────────
// Body: isDelayed (boolean, required). Only settable while status is 'shipped'
router.patch('/:lineId/delay', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { isDelayed, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (typeof isDelayed !== 'boolean') {
      return res.status(400).json({ error: 'isDelayed boolean is required.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    if (!checkLineAccess(line, req.user)) {
      return res.status(403).json({
        error: 'Access denied: You are not assigned to this document line.',
      });
    }

    if (line.status !== 'shipped') {
      return res.status(400).json({
        error: `Delay status can only be toggled when line status is "shipped". Current status: "${line.status}".`,
      });
    }

    line.isDelayed = isDelayed;

    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: isDelayed ? 'marked_delayed' : 'unmarked_delayed',
      note: note?.trim() || (isDelayed ? 'Transit delayed' : 'Transit delay resolved'),
      fileId: null,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate('assignedChinaAccountId', 'name email role');

    return res.json({
      message: isDelayed ? 'Document line marked as delayed.' : 'Delay flag cleared.',
      line: populated,
    });
  } catch (err) {
    console.error('[PATCH /api/order-lines/:lineId/delay]', err);
    return res.status(500).json({ error: 'Server error updating line delay status.' });
  }
});

// ── POST /api/order-lines/:lineId/files ───────────────────────────────────────
// Attaches a file to a document line WITHOUT changing status
// Accessible to Admin, or the assigned china_associate for their own line
router.post('/:lineId/files', uploadSingle('file'), async (req, res) => {
  try {
    const { lineId } = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    // Ownership check (admin always passes; china_associate passes only if assigned)
    if (!checkLineAccess(line, req.user)) {
      return res.status(403).json({
        error: 'Access denied: You are not authorized to upload files to this document line.',
      });
    }

    const fileDoc = await File.create({
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      size: req.file.size,
      uploadedByUserId: req.user._id,
    });

    line.uploadedFiles.push(fileDoc._id);

    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'file_added',
      note: note?.trim() || `Uploaded document: ${req.file.originalname}`,
      fileId: fileDoc._id,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate('assignedChinaAccountId', 'name email role')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      });

    return res.json({
      message: 'File attached successfully.',
      file: {
        _id: fileDoc._id,
        filename: fileDoc.filename,
        contentType: fileDoc.contentType,
        size: fileDoc.size,
        uploadedAt: fileDoc.uploadedAt,
        uploadedBy: {
          _id: req.user._id,
          name: req.user.name,
          role: req.user.role,
        },
      },
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/files]', err);
    return res.status(500).json({ error: 'Server error attaching file to document line.' });
  }
});

module.exports = router;
