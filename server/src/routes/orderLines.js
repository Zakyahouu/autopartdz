const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const File = require('../models/File');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/fileSize');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'china_associate'));

// ── recomputeOrderStatus ──────────────────────────────────────────────────────
// Synchronous helper called after every line status change.
// Rules (Phase 5b — uses new status values):
//   confirmed  + any line moved past 'needed'       → in_progress
//   in_progress + ALL lines at 'ready' or later     → ready_for_dispatch
const READY_OR_LATER = new Set(['ready', 'packaged', 'sent_to_client', 'delivered']);

async function recomputeOrderStatus(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return;

  if (!['confirmed', 'in_progress'].includes(order.status)) return;

  const lines = await OrderDocumentLine.find({ orderId }).lean();
  if (lines.length === 0) return;

  if (order.status === 'confirmed') {
    const anyStarted = lines.some((l) => l.status !== 'needed');
    if (anyStarted) {
      order.status = 'in_progress';
      await order.save();
    }
    if (order.status !== 'in_progress') return;
  }

  if (order.status === 'in_progress') {
    const allReady = lines.every((l) => READY_OR_LATER.has(l.status));
    if (allReady) {
      order.status = 'ready_for_dispatch';
      await order.save();
    }
  }
}

module.exports.recomputeOrderStatus = recomputeOrderStatus;

// ── Shared populate helper ────────────────────────────────────────────────────
function populateLine(query) {
  return query
    .populate('documentTypeId', 'shortName fullName code')
    .populate('assignedAssociateId', '_id name email role')
    .populate({
      path: 'uploadedFiles',
      select: '_id filename contentType size uploadedAt uploadedByUserId',
      populate: { path: 'uploadedByUserId', select: '_id name email role' },
    });
}

// ── POST /api/order-lines/:id/attach ─────────────────────────────────────────
// Multipart: file (required), trackingCode? (optional string)
// Admin   → any line, any time
// Associate → only their delegated (assignedAssociateId = self) needed lines
// Transition: needed → attached
// Clears lastRejectionNote / rejectedAt on successful attach
router.post('/:lineId/attach', uploadSingle('file'), async (req, res) => {
  try {
    const { lineId } = req.params;
    const { trackingCode, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'A file is required to attach a document.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    const parentOrder = await Order.findById(line.orderId);
    if (parentOrder && ['rejected', 'completed'].includes(parentOrder.status)) {
      return res.status(400).json({
        error: `Cannot modify lines on an order with terminal status "${parentOrder.status}".`,
      });
    }

    // Access control
    if (req.user.role === 'china_associate') {
      const isDelegate = line.assignedAssociateId &&
        line.assignedAssociateId.toString() === req.user._id.toString();
      if (!isDelegate) {
        return res.status(403).json({ error: 'Access denied: this line is not delegated to you.' });
      }
      if (line.status !== 'needed') {
        return res.status(400).json({
          error: `You can only attach documents to lines with status "needed". Current status: "${line.status}".`,
        });
      }
    }

    // Admin can attach at any "active" status (needed or attached — not downstream)
    if (req.user.role === 'admin' && !['needed', 'attached'].includes(line.status)) {
      return res.status(400).json({
        error: `Cannot attach to a line with status "${line.status}". Only "needed" or "attached" lines accept new attachments.`,
      });
    }

    // Store file
    const fileDoc = await File.create({
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      size: req.file.size,
      uploadedByUserId: req.user._id,
    });

    // Replace uploadedFiles with the new one (clear old links — keeps old File docs for audit)
    line.uploadedFiles = [fileDoc._id];

    if (trackingCode?.trim()) {
      line.trackingCode = trackingCode.trim();
    }

    line.status = 'attached';
    // Clear rejection state on fresh attach
    line.lastRejectionNote = null;
    line.rejectedAt = null;

    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'attached',
      note: note?.trim() || `Document attached by ${req.user.role}.`,
      fileId: fileDoc._id,
    });

    await line.save();
    await recomputeOrderStatus(line.orderId);

    const populated = await populateLine(OrderDocumentLine.findById(line._id));
    return res.json({ message: 'Document attached.', line: populated });
  } catch (err) {
    console.error('[POST /api/order-lines/:id/attach]', err);
    return res.status(500).json({ error: 'Server error attaching document.' });
  }
});

