// backend/src/middleware/auth.js
const jwt          = require('jsonwebtoken');
const tokenService = require('../services/tokenService');

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret';

// ── Primary auth middleware — validates access token ────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.userId    = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole  = decoded.role  || 'builder';
    req.userPlan  = decoded.plan  || 'starter';
    req.orgId     = decoded.orgId || null;

    // Convenience alias for compatibility with existing code
    req.user = { _id: decoded.userId, id: decoded.userId, role: decoded.role, orgId: decoded.orgId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid access token', code: 'TOKEN_INVALID' });
  }
}

// ── Optional auth — attaches user if token present, never rejects ──────────────
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], ACCESS_SECRET);
      req.userId    = decoded.userId;
      req.userRole  = decoded.role  || 'builder';
      req.userPlan  = decoded.plan  || 'starter';
      req.orgId     = decoded.orgId || null;
      req.user      = { _id: decoded.userId, id: decoded.userId, role: decoded.role, orgId: decoded.orgId };
    } catch (_) {}
  }
  next();
}

// ── API key middleware — for embedded widget requests ──────────────────────────
async function apiKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return res.status(401).json({ error: 'API key required. Pass X-Api-Key header.' });

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findOne({ apiKey: key, isActive: true });
      if (!user) return res.status(401).json({ error: 'Invalid API key' });
      req.builderId    = user._id.toString();
      req.builderPlan  = user.plan;
      req.orgId        = user.orgId || null;
      req.builder      = user;
      return next();
    }
  } catch (e) {}

  // Fallback demo mode
  if (key.startsWith('pa_')) {
    req.builderId   = 'demo-builder';
    req.builderPlan = 'growth';
    return next();
  }
  res.status(401).json({ error: 'Invalid API key' });
}

module.exports = { authMiddleware, optionalAuth, apiKeyMiddleware };