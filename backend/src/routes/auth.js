const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');

// In-memory store fallback when MongoDB is offline
const inMemoryUsers = new Map();

function generateToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, email: user.email, plan: user.plan || 'starter' },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

function safeUser(user) {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  return u;
}

// ─────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('company').trim().notEmpty().withMessage('Company name is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, email, password, company, phone } = req.body;

  try {
    // Try MongoDB first
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

      const user = new User({ name, email, password, company, phone: phone || null });
      user.applyPlanLimits();
      await user.save();

      const token = generateToken(user);
      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: safeUser(user),
        nextStep: 'onboarding'
      });
    }
  } catch (err) {
    console.error('DB error, using in-memory:', err.message);
  }

  // In-memory fallback
  if (inMemoryUsers.has(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const crypto = require('crypto');
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  const user = {
    id: uuidv4(),
    name, email, company, phone: phone || null,
    password: await bcrypt.hash(password, 12),
    plan: 'starter',
    planStatus: 'active',
    apiKey: 'pa_' + crypto.randomBytes(24).toString('hex'),
    isOnboarded: false,
    maxWidgets: 1,
    maxLeadsPerMonth: 50,
    totalLeads: 0,
    monthlyLeads: 0,
    widgetConfig: { agentName: 'PropAgent', primaryColor: '#B8952A', position: 'bottom-right' },
    projectInfo: {},
    createdAt: new Date().toISOString()
  };

  inMemoryUsers.set(email, user);
  const token = generateToken(user);

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: { ...user, password: undefined },
    nextStep: 'onboarding'
  });
});

// ─────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const { email, password } = req.body;

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findOne({ email }).select('+password');
      if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

      const token = generateToken(user);
      return res.json({
        message: 'Logged in successfully',
        token,
        user: safeUser(user),
        nextStep: user.isOnboarded ? 'dashboard' : 'onboarding'
      });
    }
  } catch (err) {
    console.error('DB error:', err.message);
  }

  // In-memory fallback
  const bcrypt = require('bcryptjs');
  const user = inMemoryUsers.get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

  const token = generateToken(user);
  res.json({
    message: 'Logged in successfully',
    token,
    user: { ...user, password: undefined },
    nextStep: user.isOnboarded ? 'dashboard' : 'onboarding'
  });
});

// ─────────────────────────────────────────────────
// GET /api/auth/me — Get current user
// ─────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: safeUser(user) });
    }
  } catch {}

  // In-memory fallback
  for (const [, u] of inMemoryUsers) {
    if (u.id === req.userId) return res.json({ user: { ...u, password: undefined } });
  }
  res.status(404).json({ error: 'User not found' });
});

// ─────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  // With JWT, logout is handled client-side (delete token)
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;