// ── POST /api/order-lines/:id/lock ───────────────────────────────────────────
// Admin-only.
// approve=true:  attached → ready (triggers order rollup)
// approve=false: attached → needed, sets lastRejectionNote/rejectedAt,
//                clears uploadedFiles references (file docs kept for audit)
router.post('/:lineId/lock', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { approve, note } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can lock document lines.' });
    }

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (typeof approve !== 'boolean') {
      return res.status(400).json({ error: '"approve" (boolean) is required.' });
    }

    if (approve === false && !note?.trim()) {
      return res.status(400).json({
        error: 'A rejection note is required when rejecting a line — the associate needs to know what to fix.',
      });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    const parentOrder = await Order.findById(line.orderId);
    if (parentOrder && ['rejected', 'completed'].includes(parentOrder.status)) {
      return res.status(400).json({
        error: `Cannot lock lines on an order with terminal status "${parentOrder.status}".`,
      });
    }

    if (line.status !== 'attached') {
      return res.status(400).json({
        error: `Cannot lock a line with status "${line.status}". Only "attached" lines can be approved or rejected.`,
      });
    }

    if (approve) {
      line.status = 'ready';
      line.lastRejectionNote = null;
      line.rejectedAt = null;
      line.activityLog.push({
        timestamp: new Date(),
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'approved',
        note: note?.trim() || 'Document approved.',
        fileId: null,
      });
    } else {
      line.status = 'needed';
      line.lastRejectionNote = note.trim();
      line.rejectedAt = new Date();
      // Unlink files so associate must re-attach (File docs preserved for audit)
      line.uploadedFiles = [];
      line.trackingCode = null;
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
    await recomputeOrderStatus(line.orderId);

    const populated = await populateLine(OrderDocumentLine.findById(line._id));
    return res.json({
      message: approve ? 'Document line approved — ready.' : 'Document line rejected — returned to needed.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:id/lock]', err);
    return res.status(500).json({ error: 'Server error locking document line.' });
  }
});

// ── POST /api/order-lines/:id/files ──────────────────────────────────────────
// Status-neutral file attach (no status change). Admin or own delegated lines.
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

    // Access: admin always; associate only for own delegated lines
    if (req.user.role === 'china_associate') {
      const isDelegate = line.assignedAssociateId &&
        line.assignedAssociateId.toString() === req.user._id.toString();
      if (!isDelegate) {
        return res.status(403).json({ error: 'Access denied: this line is not delegated to you.' });
      }
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
      note: note?.trim() || `Uploaded: ${req.file.originalname}`,
      fileId: fileDoc._id,
    });

    await line.save();

    const populated = await populateLine(OrderDocumentLine.findById(line._id));
    return res.json({ message: 'File attached.', line: populated });
  } catch (err) {
    console.error('[POST /api/order-lines/:id/files]', err);
    return res.status(500).json({ error: 'Server error attaching file.' });
  }
});

