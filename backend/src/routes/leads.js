// backend/src/routes/leads.js
// UPDATED — adds the public POST /capture route used by the chat widget
// Keep all your existing routes and ADD the new ones marked with "NEW"

const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')

let Lead, Bot
try { Lead = require('../../models/Lead') } catch { Lead = null }
try { Bot  = require('../../models/Bot')  } catch { Bot  = null }

// Lazy-load to avoid circular deps
function getLead() {
  if (Lead) return Lead
  const mongoose = require('mongoose')
  const s = new mongoose.Schema({
    botId:        { type: String, required: true, index: true },
    builderId:    { type: String, required: true, index: true },
    name:         { type: String, required: true },
    phone:        { type: String, default: '' },
    email:        { type: String, default: '' },
    firstMessage: { type: String, default: '' },
    intentScore:  { type: Number, default: 50 },
    intentLabel:  { type: String, default: 'warm', enum: ['hot','warm','cold'] },
    sourcePage:   { type: String, default: '' },
    sessionId:    { type: String, default: '' },
    status:       { type: String, default: 'new', enum: ['new','contacted','qualified','converted','lost'] },
    notes:        { type: String, default: '' },
  }, { timestamps: true })
  Lead = mongoose.model('Lead', s)
  return Lead
}

// ── Intent scorer (reuses your intentScorer service if available) ─────────────
async function scoreLead(message) {
  try {
    const scorer = require('../services/intentScorer')
    return await scorer.score(message)
  } catch {
    // Simple fallback scoring
    const msg   = (message || '').toLowerCase()
    const hot   = ['price','cost','book','buy','visit','purchase','ready to move']
    const warm  = ['bhk','floor','amenities','location','loan','emi','available']
    const hotHit  = hot.filter(k => msg.includes(k)).length
    const warmHit = warm.filter(k => msg.includes(k)).length
    if (hotHit >= 2) return { score: 85, label: 'hot' }
    if (hotHit === 1) return { score: 72, label: 'hot' }
    if (warmHit >= 1) return { score: 55, label: 'warm' }
    return { score: 30, label: 'cold' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW — POST /api/leads/capture
// Public route — NO auth — called by the embeddable chat widget
// ─────────────────────────────────────────────────────────────────────────────
router.post('/capture', async (req, res) => {
  try {
    const { botId, name, phone, email, firstMessage, sourcePage, sessionId } = req.body

    if (!botId) return res.status(400).json({ error: 'botId is required' })
    if (!name)  return res.status(400).json({ error: 'name is required' })

    // Get builderId from bot
    let builderId = req.body.builderId
    if (!builderId && Bot) {
      const bot = await Bot.findById(botId).select('builderId')
      builderId  = bot?.builderId
    }
    if (!builderId) return res.status(404).json({ error: 'Bot not found' })

    const { score, label } = await scoreLead(firstMessage)

    const LeadModel = getLead()
    const lead = await LeadModel.create({
      botId, builderId,
      name, phone: phone || '', email: email || '',
      firstMessage: firstMessage || '',
      intentScore: score, intentLabel: label,
      sourcePage: sourcePage || '', sessionId: sessionId || '',
    })

    // Increment lead count on bot
    if (Bot) {
      await Bot.findByIdAndUpdate(botId, { $inc: { totalLeads: 1 } }).catch(() => {})
    }

    res.status(201).json({ leadId: lead._id, message: 'Lead captured' })
  } catch (err) {
    console.error('[Lead capture]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING routes (keep these — just shown here for completeness)
// GET /api/leads  — all leads for builder
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { botId, intent, status, page = 1, limit = 50 } = req.query
    const filter = { builderId: req.user.id }
    if (botId)  filter.botId        = botId
    if (intent) filter.intentLabel  = intent
    if (status) filter.status       = status

    const LeadModel = getLead()
    const [leads, total] = await Promise.all([
      LeadModel.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(+limit),
      LeadModel.countDocuments(filter),
    ])
    res.json({ leads, total, page: +page, pages: Math.ceil(total/limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/leads/:leadId/status
router.patch('/:leadId/status', auth, async (req, res) => {
  try {
    const { status, notes } = req.body
    const valid = ['new','contacted','qualified','converted','lost']
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const LeadModel = getLead()
    const lead = await LeadModel.findOneAndUpdate(
      { _id: req.params.leadId, builderId: req.user.id },
      { status, ...(notes !== undefined && { notes }) },
      { new: true }
    )
    if (!lead) return res.status(404).json({ error: 'Lead not found' })
    res.json(lead)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/leads/export  — CSV export
router.get('/export', auth, async (req, res) => {
  try {
    const { botId } = req.query
    const filter = { builderId: req.user.id }
    if (botId) filter.botId = botId

    const LeadModel = getLead()
    const leads = await LeadModel.find(filter).sort({ createdAt: -1 })

    const rows = [
      ['Name','Phone','Email','First Message','Intent','Status','Source Page','Date'],
      ...leads.map(l => [
        l.name, l.phone, l.email,
        `"${(l.firstMessage||'').replace(/"/g,'""')}"`,
        l.intentLabel, l.status, l.sourcePage,
        new Date(l.createdAt).toLocaleDateString('en-IN'),
      ])
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=propagent-leads.csv')
    res.send(rows.map(r => r.join(',')).join('\n'))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router