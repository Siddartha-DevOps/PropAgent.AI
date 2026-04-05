require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Stripe webhook needs raw body BEFORE json parser ──────────
app.use('/api/payment/stripe/webhook', express.raw({ type: 'application/json' }));

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api/chat',    rateLimit({ windowMs: 60000, max: 60,  message: { error: 'Too many chat requests' } }));
app.use('/api/auth',   rateLimit({ windowMs: 60000, max: 20,  message: { error: 'Too many auth requests' } }));
app.use('/api/payment',rateLimit({ windowMs: 60000, max: 10,  message: { error: 'Too many payment requests' } }));

// ── Routes ────────────────────────────────────────────────────

const authRoutes       = require('./routes/auth');
const builderRoutes    = require('./routes/builder');
const chatRoutes       = require('./routes/chat');
const leadRoutes       = require('./routes/leads');
const paymentRoutes    = require('./routes/payment');
const propertiesRoutes = require('./routes/properties');
const analyticsRoutes  = require('./routes/analytics');
const notifRoutes      = require('./routes/notifications');
const trainingRoutes   = require('./routes/training'); 

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/builder',    require('./routes/builder'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/chat',       require('./routes/chat'));
app.use('/api/leads',      require('./routes/leads'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/training',   require('./routes/training'));



// ── Root ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'PropAgent.AI API',
    version: '2.0.0',
    status: 'running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      health:    'GET  /api/health',
      auth:      'POST /api/auth/register | /api/auth/login',
      chat:      'POST /api/chat/start | /api/chat/message',
      leads:     'GET  /api/leads | /api/leads/analytics',
      payment:   'POST /api/payment/razorpay/create-order | /api/payment/razorpay/verify',
      builder:   'GET  /api/builder/widget-config',
      training:  'POST /api/training/upload | GET /api/training/docs',
    }
  });
});

app.get('/api/health', (req, res) => {
  const keyCheck = (key, fallback) => {
    const val = process.env[key];
    return val && val !== fallback && val.trim() !== '';
  };
  res.json({
    status: 'ok',
    service: 'PropAgent.AI API',
    version: '2.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    keys: {
      anthropic:  keyCheck('ANTHROPIC_API_KEY', 'sk-ant-your-key-here'),
      razorpay:   keyCheck('RAZORPAY_KEY_ID', 'rzp_test_your_key_id'),
      stripe:     keyCheck('STRIPE_SECRET_KEY', 'sk_test_your_stripe_secret_key'),
      jwt:        keyCheck('JWT_SECRET', 'change-this-in-production'),
    },
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── MongoDB + Start ───────────────────────────────────────────
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/propagent';
mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected:', mongoUri.replace(/\/\/.*@/, '//***@'));
    startServer();
  })
  .catch(err => {
    console.warn('⚠️  MongoDB connection failed:', err.message);
    console.warn('    Running in in-memory mode (data will not persist)');
    startServer();
  });

function startServer() {
  app.listen(PORT, () => {
    console.log('\n🚀 PropAgent.AI API v2.0 running');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   API docs: http://localhost:${PORT}/`);
    console.log(`   Health:   http://localhost:${PORT}/api/health\n`);

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
      console.warn('⚠️  ANTHROPIC_API_KEY not set — chat will not work');
    }
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_your_key_id') {
      console.warn('⚠️  RAZORPAY_KEY_ID not set — payments in demo mode');
    }
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key') {
      console.warn('⚠️  STRIPE_SECRET_KEY not set — Stripe in demo mode');
    }
  });
}

module.exports = app;