// ── POST /api/order-lines/:id/claim ──────────────────────────────────────────
// China-associate-only: Claim an open-pool line atomically.
router.post('/:lineId/claim', requireRole('china_associate'), async (req, res) => {
  try {
    const { lineId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    // Atomic findOneAndUpdate ensures two racing associates cannot both claim
    const line = await OrderDocumentLine.findOneAndUpdate(
      {
        _id: lineId,
        delegationMode: 'open',
        assignedAssociateId: null,
        excludedAssociateIds: { $ne: req.user._id },
      },
      {
        $set: {
          assignedAssociateId: req.user._id,
        },
        $push: {
          activityLog: {
            timestamp: new Date(),
            actorId: req.user._id,
            actorRole: req.user.role,
            action: 'claimed',
            note: 'Claimed by associate from open pool.',
            fileId: null,
          },
        },
      },
      { new: true }
    )
      .populate('documentTypeId', 'shortName fullName code category')
      .populate('assignedAssociateId', '_id name email role active')
      .populate('orderId', 'trackingCode vin carModel firstName lastName passportNumber address');

    if (!line) {
      const existing = await OrderDocumentLine.findById(lineId).lean();
      if (!existing) {
        return res.status(404).json({ error: 'Document line not found.' });
      }
      if (existing.excludedAssociateIds?.some((exId) => exId.toString() === req.user._id.toString())) {
        return res.status(409).json({ error: 'You have been excluded from this line and cannot claim it.' });
      }
      if (existing.assignedAssociateId) {
        return res.status(409).json({ error: 'This document line was already claimed by another associate.' });
      }
      return res.status(409).json({ error: 'This line is not currently open for claim.' });
    }

    return res.json({
      message: 'Document line successfully claimed.',
      line,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/claim]', err);
    return res.status(500).json({ error: 'Server error claiming document line.' });
  }
});

// ── POST /api/order-lines/:id/acknowledge ────────────────────────────────────
// Associate (or Admin) confirms receipt of delegated/claimed line.
router.post('/:lineId/acknowledge', async (req, res) => {
  try {
    const { lineId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    const isAssigned =
      line.assignedAssociateId &&
      line.assignedAssociateId.toString() === req.user._id.toString();

    if (!isAssigned && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned associate can acknowledge this line.' });
    }

    line.acknowledgedAt = new Date();
    line.acknowledgedBy = req.user._id;
    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'acknowledged',
      note: 'Receipt confirmed by associate.',
      fileId: null,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code category')
      .populate('assignedAssociateId', '_id name email role active')
      .populate('acknowledgedBy', '_id name email role');

    return res.json({
      message: 'Receipt acknowledged successfully.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/acknowledge]', err);
    return res.status(500).json({ error: 'Server error acknowledging document line.' });
  }
});

// ── POST /api/order-lines/:id/revoke ─────────────────────────────────────────
// Admin-only: Revoke associate from a line, exclude them, and reopen line to pool.
router.post('/:lineId/revoke', requireRole('admin'), async (req, res) => {
  try {
    const { lineId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid line ID.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A revocation reason is required.' });
    }

    const line = await OrderDocumentLine.findById(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Document line not found.' });
    }

    if (!line.assignedAssociateId) {
      return res.status(400).json({ error: 'Cannot revoke an unassigned document line.' });
    }

    const formerAssociateId = line.assignedAssociateId;
    line.assignedAssociateId = null;
    line.acknowledgedAt = null;
    line.acknowledgedBy = null;
    line.delegationMode = 'open'; // Reopen to pool for other associates
    line.revokedAt = new Date();
    line.revokedBy = req.user._id;
    line.revocationReason = reason.trim();

    if (!line.excludedAssociateIds) line.excludedAssociateIds = [];
    if (!line.excludedAssociateIds.some((exId) => exId.toString() === formerAssociateId.toString())) {
      line.excludedAssociateIds.push(formerAssociateId);
    }

    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'revoked',
      note: `Revoked from associate: ${reason.trim()}. Reopened to pool.`,
      fileId: null,
    });

    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code category')
      .populate('assignedAssociateId', '_id name email role active')
      .populate('excludedAssociateIds', '_id name email role')
      .populate('revokedBy', '_id name email role');

    return res.json({
      message: 'Line assignment revoked and reopened to pool.',
      line: populated,
    });
  } catch (err) {
    console.error('[POST /api/order-lines/:lineId/revoke]', err);
    return res.status(500).json({ error: 'Server error revoking document line.' });
  }
});

module.exports = router;
