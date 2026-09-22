const express = require('express');
const mongoose = require('mongoose');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('china_associate', 'admin'));

/**
 * GET /api/china/lines
 * Returns lines assigned to the authenticated China associate (or filtered by associateId if admin).
 * STRICT ALLOWLIST: NEVER leaks clientPrice, costPrice, wilaya, address, phone, or any contact fields!
 */
router.get('/lines', async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'china_associate') {
      filter.assignedChinaAccountId = req.user._id;
    } else if (req.user.role === 'admin') {
      if (req.query.associateId && mongoose.Types.ObjectId.isValid(req.query.associateId)) {
        filter.assignedChinaAccountId = req.query.associateId;
      } else {
        filter.source = 'china';
      }
    }

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const lines = await OrderDocumentLine.find(filter)
      .populate('documentTypeId', '_id shortName fullName code')
      .populate('orderId', 'vin carModel')
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
          vin: order.vin || '',
          carModel: order.carModel || '',
        },
        status: line.status,
        shippingTrackingCode: line.shippingTrackingCode || null,
        isDelayed: Boolean(line.isDelayed),
        createdAt: line.createdAt,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('[GET /api/china/lines]', err);
    return res.status(500).json({ error: 'Server error fetching China lines queue.' });
  }
});

module.exports = router;
