/**
 * admin.js (Routes)
 * ------------------
 * Super-Admin Dashboard for PropAgent.AI platform owners.
 * Only accessible to users with role: 'superadmin' (set in MongoDB User.js).
 *
 * FILE: backend/src/routes/admin.js
 * STATUS: NEW
 *
 * Endpoints:
 *   GET    /api/admin/stats              Platform-wide stats (KPIs)
 *   GET    /api/admin/builders           List all builders with analytics
 *   GET    /api/admin/builders/:id       Single builder deep-dive
 *   PATCH  /api/admin/builders/:id/plan  Change a builder's plan
 *   PATCH  /api/admin/builders/:id/ban   Ban / unban a builder
 *   GET    /api/admin/logs               Admin action log
 *   GET    /api/admin/revenue            MRR / ARR breakdown by plan
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const adminGate = require('../middleware/adminGate');
const { get, set, TTL } = require('../services/redisService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// All admin routes: require auth AND superadmin role
router.use(authMiddleware, adminGate);

// ─── Helper: Log admin actions ────────────────────────────────────────────────
async function logAdminAction(req, action, targetType, targetId, metadata = {}) {
  await pool.query(`
    INSERT INTO admin_logs (admin_email, action, target_type, target_id, metadata, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    req.user.email,
    action,
    targetType,
    targetId,
    JSON.stringify(metadata),
    req.ip,
  ]);
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
/**
 * Platform-wide KPIs for the super-admin overview panel.
 * Results cached for 5 minutes in Redis.
 */
