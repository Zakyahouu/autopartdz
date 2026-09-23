const express = require('express');
const mongoose = require('mongoose');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('china_associate', 'admin'));

/**
 * GET /api/china/lines
 * Returns lines delegated to the authenticated associate where status is
 * 'needed' or 'attached' (the two states requiring action or awaiting review).
 * Admin can supply ?associateId to view another associate's queue.
 *
 * STRICT ALLOWLIST: NEVER leaks clientPrice, costPrice, address, phone,
 * or full client details.
 */
router.get('/lines', async (req, res) => {
  try {
    const filter = {
      status: { $in: ['needed', 'attached'] },
    };

    if (req.user.role === 'china_associate') {
      filter.assignedAssociateId = req.user._id;
    } else if (req.user.role === 'admin') {
      if (req.query.associateId && mongoose.Types.ObjectId.isValid(req.query.associateId)) {
        filter.assignedAssociateId = req.query.associateId;
      } else {
        // Admin without filter: all delegated lines in action-required states
        filter.assignedAssociateId = { $ne: null };
      }
    }

    const lines = await OrderDocumentLine.find(filter)
      .populate('documentTypeId', '_id shortName fullName code')
      .populate('assignedAssociateId', '_id name email role')
      .populate('orderId', 'trackingCode vin carModel')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      })
      .sort({ createdAt: -1 })
      .lean();

    // STRICT ALLOWLIST MAPPING
    const result = lines.map((line) => {
      const doc = line.documentTypeId || {};
      const order = line.orderId || {};

      return {
        id: line._id.toString(),
        documentType: {
          id: doc._id ? doc._id.toString() : null,
          fullName: doc.fullName || doc.shortName || 'Document',
          code: doc.code || '',
        },
        translationMode: line.translationMode,
        order: {
          trackingCode: order.trackingCode || '',
          vin: order.vin || '',
          carModel: order.carModel || '',
        },
        status: line.status,
        trackingCode: line.trackingCode || null,
        // Rejection info — shown to associate so they know what to fix
        lastRejectionNote: line.lastRejectionNote || null,
        rejectedAt: line.rejectedAt || null,
        uploadedFiles: (line.uploadedFiles || []).map((f) => ({
          id: f._id ? f._id.toString() : f.toString(),
          filename: f.filename || 'Document',
          contentType: f.contentType || '',
          size: f.size || 0,
          uploadedAt: f.uploadedAt || null,
          uploadedBy: f.uploadedByUserId
            ? {
                name: f.uploadedByUserId.name || 'User',
                role: f.uploadedByUserId.role || '',
              }
            : null,
        })),
        createdAt: line.createdAt,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/china/lines]', err);
    return res.status(500).json({ error: 'Server error fetching delegated lines queue.' });
  }
});

module.exports = router;
