const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');
const { v4: uuidv4 } = require('uuid');

// In-memory store — isolated per builder
const leadsByBuilder = new Map();

// Seed demo data for demo builder
function seedDemoLeads(builderId) {
  if (leadsByBuilder.has(builderId)) return;
  leadsByBuilder.set(builderId, new Map([
    ['ld-001', { id:'ld-001', builderId, name:'Priya Sharma', phone:'+91 98765 43210', email:'priya@example.com', intentScore:87, classification:'hot', budget:{min:8000000,max:12000000}, location:'Banjara Hills', propertyType:'3BHK', timeline:'3 months', financing:'home_loan', messageCount:14, tags:['urgent','loan_ready'], conversation:[], properties:['Prestige Skyline 3BHK'], createdAt:new Date(Date.now()-7200000).toISOString() }],
    ['ld-002', { id:'ld-002', builderId, name:'Rahul Mehta', phone:'+91 87654 32109', email:'rahul@example.com', intentScore:62, classification:'warm', budget:{min:5000000,max:7000000}, location:'Gachibowli', propertyType:'2BHK', timeline:'6 months', financing:'self_funded', messageCount:9, tags:['comparing'], conversation:[], properties:[], createdAt:new Date(Date.now()-18000000).toISOString() }],
    ['ld-003', { id:'ld-003', builderId, name:'Vikram Nair', phone:'+91 95432 10987', email:'vikram@example.com', intentScore:91, classification:'hot', budget:{min:15000000,max:25000000}, location:'Jubilee Hills', propertyType:'4BHK', timeline:'1 month', financing:'self_funded', messageCount:21, tags:['vip','cash_buyer','urgent'], conversation:[], properties:['Prestige Jubilee Heights'], createdAt:new Date(Date.now()-3600000).toISOString() }],
    ['ld-004', { id:'ld-004', builderId, name:'Ananya Reddy', phone:null, email:null, intentScore:28, classification:'cold', budget:{min:3000000,max:5000000}, location:'Kompally', propertyType:'2BHK', timeline:'1+ year', financing:'undecided', messageCount:4, tags:[], conversation:[], properties:[], createdAt:new Date(Date.now()-86400000).toISOString() }],
    ['ld-005', { id:'ld-005', builderId, name:'Deepa Krishnan', phone:'+91 84321 09876', email:'deepa@example.com', intentScore:74, classification:'warm', budget:{min:6000000,max:9000000}, location:'Manikonda', propertyType:'3BHK', timeline:'4 months', financing:'home_loan', messageCount:11, tags:[], conversation:[], properties:['Aparna Kanopy'], createdAt:new Date(Date.now()-28800000).toISOString() }],
  ]));
}

function getBuilderLeads(builderId) {
  if (!leadsByBuilder.has(builderId)) seedDemoLeads(builderId);
  return leadsByBuilder.get(builderId);
}

