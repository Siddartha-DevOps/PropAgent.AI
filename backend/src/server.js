require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const chatLimiter = rateLimit({ windowMs: 60000, max: 60, message: 'Too many requests' });
app.use('/api/chat', chatLimiter);

app.use('/api/chat', require('./routes/chat'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/analytics', require('./routes/analytics'));

// FIX 1: Root route — so visiting localhost:3001 shows something useful
app.get('/', (req, res) => {
  res.json({
    service: 'PropAgent.AI API',
    version: '1.0.0',
    status: 'running',
    docs: {
      health:     'GET  /api/health',
      chat_start: 'POST /api/chat/start',
      chat_msg:   'POST /api/chat/message',
      leads:      'GET  /api/leads',
      analytics:  'GET  /api/leads/analytics',
      properties: 'GET  /api/properties',
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  const keySet = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
  res.json({
    status: 'ok',
    service: 'PropAgent.AI API',
    anthropic_key_configured: keySet,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 PropAgent.AI API running on http://localhost:${PORT}`);
  console.log(`📋 API docs at http://localhost:${PORT}/`);
  const keySet = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
  if (!keySet) {
    console.log(`\n⚠️  WARNING: ANTHROPIC_API_KEY is not set in backend/.env`);
    console.log(`   Chat will not work until you add your key.\n`);
  } else {
    console.log(`✅ Anthropic API key detected\n`);
  }
});

module.exports = app;