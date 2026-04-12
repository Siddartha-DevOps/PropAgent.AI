const express = require('express')
const router  = express.Router()
const Bot     = require('../models/Bot')
const { authMiddleware: auth } = require('../middleware/auth')

// GET /api/bots — list all bots for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const bots = await Bot.find({ builderId: req.userId }).sort({ createdAt: -1 })
    res.json(bots)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bots/public/:botId/config — NO AUTH — used by embed widget
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

// GET /api/bots/:botId
router.get('/:botId', auth, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, builderId: req.userId })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    res.json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bots — create new bot
router.post('/', auth, async (req, res) => {
  try {
    const {
      name, description, primaryColor, welcomeMessage,
      placeholder, systemPrompt, captureLeads, leadFormTitle, requirePhone
    } = req.body
    if (!name) return res.status(400).json({ error: 'Bot name is required' })
    const bot = await Bot.create({
      builderId: req.userId,
      name, description, primaryColor, welcomeMessage,
      placeholder, systemPrompt, captureLeads, leadFormTitle, requirePhone,
      status: 'ready',
    })
    res.status(201).json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/bots/:botId — update bot settings
router.patch('/:botId', auth, async (req, res) => {
  try {
    const allowed = [
      'name', 'description', 'primaryColor', 'welcomeMessage',
      'placeholder', 'systemPrompt', 'captureLeads', 'leadFormTitle', 'requirePhone'
    ]
    const updates = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    const bot = await Bot.findOneAndUpdate(
      { _id: req.params.botId, builderId: req.userId },
      updates,
      { new: true }
    )
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    res.json(bot)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/bots/:botId
router.delete('/:botId', auth, async (req, res) => {
  try {
    const bot = await Bot.findOneAndDelete({ _id: req.params.botId, builderId: req.userId })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    const TrainingDoc = require('../models/TrainingDoc')
    await TrainingDoc.deleteMany({ botId: req.params.botId }).catch(() => {})
    res.json({ message: 'Bot deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router