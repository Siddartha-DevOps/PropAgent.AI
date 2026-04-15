require('dotenv').config()

const cookieParser = require('cookie-parser');
const passport     = require('./config/passport');
const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const rateLimit  = require('express-rate-limit')
const mongoose   = require('mongoose')
const path       = require('path')
const fs         = require('fs')
const { Pool }   = require('pg')
const session    = require('express-session')

// ── Add tenant scope + RBAC to protected routes ─────────────────────────────

const { createSessionStore }     = require('./services/redisService')
const { scheduleMonthlyReports } = require('./services/monthlyReportService')
const { connectMongo } =  require("../config/db");
const { tenantScope }   = require('./middleware/tenantIsolation');
const { requireRole }   = require('./middleware/rbac');
const { authMiddleware }= require('./middleware/auth');

connectMongo();
const app  = express()
const PORT = process.env.PORT || 5000

// ── Stripe webhook needs raw body BEFORE json parser ──────────
app.use(cookieParser());
app.use(passport.initialize());   // no sessions — JWT only
app.use('/api/payment/stripe/webhook', express.raw({ type: 'application/json' }))

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }))
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api/chat',    rateLimit({ windowMs: 60000, max: 60, message: { error: 'Too many chat requests' } }))
app.use('/api/auth',   rateLimit({ windowMs: 60000, max: 20, message: { error: 'Too many auth requests' } }))
app.use('/api/payment',rateLimit({ windowMs: 60000, max: 10, message: { error: 'Too many payment requests' } }))

// ── Session (Redis-backed) ────────────────────────────────────
app.use(session({
  store: createSessionStore(),
  secret: process.env.JWT_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

// ── Widget script server (serves /api/widget/:botId.js) ───────
app.get('/api/widget/:botId.js', (req, res) => {
  try {
    const { botId } = req.params
    if (!/^[a-f0-9]{24}$/.test(botId)) {
      return res.status(400).send('// Invalid bot ID')
    }
    const widgetPath = path.join(__dirname, '../public/widget.js')
    let js = fs.readFileSync(widgetPath, 'utf8')
    const apiBase = process.env.API_PUBLIC_URL || `http://localhost:${PORT}`
    js = js.replace("'__API_BASE__'", `'${apiBase}'`)
    js = js.replace("'__BOT_ID__'",  `'${botId}'`)
    res.setHeader('Content-Type', 'application/javascript')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(js)
  } catch (err) {
    console.error('[Widget]', err.message)
    res.status(500).send('// Widget unavailable')
  }
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'))
app.use('/api/auth/oauth',    require('./routes/oauth'))
app.use('/api/builder',       require('./routes/builder'))
app.use('/api/payment',       require('./routes/payment'))
app.use('/api/chat',          require('./routes/chat'))
app.use('/api/leads',         require('./routes/leads'))
app.use('/api/properties',    require('./routes/properties'))
app.use('/api/analytics',     require('./routes/analytics'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/booking',       require('./routes/booking'))
app.use('/api/training',      require('./routes/training'))
app.use('/api/bots',          require('./routes/bots'))
app.use('/api/team',          require('./routes/team'))
app.use('/api/alerts',        require('./routes/alerts'))
app.use('/api/admin',         require('./routes/admin'))
app.use('/api/blog',          require('./routes/blog'))
app.use('/api/export',        require('./routes/export'))
app.use('/api/webhooks',      require('./routes/webhooks'))

/ Wrap existing protected routes:
app.use('/api/leads',      authMiddleware, tenantScope, require('./routes/leads'))
app.use('/api/bots',       authMiddleware, tenantScope, require('./routes/bots'))
app.use('/api/training',   authMiddleware, tenantScope, require('./routes/training'))
app.use('/api/analytics',  authMiddleware, tenantScope, require('./routes/analytics'))
app.use('/api/builder',    authMiddleware, tenantScope, require('./routes/builder'))
app.use('/api/export',     authMiddleware, tenantScope, require('./routes/export'))
app.use('/api/team',       authMiddleware, tenantScope, require('./routes/team'))
app.use('/api/webhooks',   authMiddleware, tenantScope, require('./routes/webhooks'))
app.use('/api/alerts',     authMiddleware, tenantScope, require('./routes/alerts'))
app.use('/api/blog',       require('./routes/blog'))   // public GET + authMiddleware on mutations
app.use('/api/booking',    require('./routes/booking'))
app.use('/api/payment',    authMiddleware, require('./routes/payment'))
app.use('/api/properties', require('./routes/properties'))
app.use('/api/notifications', authMiddleware, require('./routes/notifications'))
app.use('/api/admin',      authMiddleware, require('./middleware/rbac').adminGate, require('./routes/admin'))


// ── Root info ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service:  'PropAgent.AI API',
    version:  '2.0.0',
    status:   'running',
    db:       mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      health:   'GET  /api/health',
      auth:     'POST /api/auth/register | /api/auth/login',
      chat:     'POST /api/chat',
      bots:     'GET  /api/bots | POST /api/bots',
      training: 'POST /api/training/upload',
      widget:   'GET  /api/widget/:botId.js',
    }
  })
})

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const has = (key, bad) => {
    const v = process.env[key]
    return !!(v && v !== bad && v.trim())
  }
  res.json({
    status:   'ok',
    service:  'PropAgent.AI API',
    version:  '2.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    keys: {
      anthropic: has('ANTHROPIC_API_KEY', 'sk-ant-your-key-here'),
      razorpay:  has('RAZORPAY_KEY_ID',   'rzp_test_your_key_id'),
      stripe:    has('STRIPE_SECRET_KEY', 'sk_test_your_stripe_secret_key'),
      jwt:       has('JWT_SECRET',        'change-this-in-production'),
      pinecone:  has('PINECONE_API_KEY',  'your-pinecone-key-here'),
    },
    timestamp: new Date().toISOString(),
  })
})

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

// ── PostgreSQL ────────────────────────────────────────────────
const pgPool = new Pool({ connectionString: process.env.POSTGRES_URI })
pgPool.connect()
  .then(() => console.log('[PostgreSQL] Connected'))
  .catch(err => console.error('[PostgreSQL] Connection failed:', err.message))

// ── Cron jobs ─────────────────────────────────────────────────
scheduleMonthlyReports()

// ── MongoDB → Start server ────────────────────────────────────
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/propagent'
mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected')
    startServer()
  })
  .catch(err => {
    console.warn('⚠️  MongoDB failed:', err.message, '— starting anyway')
    startServer()
  })

function startServer() {
  app.listen(PORT, () => {
    console.log(`\n🚀 PropAgent.AI API v2.0 running`)
    console.log(`   http://localhost:${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/api/health\n`)

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here')
      console.warn('⚠️  ANTHROPIC_API_KEY not set — chat will not work')
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'your-pinecone-key-here')
      console.warn('⚠️  PINECONE_API_KEY not set — RAG will not work')
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_your_key_id')
      console.warn('⚠️  RAZORPAY_KEY_ID not set — payments in demo mode')
  })
}

module.exports = app