const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const DocumentType = require('../models/DocumentType');
const CarCategory = require('../models/CarCategory');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// ── GET /api/orders ───────────────────────────────────────────────────────────
// List orders filtered by status (default all), basic fields + lineCount
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { trackingCode: regex },
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { vin: regex },
      ];
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('carCategoryId', 'name')
      .lean();

    // Compute line count per order
    const orderIds = orders.map((o) => o._id);
    const lineCounts = await OrderDocumentLine.aggregate([
      { $match: { orderId: { $in: orderIds } } },
      { $group: { _id: '$orderId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map();
    lineCounts.forEach((lc) => countMap.set(lc._id.toString(), lc.count));

    const result = orders.map((o) => ({
      _id: o._id,
      trackingCode: o.trackingCode,
      orderType: o.orderType,
      isCorrection: Boolean(o.isCorrection),
      parentOrderId: o.parentOrderId || o.linkedOrderId || null,
      linkedOrderId: o.linkedOrderId || o.parentOrderId || null,
      status: o.status,
      firstName: o.firstName,
      lastName: o.lastName,
      clientName: `${o.firstName} ${o.lastName}`.trim(),
      phone: o.phone,
      wilaya: o.wilaya,
      vin: o.vin,
      carModel: o.carModel,
      carCategoryName: o.carCategoryId?.name || '—',
      createdAt: o.createdAt,
      lineCount: countMap.get(o._id.toString()) || 0,
      rejectionReason: o.rejectionReason || null,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return res.status(500).json({ error: 'Server error fetching orders.' });
  }
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
// Full order detail for admin: populated lines, prices, linked/parent order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id)
      .populate('carCategoryId', 'name')
      .populate('parentOrderId', 'trackingCode firstName lastName status createdAt')
      .populate('linkedOrderId', 'trackingCode firstName lastName status createdAt')
      .populate('confirmedBy', 'name email role')
      .populate('rejectedBy', 'name email role')
      .populate('completedBy', 'name email role')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const lines = await OrderDocumentLine.find({ orderId: order._id })
      .populate({
        path: 'documentTypeId',
        select: '_id shortName fullName code category defaultSource hasTranslation pricing active',
      })
      .populate('assignedAssociateId', '_id name email role active')
      .populate('acknowledgedBy', '_id name email role')
      .populate('excludedAssociateIds', '_id name email role')
      .populate('revokedBy', '_id name email role')
      .populate({
        path: 'parentLineId',
        select: '_id status documentTypeId correctionReason clientPrice',
      })
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      ...order,
      lines,
    });
  } catch (err) {
    console.error('[GET /api/orders/:id]', err);
    return res.status(500).json({ error: 'Server error fetching order details.' });
  }
});

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
// Hard-delete allowed ONLY when status === 'pending', cascades to OrderDocumentLines
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot delete order with status "${order.status}". Only pending orders can be deleted.`,
      });
    }

    // Cascade delete lines
    const deletedLines = await OrderDocumentLine.deleteMany({ orderId: order._id });
    await Order.findByIdAndDelete(order._id);

    return res.json({
      message: 'Order and associated document lines deleted successfully.',
      deletedLinesCount: deletedLines.deletedCount,
      orderId: order._id,
    });
  } catch (err) {
    console.error('[DELETE /api/orders/:id]', err);
    return res.status(500).json({ error: 'Server error deleting order.' });
  }
});

// ── PATCH /api/orders/:id/confirm ─────────────────────────────────────────────
// Admin confirmation: edit lines, then confirm. No source or assignee gates.
router.patch('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        error: `Only orders with status "pending" can be confirmed. Current status: "${order.status}".`,
      });
    }

    const { removeLineIds, addLineItems, lineUpdates } = req.body;

    // 1. Remove specific lines if requested
    if (Array.isArray(removeLineIds) && removeLineIds.length > 0) {
      const validRemoveIds = removeLineIds.filter((lid) => mongoose.Types.ObjectId.isValid(lid));
      if (validRemoveIds.length > 0) {
        await OrderDocumentLine.deleteMany({
          _id: { $in: validRemoveIds },
          orderId: order._id,
        });
      }
    }

    // 2. Add new document lines if requested
    if (Array.isArray(addLineItems) && addLineItems.length > 0) {
      for (const item of addLineItems) {
        const { documentTypeId, translationMode, source } = item || {};
        if (!documentTypeId || !mongoose.Types.ObjectId.isValid(documentTypeId)) {
          return res.status(400).json({ error: `Invalid document type ID: ${documentTypeId}` });
        }

        const doc = await DocumentType.findOne({ _id: documentTypeId, active: true });
        if (!doc) {
          return res.status(400).json({ error: `Document type not found or inactive: ${documentTypeId}` });
        }

        const tMode = translationMode || 'original_only';
        if (!['original_only', 'original_plus_translation', 'translation_only'].includes(tMode)) {
          return res.status(400).json({ error: `Invalid translation mode: ${tMode}` });
        }

        if (!doc.hasTranslation && tMode !== 'original_only') {
          return res.status(400).json({
            error: `Document "${doc.shortName}" does not offer translation services.`,
          });
        }

        let clientPrice = null;
        let costPrice = null;
        if (tMode === 'original_only') {
          clientPrice = doc.pricing?.originalOnly?.clientPrice;
          costPrice = doc.pricing?.originalOnly?.costPrice;
        } else if (tMode === 'original_plus_translation') {
          clientPrice = doc.pricing?.originalPlusTranslation?.clientPrice;
          costPrice = doc.pricing?.originalPlusTranslation?.costPrice;
        } else if (tMode === 'translation_only') {
          clientPrice = doc.pricing?.translationOnly?.clientPrice;
          costPrice = doc.pricing?.translationOnly?.costPrice;
        }

        let lineSource = source;
        if (!lineSource) {
          if (doc.defaultSource === 'local') lineSource = 'local';
          else if (doc.defaultSource === 'china') lineSource = 'china';
          else lineSource = null;
        }

        await OrderDocumentLine.create({
          orderId: order._id,
          documentTypeId: doc._id,
          translationMode: tMode,
          clientPrice: clientPrice ?? 0,
          costPrice: costPrice ?? 0,
          source: lineSource,
          status: 'needed',
        });
      }
    }

    // 3. Update line sources or attributes if requested
    // 3. Update line sources or attributes if requested
    if (Array.isArray(lineUpdates) && lineUpdates.length > 0) {
      for (const update of lineUpdates) {
        const { lineId, source, associateId, chinaAccountId } = update || {};
        if (lineId && mongoose.Types.ObjectId.isValid(lineId)) {
          const updateFields = {};
          if (source !== undefined) {
            if (source !== null && !['local', 'china'].includes(source)) {
              return res.status(400).json({ error: `Invalid source "${source}". Must be "local" or "china".` });
            }
            updateFields.source = source;
          }

          const { delegationMode: updateDelegationMode } = update || {};
          if (updateDelegationMode === 'open') {
            updateFields.delegationMode = 'open';
            updateFields.assignedAssociateId = null;
            updateFields.acknowledgedAt = null;
            updateFields.acknowledgedBy = null;
          } else {
            const targetAccountId = associateId !== undefined ? associateId : chinaAccountId;
            if (targetAccountId !== undefined) {
              if (targetAccountId) {
                if (!mongoose.Types.ObjectId.isValid(targetAccountId)) {
                  return res.status(400).json({ error: `Invalid associate user ID: ${targetAccountId}` });
                }
                const associate = await User.findOne({ _id: targetAccountId, active: true });
                if (!associate) {
                  return res.status(400).json({ error: 'Target user not found or inactive.' });
                }
                const lineDoc = await OrderDocumentLine.findOne({ _id: lineId, orderId: order._id });
                if (lineDoc && (lineDoc.excludedAssociateIds || []).some(id => id.toString() === associate._id.toString())) {
                  return res.status(400).json({
                    error: `Associate "${associate.name}" is excluded from this document line and cannot be assigned.`,
                  });
                }
                updateFields.assignedAssociateId = associate._id;
                updateFields.delegationMode = 'specific';
              } else {
                updateFields.assignedAssociateId = null;
                updateFields.delegationMode = 'none';
              }
            }
          }

          if (Object.keys(updateFields).length > 0) {
            await OrderDocumentLine.findOneAndUpdate(
              { _id: lineId, orderId: order._id },
              { $set: updateFields }
            );
          }
        }
      }
    }

    // 4. Validate: at least one line must exist
    const remainingLines = await OrderDocumentLine.find({ orderId: order._id })
      .populate('documentTypeId', 'shortName')
      .lean();

    if (remainingLines.length === 0) {
      return res.status(400).json({
        error: 'Cannot confirm order: An order must have at least one document line.',
      });
    }

    // Source and assignee are now optional at confirm time — no gate here.

    // 5. Transition order to 'confirmed'
    order.status = 'confirmed';
    order.confirmedBy = req.user._id;
    order.confirmedAt = new Date();
    await order.save();

    const fullyPopulatedLines = await OrderDocumentLine.find({ orderId: order._id })
      .populate('documentTypeId', 'shortName fullName code category defaultSource')
      .populate('assignedAssociateId', '_id name email role active')
      .populate('acknowledgedBy', '_id name email role')
      .populate('excludedAssociateIds', '_id name email role')
      .populate('revokedBy', '_id name email role')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      })
      .lean();

    return res.json({
      message: 'Order successfully confirmed.',
      order: {
        ...order.toObject(),
        lines: fullyPopulatedLines,
      },
    });
  } catch (err) {
    console.error('[PATCH /api/orders/:id/confirm]', err);
    return res.status(500).json({ error: 'Server error confirming order.' });
  }
});

// ── PATCH /api/orders/:orderId/lines/:lineId/assign ───────────────────────────
// Admin-only: Delegates an associate to a specific document line, or opens it to pool.
router.patch('/:orderId/lines/:lineId/assign', async (req, res) => {
  try {
    const { orderId, lineId } = req.params;
    const { associateId, chinaAccountId, delegationMode } = req.body;
    const targetId = associateId !== undefined ? associateId : chinaAccountId;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid order ID or line ID.' });
    }

    const line = await OrderDocumentLine.findOne({ _id: lineId, orderId });
    if (!line) {
      return res.status(404).json({ error: 'Order document line not found.' });
    }

    // Check if open pool delegation requested
    if (delegationMode === 'open') {
      line.delegationMode = 'open';
      line.assignedAssociateId = null;
      line.acknowledgedAt = null;
      line.acknowledgedBy = null;
      line.activityLog.push({
        timestamp: new Date(),
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'delegated_open',
        note: 'Opened line to China associate pool.',
        fileId: null,
      });
      await line.save();

      const populated = await OrderDocumentLine.findById(line._id)
        .populate('documentTypeId', 'shortName fullName code category defaultSource')
        .populate('assignedAssociateId', '_id name email role active')
        .populate('acknowledgedBy', '_id name email role')
        .populate('excludedAssociateIds', '_id name email role')
        .populate('revokedBy', '_id name email role');

      return res.json({
        message: 'Line opened to China associate pool.',
        line: populated,
      });
    }

    let assigneeId = null;
    if (targetId) {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ error: 'Invalid associate user ID.' });
      }

      if (line.excludedAssociateIds && line.excludedAssociateIds.some((id) => id.toString() === targetId.toString())) {
        return res.status(400).json({ error: 'This associate was previously revoked from this line and cannot be assigned again.' });
      }

      const associate = await User.findOne({ _id: targetId, active: true });
      if (!associate) {
        return res.status(400).json({ error: 'User not found or inactive.' });
      }
      assigneeId = associate._id;
      line.delegationMode = 'specific';
    } else {
      line.delegationMode = 'none';
    }

    line.assignedAssociateId = assigneeId;
    line.acknowledgedAt = null;
    line.acknowledgedBy = null;
    line.activityLog.push({
      timestamp: new Date(),
      actorId: req.user._id,
      actorRole: req.user.role,
      action: assigneeId ? 'assigned' : 'unassigned',
      note: assigneeId ? 'Assigned to associate.' : 'Assignment cleared.',
      fileId: null,
    });
    await line.save();

    const populated = await OrderDocumentLine.findById(line._id)
      .populate('documentTypeId', 'shortName fullName code category defaultSource')
      .populate('assignedAssociateId', '_id name email role active')
      .populate('acknowledgedBy', '_id name email role')
      .populate('excludedAssociateIds', '_id name email role')
      .populate('revokedBy', '_id name email role');

    return res.json({
      message: 'Line assignment updated.',
      line: populated,
    });
  } catch (err) {
    console.error('[PATCH /api/orders/:orderId/lines/:lineId/assign]', err);
    return res.status(500).json({ error: 'Server error updating line assignment.' });
  }
});

// ── POST /api/orders/:id/package ─────────────────────────────────────────────
// Admin-only. Valid only when order.status === 'ready_for_dispatch'.
// Order → 'packaged'. All lines → 'packaged'.
router.post('/:id/package', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'ready_for_dispatch') {
      return res.status(400).json({
        error: `Cannot package order: required status is "ready_for_dispatch". Current status: "${order.status}".`,
      });
    }

    order.status = 'packaged';
    await order.save();

    await OrderDocumentLine.updateMany(
      { orderId: order._id },
      { $set: { status: 'packaged' } }
    );

    return res.json({
      message: 'Order and all document lines marked as packaged.',
      orderId: order._id,
      orderStatus: order.status,
    });
  } catch (err) {
    console.error('[POST /api/orders/:id/package]', err);
    return res.status(500).json({ error: 'Server error packaging order.' });
  }
});

// ── POST /api/orders/:id/dispatch ────────────────────────────────────────────
// Admin-only. Valid only when order.status === 'packaged'.
// Order → 'sent_to_client'. All lines → 'sent_to_client'.
router.post('/:id/dispatch', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'packaged') {
      return res.status(400).json({
        error: `Cannot dispatch order: required status is "packaged". Current status: "${order.status}".`,
      });
    }

    order.status = 'sent_to_client';
    await order.save();

    await OrderDocumentLine.updateMany(
      { orderId: order._id },
      { $set: { status: 'sent_to_client' } }
    );

    return res.json({
      message: 'Order dispatched — all document lines marked as sent to client.',
      orderId: order._id,
      orderStatus: order.status,
    });
  } catch (err) {
    console.error('[POST /api/orders/:id/dispatch]', err);
    return res.status(500).json({ error: 'Server error dispatching order.' });
  }
});

// ── POST /api/orders/:id/deliver ─────────────────────────────────────────────
// Admin-only. Valid only when order.status === 'sent_to_client'.
// Order → 'delivered'. Set deliveredAt. All lines → 'delivered'.
router.post('/:id/deliver', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'sent_to_client') {
      return res.status(400).json({
        error: `Cannot mark delivered: required status is "sent_to_client". Current status: "${order.status}".`,
      });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();

    await OrderDocumentLine.updateMany(
      { orderId: order._id },
      { $set: { status: 'delivered' } }
    );

    return res.json({
      message: 'Order marked as delivered — all document lines updated.',
      orderId: order._id,
      orderStatus: order.status,
      deliveredAt: order.deliveredAt,
    });
  } catch (err) {
    console.error('[POST /api/orders/:id/deliver]', err);
    return res.status(500).json({ error: 'Server error marking order as delivered.' });
  }
});

// ── POST /api/orders/:id/reject ──────────────────────────────────────────────
// Admin-only. Valid ONLY on isCorrection=true orders at status === 'pending'.
// Moves order to 'rejected', stores reason, and is terminal.
// Does NOT touch parent order or its lines in any way.
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Scoped strictly to correction orders per Phase 7 specification
    if (!order.isCorrection) {
      return res.status(400).json({
        error: 'Reject route is only valid for correction orders.',
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        error: `Only pending correction orders can be rejected. Current status: "${order.status}".`,
      });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        error: 'A rejection reason is required when rejecting a correction claim.',
      });
    }

    order.status = 'rejected';
    order.rejectionReason = reason.trim();
    order.rejectedBy = req.user._id;
    order.rejectedAt = new Date();
    await order.save();

    return res.json({
      message: 'Correction order rejected.',
      orderId: order._id,
      orderStatus: order.status,
      rejectionReason: order.rejectionReason,
      rejectedAt: order.rejectedAt,
    });
  } catch (err) {
    console.error('[POST /api/orders/:id/reject]', err);
    return res.status(500).json({ error: 'Server error rejecting correction order.' });
  }
});

// ── POST /api/orders/:id/complete ────────────────────────────────────────────
// Admin-only. Reachable ONLY from 'delivered'.
// Represents payment confirmed by phone call (not client self-service).
// Applies to both normal and correction orders identically. Terminal status.
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        error: `Cannot complete order: required status is "delivered". Current status: "${order.status}".`,
      });
    }

    order.status = 'completed';
    order.completedBy = req.user._id;
    order.completedAt = new Date();
    await order.save();

    return res.json({
      message: 'Order marked as completed.',
      orderId: order._id,
      orderStatus: order.status,
      completedAt: order.completedAt,
    });
  } catch (err) {
    console.error('[POST /api/orders/:id/complete]', err);
    return res.status(500).json({ error: 'Server error completing order.' });
  }
});

module.exports = router;
