const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * requireAuth — validates a Bearer JWT from the Authorization header.
 * Attaches the full user document (minus passwordHash) to req.user.
 * Returns 401 if missing/invalid, 403 if the user account is inactive.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error during authentication.' });
  }
};

/**
 * requireRole(...roles) — factory that returns middleware restricting
 * access to users whose role is in the provided list.
 * Must be used AFTER requireAuth so that req.user is populated.
 *
 * Usage:
 *   router.get('/admin-only', requireAuth, requireRole('admin'), handler)
 *   router.get('/multi',      requireAuth, requireRole('admin', 'china_associate'), handler)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // Safety net — requireAuth should always run first
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };
