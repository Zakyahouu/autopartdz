const express = require('express');
const mongoose = require('mongoose');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('china_associate', 'admin'));

/**
 * GET /api/china/lines
 * Returns lines delegated to the authenticated associate or available in the open pool,
 * where status is 'needed' or 'attached'.
 * Supports ?view=mine | open | all.
 * Admin can supply ?associateId to view another associate's queue.
 *
 * NARROW ALLOWLIST (explicit Phase 9 policy reversal):
 * Includes: firstName, lastName, passportNumber, address, vin, carModel needed for physical document fulfillment.
 * EXCLUDED: Customer phone, email, and financial pricing (clientPrice, costPrice) must NEVER be leaked.
 */
router.get('/lines', async (req, res) => {
  try {
    const { view, associateId } = req.query;
    let filter = {};

    if (req.user.role === 'china_associate') {
      if (view === 'open') {
        filter = {
          status: 'needed',
          delegationMode: 'open',
          assignedAssociateId: null,
          excludedAssociateIds: { $ne: req.user._id },
        };
      } else if (view === 'mine') {
        filter = {
          status: { $in: ['needed', 'attached'] },
          assignedAssociateId: req.user._id,
        };
      } else {
        // Default: My assigned/claimed lines + unclaimed open pool lines (not excluded)
        filter = {
          status: { $in: ['needed', 'attached'] },
          $or: [
            { assignedAssociateId: req.user._id },
            {
              status: 'needed',
              delegationMode: 'open',
              assignedAssociateId: null,
              excludedAssociateIds: { $ne: req.user._id },
            },
          ],
        };
      }
    } else if (req.user.role === 'admin') {
      if (view === 'open') {
        filter = {
          status: 'needed',
          delegationMode: 'open',
          assignedAssociateId: null,
        };
      } else if (associateId && mongoose.Types.ObjectId.isValid(associateId)) {
        filter = {
          status: { $in: ['needed', 'attached'] },
          assignedAssociateId: associateId,
        };
      } else {
        // Admin default: all delegated lines + open pool
        filter = {
          status: { $in: ['needed', 'attached'] },
          $or: [
            { assignedAssociateId: { $ne: null } },
            { delegationMode: 'open' },
          ],
        };
      }
    }

    const lines = await OrderDocumentLine.find(filter)
      .populate('documentTypeId', '_id shortName fullName code category')
      .populate('assignedAssociateId', '_id name email role')
      .populate('acknowledgedBy', '_id name email role')
      .populate('orderId', 'trackingCode vin carModel firstName lastName passportNumber address')
      .populate({
        path: 'uploadedFiles',
        select: '_id filename contentType size uploadedAt uploadedByUserId',
        populate: { path: 'uploadedByUserId', select: '_id name email role' },
      })
      .sort({ createdAt: -1 })
      .lean();

    // NARROW ALLOWLIST MAPPING
    const result = lines.map((line) => {
      const doc = line.documentTypeId || {};
      const order = line.orderId || {};
      const isMine =
        line.assignedAssociateId &&
        (line.assignedAssociateId._id?.toString() === req.user._id.toString() ||
          line.assignedAssociateId.toString() === req.user._id.toString());
      const isExcluded = (line.excludedAssociateIds || []).some(
        (exId) => exId.toString() === req.user._id.toString()
      );
      const isClaimable =
        line.delegationMode === 'open' &&
        !line.assignedAssociateId &&
        !isExcluded;

      return {
        id: line._id.toString(),
        documentType: {
          id: doc._id ? doc._id.toString() : null,
          fullName: doc.fullName || doc.shortName || 'Document',
          code: doc.code || '',
          category: doc.category || '',
        },
        translationMode: line.translationMode,
        order: {
          trackingCode: order.trackingCode || '',
          vin: order.vin || '',
          carModel: order.carModel || '',
          firstName: order.firstName || '',
          lastName: order.lastName || '',
          passportNumber: order.passportNumber || '',
          address: order.address || '',
        },
        status: line.status,
        trackingCode: line.trackingCode || null,
        delegationMode: line.delegationMode || 'none',
        assignedAssociate: line.assignedAssociateId
          ? {
              id: line.assignedAssociateId._id?.toString() || line.assignedAssociateId.toString(),
              name: line.assignedAssociateId.name || 'Associate',
              email: line.assignedAssociateId.email || '',
            }
          : null,
        acknowledgedAt: line.acknowledgedAt || null,
        acknowledgedBy: line.acknowledgedBy
          ? {
              id: line.acknowledgedBy._id?.toString() || line.acknowledgedBy.toString(),
              name: line.acknowledgedBy.name || 'User',
            }
          : null,
        isAcknowledged: Boolean(line.acknowledgedAt),
        isClaimable,
        isMine,
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
