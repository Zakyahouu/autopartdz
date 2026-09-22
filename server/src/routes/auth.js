const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Public. Authenticates a user (admin or china_associate) and returns a JWT.
 * Clients never log in — this endpoint is for internal roles only.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Use a generic message to avoid email enumeration
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * GET /api/auth/me
 * Requires auth. Returns the current authenticated user's profile.
 * Never returns passwordHash.
 */
router.get('/me', requireAuth, (req, res) => {
  const { _id, name, email, role, active, createdAt } = req.user;
  return res.json({ id: _id, name, email, role, active, createdAt });
});

module.exports = router;
