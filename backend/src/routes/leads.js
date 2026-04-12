const express = require('express')
const router  = express.Router()

const { authMiddleware: auth } = require('../middleware/auth')

let Lead, Bot
try { Lead = require('../../../models/Lead') } catch (_) {
  try { Lead = require('../../models/Lead') } catch (_) { Lead = null } }
try { Bot = require('../../../models/Bot') } catch (_) {
  try { Bot = require('../../models/Bot') } catch (_) { Bot = null } }

function getLead() {
  if (Lead) return Lead
  const mongoose = require('mongoose')
  Lead = mongoose.models.Lead || mongoose.model('Lead', new mongoose.Schema({
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
  }, { timestamps: true }))
  return Lead
}

async function scoreLead(message) {
  try {
    const scorer = require('../services/intentScorer')
    return await scorer.score(message)
  } catch {
    const msg = (message || '').toLowerCase()
    const hot  = ['price','cost','book','buy','visit','purchase','ready to move','booking amount']
    const warm = ['bhk','floor','amenities','location','loan','emi','available','possession']
    const hotHit  = hot.filter(k => msg.includes(k)).length
    const warmHit = warm.filter(k => msg.includes(k)).length
    if (hotHit >= 2) return { score: 85, label: 'hot' }
    if (hotHit === 1) return { score: 72, label: 'hot' }
    if (warmHit >= 1) return { score: 55, label: 'warm' }
    return { score: 30, label: 'cold' }
  }
}

// PUBLIC — POST /api/leads/capture — called by widget, NO AUTH
router.post('/capture', async (req, res) => {
  try {
    const { botId, name, phone, email, firstMessage, sourcePage, sessionId } = req.body
    if (!botId) return res.status(400).json({ error: 'botId is required' })
    if (!name)  return res.status(400).json({ error: 'name is required' })

    let builderId = null
    const BotModel = Bot
    if (BotModel) {
      const bot = await BotModel.findById(botId).select('builderId')
      builderId = bot?.builderId
    }
    if (!builderId) return res.status(404).json({ error: 'Bot not found' })

    const { score, label } = await scoreLead(firstMessage)
    const LeadModel = getLead()
    const lead = await LeadModel.create({
      botId, builderId,
      name,
      phone:        phone        || '',
      email:        email        || '',
      firstMessage: firstMessage || '',
      intentScore:  score,
      intentLabel:  label,
      sourcePage:   sourcePage   || '',
      sessionId:    sessionId    || '',
    })

    if (BotModel) {
      await BotModel.findByIdAndUpdate(botId, { $inc: { totalLeads: 1 } }).catch(() => {})
    }

    res.status(201).json({ leadId: lead._id, message: 'Lead captured' })
  } catch (err) {
    console.error('[Lead capture]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/leads
router.get('/', auth, async (req, res) => {
  try {
    const { botId, intent, status, page = 1, limit = 50 } = req.query
    const filter = { builderId: req.userId }
    if (botId)  filter.botId       = botId
    if (intent) filter.intentLabel = intent
    if (status) filter.status      = status
    const LeadModel = getLead()
    const [leads, total] = await Promise.all([
      LeadModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
      LeadModel.countDocuments(filter),
    ])
    res.json({ leads, total, page: +page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/leads/export
router.get('/export', auth, async (req, res) => {
  try {
    const { botId } = req.query
    const filter = { builderId: req.userId }
    if (botId) filter.botId = botId
    const LeadModel = getLead()
    const leads = await LeadModel.find(filter).sort({ createdAt: -1 })
    const rows = [
      ['Name','Phone','Email','First Message','Intent','Status','Source Page','Date'],
      ...leads.map(l => [
        `"${(l.name        ||'').replace(/"/g,'""')}"`,
        `"${(l.phone       ||'').replace(/"/g,'""')}"`,
        `"${(l.email       ||'').replace(/"/g,'""')}"`,
        `"${(l.firstMessage||'').replace(/"/g,'""')}"`,
        l.intentLabel, l.status,
        `"${(l.sourcePage  ||'').replace(/"/g,'""')}"`,
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

// PATCH /api/leads/:leadId/status
router.patch('/:leadId/status', auth, async (req, res) => {
  try {
    const { status, notes } = req.body
    const valid = ['new','contacted','qualified','converted','lost']
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const LeadModel = getLead()
    const lead = await LeadModel.findOneAndUpdate(
      { _id: req.params.leadId, builderId: req.userId },
      { status, ...(notes !== undefined && { notes }) },
      { new: true }
    )
    if (!lead) return res.status(404).json({ error: 'Lead not found' })
    res.json(lead)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router