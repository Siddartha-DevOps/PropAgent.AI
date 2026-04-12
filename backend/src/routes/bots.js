// backend/src/routes/bots.js
// NEW FILE — Bot CRUD routes
// Register in server.js: app.use('/api/bots', require('./routes/bots'))

const express = require('express')
const router  = express.Router()
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')

// ── Use your existing DB connection (MongoDB / Mongoose) ──────────────────────
// Adjust the import path to match where your DB models live
let Bot
try {
  Bot = require('../../models/Bot')
} catch {
  // If Bot model doesn't exist yet, we define it inline below
  const mongoose = require('mongoose')
  const botSchema = new mongoose.Schema({
    builderId:      { type: String, required: true, index: true },
    name:           { type: String, required: true },
    description:    { type: String, default: '' },
    primaryColor:   { type: String, default: '#1a56db' },
    welcomeMessage: { type: String, default: "Hi! I'm your real estate assistant. How can I help?" },
    placeholder:    { type: String, default: 'Ask about pricing, availability, floor plans...' },
    systemPrompt:   { type: String, default: '' },
    captureLeads:   { type: Boolean, default: true },
    leadFormTitle:  { type: String, default: 'Get More Details' },
    requirePhone:   { type: Boolean, default: true },
    status:         { type: String, default: 'ready', enum: ['training','ready','error'] },
    totalMessages:  { type: Number, default: 0 },
    totalLeads:     { type: Number, default: 0 },
    embedDomain:    { type: String, default: '' },
  }, { timestamps: true })
  Bot = mongoose.model('Bot', botSchema)
}

// ── GET /api/bots  — list all bots for logged-in builder ──────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const bots = await Bot.find({ builderId: req.user.id }).sort({ createdAt: -1 })
    res.json(bots)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/bots/public/:botId/config  — NO AUTH — used by widget ────────────
router.get('/public/:botId/config', async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.botId).select(
      'name primaryColor welcomeMessage placeholder captureLeads leadFormTitle requirePhone status'
    )
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    res.json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/bots/:botId  — single bot ────────────────────────────────────────
router.get('/:botId', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, builderId: req.user.id })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    res.json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/bots  — create bot ──────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      name, description, primaryColor,
      welcomeMessage, placeholder, systemPrompt,
      captureLeads, leadFormTitle, requirePhone
    } = req.body

    if (!name) return res.status(400).json({ error: 'Bot name is required' })

    const bot = await Bot.create({
      builderId: req.user.id,
      name, description, primaryColor,
      welcomeMessage, placeholder, systemPrompt,
      captureLeads, leadFormTitle, requirePhone,
      status: 'ready',
    })

    res.status(201).json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/bots/:botId  — update bot ─────────────────────────────────────
router.patch('/:botId', auth, async (req, res) => {
  try {
    const allowed = [
      'name','description','primaryColor','welcomeMessage',
      'placeholder','systemPrompt','captureLeads','leadFormTitle','requirePhone'
    ]
    const updates = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

    const bot = await Bot.findOneAndUpdate(
      { _id: req.params.botId, builderId: req.user.id },
      updates,
      { new: true }
    )
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    res.json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/bots/:botId  ─────────────────────────────────────────────────
router.delete('/:botId', auth, async (req, res) => {
  try {
    const bot = await Bot.findOneAndDelete({ _id: req.params.botId, builderId: req.user.id })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })

    // Also delete all training docs and chunks for this bot
    try {
      const TrainingDoc = require('../../models/TrainingDoc')
      await TrainingDoc.deleteMany({ botId: req.params.botId })
    } catch (_) {}

    res.json({ message: 'Bot deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router