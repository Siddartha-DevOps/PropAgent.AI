const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.post('/test-email', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { sendHotLeadAlert } = require('../services/emailService');
      await sendHotLeadAlert({
        builderEmail: user.email, builderName: user.name,
        lead: { name: 'Test Buyer', phone: '+91 98765 43210', budget: { max: 10000000 }, location: 'Banjara Hills', propertyType: '3BHK', timeline: '3 months', financing: 'home_loan', intentScore: 82 },
      });
      return res.json({ message: `Test email sent to ${user.email}` });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
  res.json({ message: 'Email not configured. Add EMAIL_USER to .env' });
});

router.get('/preferences', authMiddleware, async (req, res) => {
  res.json({ emailOnHotLead: true, emailOnNewLead: false, dailySummary: true });
});

module.exports = router;