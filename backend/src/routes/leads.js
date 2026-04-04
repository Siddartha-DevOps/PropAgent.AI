const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const leads = new Map();

// Seed demo data
const seedData = [
  { id: 'ld-001', name: 'Priya Sharma', phone: '+91 98765 43210', email: 'priya.sharma@email.com', intentScore: 87, classification: 'hot', budget: { min: 8000000, max: 12000000 }, location: 'Banjara Hills', propertyType: '3BHK', timeline: '3 months', financing: 'home_loan', messageCount: 14, tags: ['urgent', 'loan_ready'], conversation: [], properties: ['Prestige Skyline 3BHK'], createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'ld-002', name: 'Rahul Mehta', phone: '+91 87654 32109', email: 'rahul.m@techcorp.com', intentScore: 62, classification: 'warm', budget: { min: 5000000, max: 7000000 }, location: 'Gachibowli', propertyType: '2BHK', timeline: '6 months', financing: 'self_funded', messageCount: 9, tags: ['comparing_options'], conversation: [], properties: ['My Home Avatar'], createdAt: new Date(Date.now() - 18000000).toISOString() },
  { id: 'ld-003', name: 'Vikram Nair', phone: '+91 95432 10987', email: 'vikram.nair@gmail.com', intentScore: 91, classification: 'hot', budget: { min: 15000000, max: 25000000 }, location: 'Jubilee Hills', propertyType: '4BHK', timeline: '1 month', financing: 'self_funded', messageCount: 21, tags: ['vip', 'cash_buyer', 'urgent'], conversation: [], properties: ['Prestige Jubilee Heights'], createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'ld-004', name: 'Ananya Reddy', phone: null, email: null, intentScore: 28, classification: 'cold', budget: { min: 3000000, max: 5000000 }, location: 'Kompally', propertyType: '2BHK', timeline: '1+ year', financing: 'undecided', messageCount: 4, tags: ['early_research'], conversation: [], properties: [], createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'ld-005', name: 'Deepa Krishnan', phone: '+91 84321 09876', email: 'deepa.k@architect.com', intentScore: 74, classification: 'warm', budget: { min: 6000000, max: 9000000 }, location: 'Manikonda', propertyType: '3BHK', timeline: '4 months', financing: 'home_loan', messageCount: 11, tags: ['quality_focused'], conversation: [], properties: ['Aparna Kanopy'], createdAt: new Date(Date.now() - 28800000).toISOString() },
];
seedData.forEach(l => leads.set(l.id, l));

router.get('/', (req, res) => {
  let all = Array.from(leads.values());
  if (req.query.classification) all = all.filter(l => l.classification === req.query.classification);
  if (req.query.minScore) all = all.filter(l => l.intentScore >= parseInt(req.query.minScore));
  res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

router.get('/analytics', (req, res) => {
  const all = Array.from(leads.values());
  const total = all.length;
  const hot = all.filter(l => l.classification === 'hot').length;
  const warm = all.filter(l => l.classification === 'warm').length;
  const cold = all.filter(l => l.classification === 'cold').length;
  const avgScore = total ? Math.round(all.reduce((s, l) => s + l.intentScore, 0) / total) : 0;

  const locationMap = {};
  const propMap = {};
  const budgetBuckets = { 'Under 50L': 0, '50L-1Cr': 0, '1Cr-2Cr': 0, 'Above 2Cr': 0 };

  all.forEach(l => {
    if (l.location) locationMap[l.location] = (locationMap[l.location] || 0) + 1;
    if (l.propertyType) propMap[l.propertyType] = (propMap[l.propertyType] || 0) + 1;
    if (l.budget?.max) {
      if (l.budget.max < 5000000) budgetBuckets['Under 50L']++;
      else if (l.budget.max < 10000000) budgetBuckets['50L-1Cr']++;
      else if (l.budget.max < 20000000) budgetBuckets['1Cr-2Cr']++;
      else budgetBuckets['Above 2Cr']++;
    }
  });

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const day = all.filter(l => new Date(l.createdAt).toDateString() === d.toDateString());
    return {
      date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      total: day.length,
      hot: day.filter(l => l.classification === 'hot').length,
      warm: day.filter(l => l.classification === 'warm').length,
      cold: day.filter(l => l.classification === 'cold').length,
      avgScore: day.length ? Math.round(day.reduce((s, l) => s + l.intentScore, 0) / day.length) : 0
    };
  });

  res.json({
    summary: { total, hot, warm, cold, avgScore, conversionRate: total ? Math.round((hot / total) * 100) : 0 },
    locations: Object.entries(locationMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    budgetBuckets: Object.entries(budgetBuckets).map(([range, count]) => ({ range, count })),
    propertyTypes: Object.entries(propMap).map(([type, count]) => ({ type, count })),
    trend
  });
});

router.get('/:id', (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

router.patch('/:id', (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const updated = { ...lead, ...req.body, updatedAt: new Date().toISOString() };
  leads.set(req.params.id, updated);
  res.json(updated);
});

module.exports = router;