router.get('/stats', async (req, res) => {
  const cacheKey = 'admin:platform_stats';
  const cached = await get(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Use the materialized view (refresh_admin_stats() runs daily via cron)
    const { rows: mv } = await pool.query('SELECT * FROM mv_admin_platform_stats LIMIT 1');

    // Real-time additions (fast queries)
    const [newBuildersToday, leadsToday, hotLeadsToday, chatsToday] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM builders WHERE created_at::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE AND intent_label = 'HIGH'"),
      pool.query("SELECT COUNT(*) FROM chat_sessions WHERE created_at::date = CURRENT_DATE"),
    ]);

    // Plan distribution
    const { rows: planDist } = await pool.query(`
      SELECT plan, COUNT(*) AS count FROM builders WHERE is_active = true GROUP BY plan ORDER BY count DESC
    `);

    const stats = {
      ...(mv[0] || {}),
      today: {
        newBuilders: parseInt(newBuildersToday.rows[0].count),
        leads: parseInt(leadsToday.rows[0].count),
        hotLeads: parseInt(hotLeadsToday.rows[0].count),
        chats: parseInt(chatsToday.rows[0].count),
      },
      planDistribution: planDist,
      refreshedAt: new Date().toISOString(),
    };

    await set(cacheKey, stats, TTL.DASHBOARD);
    return res.json(stats);
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/builders ──────────────────────────────────────────────────
/**
 * List all builders with analytics from the summary view.
 * Supports: pagination, search, filter by plan/status, sort.
 */
router.get('/builders', async (req, res) => {
  const {
    page = 1,
    limit = 25,
    search,
    plan,
    is_active,
    sort = 'joined_at',
    order = 'desc',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allowedSorts = ['joined_at', 'total_leads', 'hot_leads', 'total_chats', 'avg_intent'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'joined_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(brand_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (plan) {
    conditions.push(`plan = $${paramIdx++}`);
    params.push(plan);
  }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${paramIdx++}`);
    params.push(is_active === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(`
      SELECT * FROM vw_builder_summary
      ${where}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, parseInt(limit), offset]);

    const countRow = await pool.query(
      `SELECT COUNT(*) FROM vw_builder_summary ${where}`,
      params
    );

    return res.json({
      builders: rows,
      total: parseInt(countRow.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRow.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/builders/:mongoId ────────────────────────────────────────
/**
 * Deep-dive on a single builder: their leads, chat stats, team, recent activity.
 */
router.get('/builders/:mongoId', async (req, res) => {
  try {
    const { rows: builderRows } = await pool.query(
      'SELECT * FROM vw_builder_summary WHERE mongo_id = $1',
      [req.params.mongoId]
    );

    if (!builderRows.length) return res.status(404).json({ error: 'Builder not found.' });

    const builder = builderRows[0];

    // Monthly lead trend (last 6 months)
    const { rows: trend } = await pool.query(`
      SELECT month, total_leads, hot_leads, nri_leads, conversion_rate_pct
      FROM vw_monthly_funnel
      WHERE builder_id = $1
      ORDER BY month DESC
      LIMIT 6
    `, [builder.id]);

    // Team members
    const { rows: team } = await pool.query(
      'SELECT email, name, role, status, last_login FROM team_members WHERE builder_id = $1',
      [builder.id]
    );

    // Webhook config (without exposing the encrypted key)
    const { rows: webhooks } = await pool.query(
      'SELECT crm_type, is_active, last_synced, sync_count, last_error FROM webhook_configs WHERE builder_id = $1',
      [builder.id]
    );

    return res.json({ builder, trend, team, webhooks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/builders/:mongoId/plan ──────────────────────────────────
/**
 * Upgrade or downgrade a builder's subscription plan.
 * Body: { plan: 'free' | 'basic' | 'pro' | 'enterprise' }
 */
router.patch('/builders/:mongoId/plan', async (req, res) => {
  const { plan } = req.body;
  const validPlans = ['free', 'basic', 'pro', 'enterprise'];

  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: `Invalid plan. Use: ${validPlans.join(' | ')}` });
  }

  try {
    const { rowCount } = await pool.query(
      'UPDATE builders SET plan = $1 WHERE mongo_id = $2',
      [plan, req.params.mongoId]
    );

    if (!rowCount) return res.status(404).json({ error: 'Builder not found.' });

    await logAdminAction(req, 'CHANGE_PLAN', 'builder', req.params.mongoId, { newPlan: plan });
    return res.json({ message: `Builder plan updated to ${plan}.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/builders/:mongoId/ban ───────────────────────────────────
/**
 * Ban or unban a builder account.
 * Body: { banned: true | false, reason?: string }
 */
router.patch('/builders/:mongoId/ban', async (req, res) => {
  const { banned, reason } = req.body;

  try {
    const { rowCount } = await pool.query(
      'UPDATE builders SET is_active = $1 WHERE mongo_id = $2',
      [!banned, req.params.mongoId]
    );

    if (!rowCount) return res.status(404).json({ error: 'Builder not found.' });

    await logAdminAction(req, banned ? 'BAN_BUILDER' : 'UNBAN_BUILDER', 'builder', req.params.mongoId, { reason });
    return res.json({ message: `Builder ${banned ? 'banned' : 'unbanned'} successfully.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/revenue ───────────────────────────────────────────────────
/**
 * MRR / ARR breakdown by plan.
 * Uses hardcoded plan prices — in production wire this to Razorpay/Stripe API.
 */
router.get('/revenue', async (req, res) => {
  const PLAN_PRICES_INR = { free: 0, basic: 999, pro: 2999, enterprise: 9999 };

  try {
    const { rows } = await pool.query(`
      SELECT plan, COUNT(*) AS builder_count
      FROM builders WHERE is_active = true
      GROUP BY plan
    `);

    const breakdown = rows.map((r) => ({
      plan: r.plan,
      builderCount: parseInt(r.builder_count),
      pricePerMonth: PLAN_PRICES_INR[r.plan] || 0,
      mrr: parseInt(r.builder_count) * (PLAN_PRICES_INR[r.plan] || 0),
    }));

    const totalMRR = breakdown.reduce((s, b) => s + b.mrr, 0);

    return res.json({
      breakdown,
      totalMRR,
      totalARR: totalMRR * 12,
      currency: 'INR',
      note: 'Connect to Razorpay API for actual collected revenue.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const { rows } = await pool.query(`
      SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);

    return res.json({ logs: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;