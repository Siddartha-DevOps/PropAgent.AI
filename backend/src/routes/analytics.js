// backend/routes/analytics.js
const express = require("express");
const router = express.Router();
const { pgPool } = require("../config/db");
const Session = require("../models/Session");

// ─── REMOVED: return { totalLeads: 47, hotLeads: 12, ... } ───

/**
 * GET /api/analytics/overview
 * Returns real aggregated stats from PostgreSQL + MongoDB
 */
router.get("/overview", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end   = endDate   ? new Date(endDate)   : new Date();

    // ── PostgreSQL queries ────────────────────────────────────────────
    const [leadsResult, propertiesResult, hotLeadsResult, conversionResult] =
      await Promise.all([
        // Total leads in date range
        pgPool.query(
          `SELECT COUNT(*) AS total_leads FROM leads
           WHERE created_at BETWEEN $1 AND $2`,
          [start, end]
        ),

        // Total active property listings
        pgPool.query(
          `SELECT COUNT(*) AS total_properties FROM properties
           WHERE is_available = true`
        ),

        // Hot leads: score >= 7
        pgPool.query(
          `SELECT COUNT(*) AS hot_leads FROM leads
           WHERE score >= 7 AND created_at BETWEEN $1 AND $2`,
          [start, end]
        ),

        // Conversion rate: leads that became bookings/sales
        pgPool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'converted') AS converted,
             COUNT(*) AS total
           FROM leads
           WHERE created_at BETWEEN $1 AND $2`,
          [start, end]
        ),
      ]);

    // ── MongoDB query — active chat sessions ──────────────────────────
    const activeSessions = await Session.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const totalLeads   = parseInt(leadsResult.rows[0].total_leads);
    const hotLeads     = parseInt(hotLeadsResult.rows[0].hot_leads);
    const converted    = parseInt(conversionResult.rows[0].converted);
    const totalForCalc = parseInt(conversionResult.rows[0].total);
    const conversionRate = totalForCalc > 0
      ? ((converted / totalForCalc) * 100).toFixed(1)
      : "0.0";

    return res.json({
      period: { start, end },
      totalLeads,
      hotLeads,
      coldLeads:          totalLeads - hotLeads,
      totalProperties:    parseInt(propertiesResult.rows[0].total_properties),
      activeChatSessions: activeSessions,
      conversions:        converted,
      conversionRate:     `${conversionRate}%`,
    });
  } catch (err) {
    console.error("GET /analytics/overview error:", err);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /api/analytics/leads-by-day
 * Daily lead volume for charting
 */
router.get("/leads-by-day", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pgPool.query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*)         AS leads,
         COUNT(*) FILTER (WHERE score >= 7) AS hot_leads
       FROM leads
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /analytics/leads-by-day error:", err);
    return res.status(500).json({ error: "Failed to fetch lead trend" });
  }
});

/**
 * GET /api/analytics/top-properties
 * Properties ranked by lead count
 */
router.get("/top-properties", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const result = await pgPool.query(
      `SELECT
         p.id, p.title, p.city, p.price,
         COUNT(l.id)                              AS lead_count,
         COUNT(l.id) FILTER (WHERE l.score >= 7)  AS hot_lead_count
       FROM properties p
       LEFT JOIN leads l ON l.property_id = p.id
       GROUP BY p.id, p.title, p.city, p.price
       ORDER BY lead_count DESC
       LIMIT $1`,
      [limit]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /analytics/top-properties error:", err);
    return res.status(500).json({ error: "Failed to fetch top properties" });
  }
});

/**
 * GET /api/analytics/chat-engagement
 * Average messages per session and total sessions
 */
router.get("/chat-engagement", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalSessions, pipeline] = await Promise.all([
      Session.countDocuments({ createdAt: { $gte: since } }),
      Session.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            avgMessages: { $avg: { $size: "$messages" } },
            totalMessages: { $sum: { $size: "$messages" } },
          },
        },
      ]),
    ]);

    const stats = pipeline[0] || { avgMessages: 0, totalMessages: 0 };

    return res.json({
      totalSessions,
      totalMessages:      stats.totalMessages,
      avgMessagesPerSession: parseFloat(stats.avgMessages.toFixed(1)),
    });
  } catch (err) {
    console.error("GET /analytics/chat-engagement error:", err);
    return res.status(500).json({ error: "Failed to fetch chat engagement" });
  }
});

module.exports = router;