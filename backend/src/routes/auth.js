// backend/src/routes/auth.js
const express     = require('express');
const router      = express.Router();
const { body, validationResult } = require('express-validator');
const authService  = require('../services/authService');
const tokenService = require('../services/tokenService');
const { authMiddleware } = require('../middleware/auth');
const User         = require('../models/User');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Strict rate limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Too many requests — try again in 15 minutes' },
  standardHeaders: true,
});

// ── POST /api/auth/register ────────────────────────────────────────────────────
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('company').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { name, email, password, company, phone } = req.body;
    const user = await authService.register({ name, email, password, company, phone });

    const accessToken = tokenService.signAccessToken(user);
    const { rawToken } = await tokenService.issueRefreshToken(user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    tokenService.setRefreshCookie(res, rawToken);

    await authService.auditLog(user._id, 'REGISTER', req);

    res.status(201).json({
      message: 'Account created',
      accessToken,
      user: _safeUser(user),
      nextStep: 'onboarding',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { email, password } = req.body;
    const user = await authService.login({ email, password });

    const accessToken = tokenService.signAccessToken(user);
    const { rawToken } = await tokenService.issueRefreshToken(user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    tokenService.setRefreshCookie(res, rawToken);

    await authService.auditLog(user._id, 'LOGIN', req);

    res.json({
      message: 'Logged in',
      accessToken,
      user: _safeUser(user),
      nextStep: user.isOnboarded ? 'dashboard' : 'onboarding',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
// Called silently by the frontend when an access token expires
router.post('/refresh', async (req, res) => {
  try {
    const rawToken = tokenService.getRefreshFromCookie(req)
      || req.body.refreshToken; // allow body fallback for non-cookie clients

    if (!rawToken) return res.status(401).json({ error: 'Refresh token missing', code: 'NO_REFRESH_TOKEN' });

    const { accessToken, refreshToken: newRaw, user } = await tokenService.rotateRefreshToken(rawToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    tokenService.setRefreshCookie(res, newRaw);
    await authService.auditLog(user._id, 'TOKEN_REFRESH', req);

    res.json({ accessToken, user: _safeUser(user) });
  } catch (err) {
    tokenService.clearRefreshCookie(res);
    res.status(401).json({ error: err.message, code: 'REFRESH_FAILED' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const rawToken = tokenService.getRefreshFromCookie(req) || req.body.refreshToken;
    if (rawToken) await tokenService.revokeRefreshToken(rawToken);
    tokenService.clearRefreshCookie(res);
    await authService.auditLog(req.userId, 'LOGOUT', req);
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/logout-all ─────────────────────────────────────────────────
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    await tokenService.revokeAllUserTokens(req.userId);
    tokenService.clearRefreshCookie(res);
    await authService.auditLog(req.userId, 'LOGOUT_ALL', req);
    res.json({ message: 'All sessions invalidated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(User.safeFields);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: _safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/verify-email ────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token missing' });
    await authService.verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    await authService.forgotPassword(req.body.email);
    // Always return 200 to prevent email enumeration
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', authLimiter, [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { token, password } = req.body;
    const user = await authService.resetPassword(token, password);
    await authService.auditLog(user._id, 'PASSWORD_RESET', req);
    res.json({ message: 'Password updated. Please log in.' });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ── Private helper ─────────────────────────────────────────────────────────────
function _safeUser(user) {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  delete u.emailVerifyToken;
  delete u.emailVerifyExpires;
  return u;
}

module.exports = router;