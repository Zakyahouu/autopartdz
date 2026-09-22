const express = require('express');
const File = require('../models/File');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/files/:id
 * Serves the raw file bytes with the correct Content-Type header.
 *
 * Access control: admin-only in this phase.
 * Later phases will introduce per-role logic (e.g. china_associate seeing
 * their own uploaded files). Do NOT add that logic here yet — gate it
 * correctly for what exists today.
 */
router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found.' });

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
