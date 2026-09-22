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
      linkedOrderId: o.linkedOrderId,
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
    }));

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return res.status(500).json({ error: 'Server error fetching orders.' });
  }
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
// Full order detail for admin: populated lines, prices, linked order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id)
      .populate('carCategoryId', 'name')
      .populate('linkedOrderId', 'trackingCode firstName lastName status createdAt')
      .populate('confirmedBy', 'name email role')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const lines = await OrderDocumentLine.find({ orderId: order._id })
      .populate({
        path: 'documentTypeId',
        select: '_id shortName fullName code category defaultSource hasTranslation pricing active',
      })
      .populate('assignedChinaAccountId', '_id name email role active')
      .populate('uploadedFiles', '_id filename contentType size uploadedAt')
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
        error: `Cannot delete order with status "${order.status}". Confirmed orders cannot be deleted; they must be managed via status update/cancellation.`,
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
// Admin confirmation: edit lines, update sources, validate non-null source before confirm
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
        const { lineId, source, assignedChinaAccountId, chinaAccountId } = update || {};
        if (lineId && mongoose.Types.ObjectId.isValid(lineId)) {
          const updateFields = {};
          if (source !== undefined) {
            if (source !== null && !['local', 'china'].includes(source)) {
              return res.status(400).json({ error: `Invalid source "${source}". Must be "local" or "china".` });
            }
            updateFields.source = source;
          }

          const targetAccountId = assignedChinaAccountId !== undefined ? assignedChinaAccountId : chinaAccountId;
          if (targetAccountId !== undefined) {
            if (targetAccountId) {
              if (!mongoose.Types.ObjectId.isValid(targetAccountId)) {
                return res.status(400).json({ error: `Invalid China associate user ID: ${targetAccountId}` });
              }
              const associate = await User.findOne({ _id: targetAccountId, role: 'china_associate', active: true });
              if (!associate) {
                return res.status(400).json({ error: 'Target user is not an active China associate.' });
              }
              updateFields.assignedChinaAccountId = associate._id;
            } else {
              updateFields.assignedChinaAccountId = null;
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

    // 4. Validate all remaining lines on this order
    const remainingLines = await OrderDocumentLine.find({ orderId: order._id })
      .populate('documentTypeId', 'shortName')
      .lean();

    if (remainingLines.length === 0) {
      return res.status(400).json({
        error: 'Cannot confirm order: An order must have at least one document line.',
      });
    }

    // Check that EVERY line has a non-null source
    const linesMissingSource = remainingLines.filter((l) => !l.source);
    if (linesMissingSource.length > 0) {
      const missingDetails = linesMissingSource.map(
        (l) => l.documentTypeId?.shortName || l._id.toString()
      );
      return res.status(400).json({
        error: `Cannot confirm order: All document lines must have a valid source ("local" or "china"). ${linesMissingSource.length} line(s) missing source: ${missingDetails.join(', ')}.`,
        missingLineIds: linesMissingSource.map((l) => l._id),
      });
    }

    // Check that EVERY china-source line has an assignedChinaAccountId
    const chinaLinesMissingAssignee = remainingLines.filter(
      (l) => l.source === 'china' && !l.assignedChinaAccountId
    );
    if (chinaLinesMissingAssignee.length > 0) {
      const missingDetails = chinaLinesMissingAssignee.map(
        (l) => l.documentTypeId?.shortName || l._id.toString()
      );
      return res.status(400).json({
        error: `Cannot confirm order: All China-sourced document lines must be assigned to an active China associate. ${chinaLinesMissingAssignee.length} line(s) missing assignment: ${missingDetails.join(', ')}.`,
        missingLineIds: chinaLinesMissingAssignee.map((l) => l._id),
      });
    }

    // 5. Transition order to 'confirmed'
    order.status = 'confirmed';
    order.confirmedBy = req.user._id;
    order.confirmedAt = new Date();
    await order.save();

    const fullyPopulatedLines = await OrderDocumentLine.find({ orderId: order._id })
      .populate('documentTypeId', 'shortName fullName code category defaultSource')
      .populate('assignedChinaAccountId', '_id name email role active')
      .populate('uploadedFiles', '_id filename contentType size uploadedAt')
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
// Admin-only: Assigns a China associate to a specific document line
router.patch('/:orderId/lines/:lineId/assign', async (req, res) => {
  try {
    const { orderId, lineId } = req.params;
    const { chinaAccountId, assignedChinaAccountId } = req.body;
    const targetId = chinaAccountId !== undefined ? chinaAccountId : assignedChinaAccountId;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: 'Invalid order ID or line ID.' });
    }

    let assigneeId = null;
    if (targetId) {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ error: 'Invalid China associate ID.' });
      }
      const associate = await User.findOne({ _id: targetId, role: 'china_associate', active: true });
      if (!associate) {
        return res.status(400).json({ error: 'Target user is not an active China associate.' });
      }
      assigneeId = associate._id;
    }

    const line = await OrderDocumentLine.findOneAndUpdate(
      { _id: lineId, orderId },
      { $set: { assignedChinaAccountId: assigneeId } },
      { new: true }
    )
      .populate('documentTypeId', 'shortName fullName code category defaultSource')
      .populate('assignedChinaAccountId', '_id name email role active');

    if (!line) {
      return res.status(404).json({ error: 'Order document line not found.' });
    }

    return res.json({
      message: 'Line assignment updated successfully.',
      line,
    });
  } catch (err) {
    console.error('[PATCH /api/orders/:orderId/lines/:lineId/assign]', err);
    return res.status(500).json({ error: 'Server error updating line assignment.' });
  }
});

module.exports = router;