// ─────────────────────────────────────────────────
// GET /api/leads — List leads for authenticated builder
// ─────────────────────────────────────────────────
router.get('/', authMiddleware, requirePlan('growth'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../models/Lead');
      let query = { builderId: req.userId };
      if (req.query.classification) query.classification = req.query.classification;
      const leads = await Lead.find(query).sort({ createdAt: -1 }).lean();
      return res.json(leads);
    }
  } catch {}

  // In-memory
  let leads = Array.from(getBuilderLeads(req.userId).values());
  if (req.query.classification) leads = leads.filter(l => l.classification === req.query.classification);
  res.json(leads.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// ─────────────────────────────────────────────────
// GET /api/leads/analytics — Analytics for this builder
// ─────────────────────────────────────────────────
router.get('/analytics', authMiddleware, requirePlan('growth'), async (req, res) => {
  let all;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../models/Lead');
      all = await Lead.find({ builderId: req.userId }).lean();
    }
  } catch {}

  if (!all) all = Array.from(getBuilderLeads(req.userId).values());

  const total = all.length;
  const hot   = all.filter(l => l.classification==='hot').length;
  const warm  = all.filter(l => l.classification==='warm').length;
  const cold  = all.filter(l => l.classification==='cold').length;
  const avgScore = total ? Math.round(all.reduce((s,l) => s+l.intentScore, 0)/total) : 0;

  const locationMap={}, propMap={};
  const budgetBuckets = {'Under 50L':0,'50L-1Cr':0,'1Cr-2Cr':0,'Above 2Cr':0};

  all.forEach(l => {
    if (l.location) locationMap[l.location] = (locationMap[l.location]||0)+1;
    if (l.propertyType) propMap[l.propertyType] = (propMap[l.propertyType]||0)+1;
    if (l.budget?.max) {
      if (l.budget.max < 5000000)        budgetBuckets['Under 50L']++;
      else if (l.budget.max < 10000000)  budgetBuckets['50L-1Cr']++;
      else if (l.budget.max < 20000000)  budgetBuckets['1Cr-2Cr']++;
      else                               budgetBuckets['Above 2Cr']++;
    }
  });

  const trend = Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const day = all.filter(l => new Date(l.createdAt).toDateString()===d.toDateString());
    return { date: d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}), total:day.length, hot:day.filter(l=>l.classification==='hot').length, warm:day.filter(l=>l.classification==='warm').length, cold:day.filter(l=>l.classification==='cold').length, avgScore: day.length ? Math.round(day.reduce((s,l)=>s+l.intentScore,0)/day.length):0 };
  });

  res.json({
    summary: { total, hot, warm, cold, avgScore, conversionRate: total?Math.round((hot/total)*100):0 },
    locations: Object.entries(locationMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),
    budgetBuckets: Object.entries(budgetBuckets).map(([range,count])=>({range,count})),
    propertyTypes: Object.entries(propMap).map(([type,count])=>({type,count})),
    trend
  });
});

// ─────────────────────────────────────────────────
// GET /api/leads/:id
// ─────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../models/Lead');
      const lead = await Lead.findOne({ _id: req.params.id, builderId: req.userId });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      return res.json(lead);
    }
  } catch {}

  const lead = getBuilderLeads(req.userId).get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// ─────────────────────────────────────────────────
// PATCH /api/leads/:id — Update lead status
// ─────────────────────────────────────────────────
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../models/Lead');
      const lead = await Lead.findOneAndUpdate(
        { _id: req.params.id, builderId: req.userId },
        req.body,
        { new: true }
      );
      if (!lead) return res.status(404).json({ error: 'Not found' });
      return res.json(lead);
    }
  } catch {}

  const leads = getBuilderLeads(req.userId);
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const updated = { ...lead, ...req.body, updatedAt: new Date().toISOString() };
  leads.set(req.params.id, updated);
  res.json(updated);
});

// ─────────────────────────────────────────────────
// Internal helper — create lead from chat session
// ─────────────────────────────────────────────────
async function createLeadFromSession(builderId, sessionData, extracted) {
  const id = 'ld-' + uuidv4().split('-')[0];
  const lead = {
    id, builderId,
    name: extracted.name || null,
    phone: extracted.phone || null,
    email: extracted.email || null,
    budget: extracted.budget || null,
    location: extracted.location || null,
    propertyType: extracted.propertyType || null,
    timeline: extracted.timeline || null,
    financing: extracted.financing || null,
    intentScore: sessionData.intentScore || 0,
    classification: sessionData.classification || 'cold',
    tags: sessionData.tags || [],
    properties: extracted.recommendedProperties || [],
    conversation: sessionData.messages || [],
    messageCount: (sessionData.messages || []).length,
    createdAt: new Date().toISOString()
  };

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../models/Lead');
      const dbLead = await Lead.create({ ...lead, builderId });
      return dbLead._id.toString();
    }
  } catch {}

  // In-memory fallback
  const leads = getBuilderLeads(builderId);
  leads.set(id, lead);
  return id;
}

module.exports = router;
module.exports.createLeadFromSession = createLeadFromSession;