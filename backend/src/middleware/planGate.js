// Plan gating middleware — restrict features by subscription plan

const PLAN_HIERARCHY = { starter: 0, growth: 1, enterprise: 2 };

// Require minimum plan level
function requirePlan(minPlan) {
  return (req, res, next) => {
    const userPlan = req.userPlan || 'starter';
    if (PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[minPlan]) {
      return next();
    }
    res.status(403).json({
      error: `This feature requires the ${minPlan} plan or higher.`,
      currentPlan: userPlan,
      requiredPlan: minPlan,
      upgradeUrl: '/api/payment/plans'
    });
  };
}

// Check monthly lead limit
async function checkLeadLimit(req, res, next) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return next();

    const User = require('../models/User');
    const user = await User.findById(req.userId || req.builderId);
    if (!user) return next();

    // Reset monthly count if new month
    const now = new Date();
    const resetDate = new Date(user.monthReset);
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      user.monthlyLeads = 0;
      user.monthReset = now;
      await user.save();
    }

    if (user.plan === 'starter' && user.monthlyLeads >= user.maxLeadsPerMonth) {
      return res.status(429).json({
        error: `Monthly lead limit of ${user.maxLeadsPerMonth} reached on Starter plan.`,
        currentCount: user.monthlyLeads,
        limit: user.maxLeadsPerMonth,
        upgradeMessage: 'Upgrade to Growth for unlimited leads.',
        upgradeUrl: '/api/payment/plans'
      });
    }
    next();
  } catch {
    next(); // Don't block on DB errors
  }
}

// Feature flags per plan
const FEATURES = {
  starter:    ['chat', 'basic_leads', 'email_notifications'],
  growth:     ['chat', 'basic_leads', 'email_notifications', 'crm_dashboard', 'analytics', 'whatsapp', 'api_access'],
  enterprise: ['chat', 'basic_leads', 'email_notifications', 'crm_dashboard', 'analytics', 'whatsapp', 'api_access', 'white_label', 'custom_ai', 'crm_sync'],
};

function hasFeature(plan, feature) {
  return (FEATURES[plan] || FEATURES.starter).includes(feature);
}

module.exports = { requirePlan, checkLeadLimit, hasFeature };