const jwt = require('jsonwebtoken');

// In-memory fallback users when MongoDB is offline
const DEMO_USERS = new Map();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userPlan = decoded.plan || 'starter';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

// Optional auth — doesn't fail if no token, just sets req.userId = null
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');
      req.userId = decoded.userId;
      req.userPlan = decoded.plan || 'starter';
    } catch {}
  }
  next();
}

// Validate widget API key — used by embeddable widget
async function apiKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) {
    return res.status(401).json({ error: 'API key required. Pass X-Api-Key header.' });
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findOne({ apiKey: key, isActive: true });
      if (!user) return res.status(401).json({ error: 'Invalid API key' });
      req.builderId = user._id.toString();
      req.builderPlan = user.plan;
      req.builder = user;
      return next();
    }
  } catch {}

  // Fallback: accept any key starting with 'pa_' in demo mode
  if (key.startsWith('pa_')) {
    req.builderId = 'demo-builder';
    req.builderPlan = 'growth';
    return next();
  }

  res.status(401).json({ error: 'Invalid API key' });
}

module.exports = { authMiddleware, optionalAuth, apiKeyMiddleware };