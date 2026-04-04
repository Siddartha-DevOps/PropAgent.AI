const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const LeadSchema = new mongoose.Schema({
  sessionId:     { type: String, required: true, index: true },
  builderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name:          { type: String, default: null },
  email:         { type: String, default: null },
  phone:         { type: String, default: null },
  budget: {
    min: { type: Number, default: null },
    max: { type: Number, default: null }
  },
  location:      { type: String, default: null },
  propertyType:  { type: String, default: null },
  timeline:      { type: String, default: null },
  financing:     { type: String, default: null, enum: ['pre_approved', 'home_loan', 'self_funded', 'undecided', null] },
  intentScore:   { type: Number, default: 0, min: 0, max: 100 },
  classification:{ type: String, default: 'cold', enum: ['hot', 'warm', 'cold'] },
  signals:       [{ key: String, fired: Boolean, points: Number }],
  tags:          [String],
  conversation:  [MessageSchema],
  messageCount:  { type: Number, default: 0 },
  recommendedProperties: [String],
  status:        { type: String, default: 'new', enum: ['new', 'contacted', 'site_visit', 'negotiating', 'closed', 'lost'] },
  source:        { type: String, default: 'website' },
  lastActive:    { type: Date, default: Date.now },
}, { timestamps: true });

LeadSchema.index({ builderId: 1, createdAt: -1 });
LeadSchema.index({ builderId: 1, classification: 1 });
LeadSchema.index({ builderId: 1, intentScore: -1 });

module.exports = mongoose.model('Lead', LeadSchema);