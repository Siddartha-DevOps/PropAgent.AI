const express = require('express');
const router = express.Router();

router.get('/overview', (req, res) => {
  res.json({
    totalVisitors: 1284,
    totalConversations: 847,
    leadsGenerated: 156,
    hotLeads: 42,
    conversionRate: 18.4,
    avgIntentScore: 67,
    topLocations: ['Banjara Hills', 'Gachibowli', 'Jubilee Hills', 'Kondapur', 'Manikonda'],
    topPropertyTypes: ['3BHK', '2BHK', '4BHK', 'Villa'],
    weeklyTrend: [12, 18, 15, 22, 28, 19, 24],
  });
});

module.exports = router;