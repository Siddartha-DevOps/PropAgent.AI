require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ──────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));

// Stripe needs raw body for webhook verification
app.use('/api/payment/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// ── Rate Limiting ───────────────────────────────────
app.use('/api/chat',    rateLimit({ windowMs: 60000, max: 60,  message: 'Too many requests' }));
app.use('/api/auth',   rateLimit({ windowMs: 60000, max: 20,  message: 'Too many auth requests' }));
app.use('/api/payment',rateLimit({ windowMs: 60000, max: 10,  message: 'Too many payment requests' }));

// ── Routes ──────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/builder',    require('./routes/builder'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/chat',       require('./routes/chat'));
app.use('/api/leads',      require('./routes/leads'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/analytics',  require('./routes/analytics'));

// ── Root & Health ────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'PropAgent.AI API v2.0',
    status: 'running',
    endpoints: {
      auth:      '/api/auth',
      builder:   '/api/builder',
      payment:   '/api/payment',
      chat:      '/api/chat',
      leads:     '/api/leads',
      health:    '/api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    razorpay: !!process.env.RAZORPAY_KEY_ID,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString()
  });
});

// ── Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── MongoDB + Start ──────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/propagent')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 PropAgent.AI API v2 running on http://localhost:${PORT}`);
      if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY missing');
      if (!process.env.RAZORPAY_KEY_ID)   console.warn('⚠️  RAZORPAY_KEY_ID missing');
      if (!process.env.STRIPE_SECRET_KEY) console.warn('⚠️  STRIPE_SECRET_KEY missing');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('ℹ️  Falling back to in-memory mode');
    app.listen(PORT, () => console.log(`🚀 PropAgent.AI running (no DB) on port ${PORT}`));
  });

module.exports = app;