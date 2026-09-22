const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All user management routes are admin-only
router.use(requireAuth, requireRole('admin'));

/**
 * POST /api/users
 * Admin-only. Creates a new user (admin or china_associate).
 * Sets createdBy to the requesting admin's ID.
 * There is NO public registration route.
 */
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are all required.' });
  }

  if (!['admin', 'china_associate'].includes(role)) {
    return res.status(400).json({ error: 'Role must be one of: admin, china_associate.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return res.status(500).json({ error: 'Server error while creating user.' });
  }
});

/**
 * GET /api/users
 * Admin-only. Lists all users.
 * Never returns passwordHash.
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    const users = await User.find(filter)
      .select('-passwordHash')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (err) {
    console.error('[GET /api/users]', err);
    return res.status(500).json({ error: 'Server error while fetching users.' });
  }
});

/**
 * PATCH /api/users/:id
 * Admin-only. Updates name, email, active status, or role.
 * An admin cannot change their own role (prevents self-demotion).
 * Password changes intentionally not supported here — future phase.
 */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, active, role } = req.body;

  // Prevent an admin from changing their own role
  if (role !== undefined && id === req.user._id.toString()) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }

  if (role !== undefined && !['admin', 'china_associate'].includes(role)) {
    return res.status(400).json({ error: 'Role must be one of: admin, china_associate.' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.toLowerCase().trim();
  if (active !== undefined) updates.active = Boolean(active);
  if (role !== undefined) updates.role = role;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    console.error('[PATCH /api/users/:id]', err);
    return res.status(500).json({ error: 'Server error while updating user.' });
  }
});

module.exports = router;
