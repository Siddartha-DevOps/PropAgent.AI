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
  status:         { type: String, default: 'ready', enum: ['training', 'ready', 'error'] },
  totalMessages:  { type: Number, default: 0 },
  totalLeads:     { type: Number, default: 0 },
  embedDomain:    { type: String, default: '' },
}, { timestamps: true })

module.exports = mongoose.models.Bot || mongoose.model('Bot', botSchema)