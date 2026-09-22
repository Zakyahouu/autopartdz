const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * GET /api/health
 * Public — no authentication required.
 * Returns server status AND a real MongoDB connectivity check (not just the
 * connection object's state flag — it performs a trivial live query).
 */
router.get('/', async (req, res) => {
  let mongoStatus = 'disconnected';
  let mongoError = null;

  try {
    // Perform an actual query rather than trusting mongoose.connection.readyState
    await mongoose.connection.db.admin().ping();
    mongoStatus = 'connected';
  } catch (err) {
    mongoError = err.message;
  }

  const status = mongoStatus === 'connected' ? 'ok' : 'degraded';
  const httpStatus = status === 'ok' ? 200 : 503;

  return res.status(httpStatus).json({
    status,
    mongo: mongoStatus,
    ...(mongoError && { mongoError }),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
