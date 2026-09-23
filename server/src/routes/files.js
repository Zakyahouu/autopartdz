const express = require('express');
const mongoose = require('mongoose');
const File = require('../models/File');
const OrderDocumentLine = require('../models/OrderDocumentLine');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/files/:id
 * Serves the raw file bytes with the correct Content-Type header.
 *
 * Access control:
 * - admin: full access to all files
 * - china_associate: access to files they uploaded or files attached to lines assigned to them
 */
router.get('/:id', requireAuth, requireRole('admin', 'china_associate'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const file = await File.findById(id);
    if (!file) return res.status(404).json({ error: 'File not found.' });

    if (req.user.role === 'china_associate') {
      const isUploader = file.uploadedByUserId && file.uploadedByUserId.toString() === req.user._id.toString();
      let hasLineAccess = false;
      if (!isUploader) {
        hasLineAccess = await OrderDocumentLine.exists({
          assignedAssociateId: req.user._id,
          uploadedFiles: file._id,
        });
      }

      if (!isUploader && !hasLineAccess) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to view this file.' });
      }
    }

    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    res.set('Content-Length', file.size);
    return res.send(file.data);
  } catch (err) {
    console.error('[GET /api/files/:id]', err);
    return res.status(500).json({ error: 'Server error serving file.' });
  }
});

module.exports = router;

