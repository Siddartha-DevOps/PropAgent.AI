const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

// In-memory store fallback
const inMemoryBuilders = new Map();

// ─────────────────────────────────────────────────
// POST /api/builder/onboarding — Save onboarding data
// ─────────────────────────────────────────────────
router.post('/onboarding', authMiddleware, async (req, res) => {
  const { projectName, projectCity, locations, propertyTypes, priceMin, priceMax, website } = req.body;

  const projectInfo = { projectName, projectCity, locations: locations || [], propertyTypes: propertyTypes || [], priceMin, priceMax };

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findByIdAndUpdate(
        req.userId,
        { projectInfo, website, isOnboarded: true },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ message: 'Onboarding complete', user });
    }
  } catch (err) {
    console.error('DB error:', err.message);
  }

  // In-memory fallback
  inMemoryBuilders.set(req.userId, { projectInfo, website, isOnboarded: true, updatedAt: new Date() });
  res.json({ message: 'Onboarding complete', projectInfo });
});

// ─────────────────────────────────────────────────
// GET /api/builder/profile — Get builder profile
// ─────────────────────────────────────────────────
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId).select('-password');
      if (!user) return res.status(404).json({ error: 'Not found' });
      return res.json({ builder: user });
    }
  } catch {}
  res.json({ builder: { id: req.userId, plan: req.userPlan, ...inMemoryBuilders.get(req.userId) } });
});

// ─────────────────────────────────────────────────
// GET /api/builder/widget-config — Widget embed info
// ─────────────────────────────────────────────────
router.get('/widget-config', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId).select('apiKey widgetConfig plan company projectInfo');
      if (!user) return res.status(404).json({ error: 'Not found' });

      return res.json({
        apiKey: user.apiKey,
        plan: user.plan,
        widgetConfig: user.widgetConfig,
        embedCode: generateEmbedCode(user.apiKey, user.widgetConfig),
        projectInfo: user.projectInfo
      });
    }
  } catch {}

  // Demo fallback
  const demoKey = 'pa_demo_' + crypto.randomBytes(8).toString('hex');
  res.json({
    apiKey: demoKey,
    plan: req.userPlan || 'starter',
    widgetConfig: { agentName: 'PropAgent', primaryColor: '#B8952A', position: 'bottom-right' },
    embedCode: generateEmbedCode(demoKey, { agentName: 'PropAgent', primaryColor: '#B8952A' }),
  });
});

// ─────────────────────────────────────────────────
// PATCH /api/builder/widget-config — Update widget appearance
// ─────────────────────────────────────────────────
router.patch('/widget-config', authMiddleware, async (req, res) => {
  const { agentName, primaryColor, greeting, position } = req.body;
  const update = { widgetConfig: { agentName, primaryColor, greeting, position } };

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
      return res.json({ message: 'Widget config updated', widgetConfig: user.widgetConfig });
    }
  } catch {}

  res.json({ message: 'Widget config updated (demo mode)', widgetConfig: update.widgetConfig });
});

// ─────────────────────────────────────────────────
// POST /api/builder/regenerate-key — Regenerate API key
// ─────────────────────────────────────────────────
router.post('/regenerate-key', authMiddleware, async (req, res) => {
  const newKey = 'pa_' + crypto.randomBytes(24).toString('hex');

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.userId, { apiKey: newKey });
      return res.json({ message: 'API key regenerated', apiKey: newKey });
    }
  } catch {}

  res.json({ message: 'API key regenerated', apiKey: newKey });
});

// ─────────────────────────────────────────────────
// GET /api/builder/dashboard-stats — Summary stats
// ─────────────────────────────────────────────────
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Lead = require('../src/models');
      const User = require('../src/models');
      const user = await User.findById(req.userId);
      const totalLeads = await Lead.countDocuments({ builderId: req.userId });
      const hotLeads   = await Lead.countDocuments({ builderId: req.userId, classification: 'hot' });
      const warmLeads  = await Lead.countDocuments({ builderId: req.userId, classification: 'warm' });
      const thisMonth  = await Lead.countDocuments({ builderId: req.userId, createdAt: { $gte: new Date(new Date().setDate(1)) } });
      return res.json({ totalLeads, hotLeads, warmLeads, thisMonth, plan: user?.plan, maxLeadsPerMonth: user?.maxLeadsPerMonth });
    }
  } catch {}

  // Demo stats
  res.json({ totalLeads: 5, hotLeads: 2, warmLeads: 2, thisMonth: 5, plan: req.userPlan, maxLeadsPerMonth: 50 });
});

function generateEmbedCode(apiKey, config = {}) {
  return `<!-- PropAgent.AI Widget -->
<script>
  window.PROPAGENT_CONFIG = {
    apiKey: "${apiKey}",
    agentName: "${config.agentName || 'PropAgent'}",
    primaryColor: "${config.primaryColor || '#B8952A'}",
    position: "${config.position || 'bottom-right'}"
  };
</script>
<script src="https://cdn.propagent.ai/widget.js" async></script>`;
}

module.exports = router;