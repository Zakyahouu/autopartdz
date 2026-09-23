const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
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

/**
 * recomputeOrderStatus(orderId)
 * Called synchronously after every line-status-changing action.
 * Rules:
 *   - confirmed + any line past 'needed' → in_progress (one-way, never regresses)
 *   - in_progress + ALL lines at arrived_at_office or later → ready_for_dispatch
 * The statuses that count as "arrived or later" for the rollup check:
 *   arrived_at_office, packaged, sent_to_client, delivered
 */
const ARRIVED_OR_LATER = new Set([
  'arrived_at_office',
  'packaged',
  'sent_to_client',
  'delivered',
]);

async function recomputeOrderStatus(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return;

  // Only auto-rollup while the order is still in the pre-fulfillment window
  if (!['confirmed', 'in_progress'].includes(order.status)) return;

  const lines = await OrderDocumentLine.find({ orderId }).lean();
  if (lines.length === 0) return;

  // Transition confirmed → in_progress if any line has moved past 'needed'
  if (order.status === 'confirmed') {
    const anyStarted = lines.some((l) => l.status !== 'needed');
    if (anyStarted) {
      order.status = 'in_progress';
      await order.save();
    }
    // Re-read after potential update
    if (order.status !== 'in_progress') return;
  }

  // Transition in_progress → ready_for_dispatch if ALL lines are arrived_at_office or later
  if (order.status === 'in_progress') {
    const allArrived = lines.every((l) => ARRIVED_OR_LATER.has(l.status));
    if (allArrived) {
      order.status = 'ready_for_dispatch';
      await order.save();
    }
  }
}

// Export helper so orders.js can also call it if needed (unused for now, but available)
module.exports.recomputeOrderStatus = recomputeOrderStatus;

// ── POST /api/order-lines/:lineId/ship ────────────────────────────────────────
// Body: shippingTrackingCode (required), optional file upload (field: 'file')
// Valid when status is 'needed', 'sent_to_china', OR 'needs_correction' -> 'shipped'
// Always resets isDelayed to false on a successful ship.
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

    // Status validation — now includes 'needs_correction' for re-shipment
    if (!['needed', 'sent_to_china', 'needs_correction'].includes(line.status)) {
      return res.status(400).json({
        error: `Cannot ship line with status "${line.status}". Only "needed", "sent_to_china", or "needs_correction" lines can be marked shipped.`,
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

    // Transition status, record tracking code, and reset delay flag
    line.status = 'shipped';
    line.shippingTrackingCode = shippingTrackingCode.trim();
    line.isDelayed = false; // always reset on a fresh shipment

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

    // Auto-rollup order status
    await recomputeOrderStatus(line.orderId);

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

// ── POST /api/order-lines/:lineId/review ─────────────────────────────────────
// Admin-only. Valid ONLY when status is 'shipped' AND source is 'china'.
// Body: { decision: 'approve' | 'reject', note: string }
// - approve → status 'arrived_at_office', isDelayed cleared
// - reject  → status 'needs_correction' (same associate handles resend)
router.post('/:lineId/review', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { decision, note } = req.body;

    // Admin-only guard
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can review document lines.' });
    }

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approve" or "reject".' });
    }

    if (decision === 'reject' && !note?.trim()) {
      return res.status(400).json({
        error: 'note is required when rejecting a document line so the China associate knows what to fix.',
      });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    // Source guard: only china-source lines go through /review
    if (line.source !== 'china') {
      return res.status(400).json({
        error: 'Only china-sourced lines can be reviewed via this route. Local lines use /mark-arrived.',
      });
    }

    // Status guard: must be 'shipped'
    if (line.status !== 'shipped') {
      return res.status(400).json({
        error: `Cannot review line with status "${line.status}". Only "shipped" lines can be approved or rejected.`,
      });
    }

    if (decision === 'approve') {
      line.status = 'arrived_at_office';
      line.isDelayed = false;
      line.activityLog.push({
        timestamp: new Date(),
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'approved',
        note: note?.trim() || 'Document approved by admin.',
        fileId: null,
      });
    } else {
      // reject
      line.status = 'needs_correction';
      line.activityLog.push({
        timestamp: new Date(),
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'rejected',
        note: note.trim(),
        fileId: null,
      });
    }

    await line.save();

    // Auto-rollup order status (approve only meaningfully changes things,
    // but safe to call on reject too — it won't regress the order)
    await recomputeOrderStatus(line.orderId);

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate('assignedChinaAccountId', 'name email role')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      });

    return res.json({
      message: decision === 'approve'
        ? 'Document line approved — arrived at office.'
        : 'Document line rejected — awaiting correction from China associate.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/review]', err);
    return res.status(500).json({ error: 'Server error reviewing document line.' });
  }
});

// ── POST /api/order-lines/:lineId/mark-arrived ────────────────────────────────
// Admin-only. LOCAL-source lines only. Valid when status is 'printed'.
// Transitions: printed → arrived_at_office
router.post('/:lineId/mark-arrived', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { note } = req.body;

    // Admin-only guard
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can mark lines as arrived at office.' });
    }

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    // Source guard: only local lines use mark-arrived (china lines use /review)
    if (line.source !== 'local') {
      return res.status(400).json({
        error: 'Only local-sourced lines can be marked arrived via this route. China lines use /review instead.',
      });
    }

    // Status guard: must be 'printed'
    if (line.status !== 'printed') {
      return res.status(400).json({
        error: `Cannot mark arrived: line status must be "printed". Current status: "${line.status}".`,
      });
    }

    line.status = 'arrived_at_office';
    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'arrived_at_office',
      note: note?.trim() || 'Document arrived at office.',
      fileId: null,
    });

    await line.save();

    // Auto-rollup order status
    await recomputeOrderStatus(line.orderId);

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      });

    return res.json({
      message: 'Document line marked as arrived at office.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/mark-arrived]', err);
    return res.status(500).json({ error: 'Server error marking document line as arrived.' });
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

    // Auto-rollup order status
    await recomputeOrderStatus(line.orderId);

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
