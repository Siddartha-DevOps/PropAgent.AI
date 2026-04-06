/**
 * alerts.js (Routes) + alertService.js
 * --------------------------------------
 * Price Alert System for PropAgent.AI.
 * Visitors subscribe to be notified when a property's price drops.
 * Builders trigger alerts from the dashboard when prices change.
 *
 * FILE: backend/src/routes/alerts.js
 * STATUS: NEW
 *
 * Endpoints:
 *   POST   /api/alerts/subscribe         Visitor subscribes (from chat widget)
 *   GET    /api/alerts                   Builder: list all active alerts
 *   POST   /api/alerts/trigger           Builder: trigger alerts for a price drop
 *   DELETE /api/alerts/:id               Builder: delete an alert
 *   GET    /api/alerts/unsubscribe/:token Visitor: unsubscribe (email link)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { checkAndSetAlertCooldown } = require('../services/redisService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// ─── POST /api/alerts/subscribe (PUBLIC — called from chat widget) ────────────
/**
 * Visitor subscribes to a price alert during or after a chat session.
 * The chat widget calls this when visitor expresses interest + gives email.
 *
 * Body: {
 *   builderId (mongo_id), visitorEmail, visitorPhone?, visitorName?,
 *   propertyName?, bhkPreference?, budgetMin?, budgetMax?
 * }
 */
router.post('/subscribe', async (req, res) => {
  const {
    builderId,
    visitorEmail,
    visitorPhone,
    visitorName,
    propertyName,
    bhkPreference,
    budgetMin,
    budgetMax,
  } = req.body;

  if (!builderId || !visitorEmail) {
    return res.status(400).json({ error: 'builderId and visitorEmail are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const builderRow = await pool.query(
      'SELECT id FROM builders WHERE mongo_id = $1',
      [builderId]
    );

    if (!builderRow.rows.length) {
      return res.status(404).json({ error: 'Builder not found.' });
    }

    const pgBuilderId = builderRow.rows[0].id;

    // Upsert — prevent duplicate subscriptions from the same email
    const result = await pool.query(`
      INSERT INTO price_alerts
        (builder_id, visitor_email, visitor_phone, visitor_name, property_name, bhk_preference, budget_min, budget_max)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [pgBuilderId, visitorEmail.toLowerCase(), visitorPhone, visitorName, propertyName, bhkPreference, budgetMin, budgetMax]);

    // Send confirmation email to the visitor
    if (result.rows.length) {
      const unsubToken = crypto.createHmac('sha256', process.env.JWT_SECRET)
        .update(result.rows[0].id).digest('hex');

      await emailService.sendAlertConfirmation({
        to: visitorEmail,
        name: visitorName || 'there',
        propertyName: propertyName || 'your selected property',
        unsubscribeUrl: `${process.env.FRONTEND_URL}/alerts/unsubscribe/${unsubToken}`,
      });
    }

    return res.status(201).json({ message: "You're subscribed! We'll notify you when prices drop." });
  } catch (err) {
    console.error('[Alerts] Subscribe error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// All management routes below require builder authentication
router.use(authMiddleware);

// ─── GET /api/alerts ──────────────────────────────────────────────────────────
/**
 * List all price alert subscriptions for the authenticated builder.
 * Includes filter by status (active / triggered / unsubscribed).
 */
router.get('/', async (req, res) => {
  const { status = 'active', page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const { rows } = await pool.query(`
      SELECT pa.*, b.brand_name
      FROM price_alerts pa
      JOIN builders b ON b.id = pa.builder_id
      WHERE b.mongo_id = $1 AND pa.status = $2
      ORDER BY pa.created_at DESC
      LIMIT $3 OFFSET $4
    `, [req.user._id.toString(), status, parseInt(limit), offset]);

    const countRow = await pool.query(
      'SELECT COUNT(*) FROM price_alerts pa JOIN builders b ON b.id = pa.builder_id WHERE b.mongo_id = $1 AND pa.status = $2',
      [req.user._id.toString(), status]
    );

    return res.json({
      alerts: rows,
      total: parseInt(countRow.rows[0].count),
      page: parseInt(page),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/alerts/trigger ─────────────────────────────────────────────────
/**
 * Builder triggers price drop alerts.
 * The system matches active alerts against the new price and emails eligible visitors.
 *
 * Body: { propertyName, oldPrice, newPrice, bhkType? }
 *
 * Logic:
 *  - Find all active alerts for this builder
 *  - Filter where: new price <= alert.budgetMax AND drop% >= alert.alertThreshold
 *  - Send email notifications (with 24hr cooldown per alert via Redis)
 */
router.post('/trigger', async (req, res) => {
  const { propertyName, oldPrice, newPrice, bhkType } = req.body;

  if (!oldPrice || !newPrice) {
    return res.status(400).json({ error: 'oldPrice and newPrice are required.' });
  }

  const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;

  if (newPrice >= oldPrice) {
    return res.status(400).json({ error: 'New price must be lower than old price.' });
  }

  try {
    // Get matching active alerts
    const { rows: alerts } = await pool.query(`
      SELECT pa.*
      FROM price_alerts pa
      JOIN builders b ON b.id = pa.builder_id
      WHERE b.mongo_id = $1
        AND pa.status = 'active'
        AND (pa.budget_max IS NULL OR pa.budget_max >= $2)
        AND (pa.property_name IS NULL OR LOWER(pa.property_name) = LOWER($3) OR pa.property_name IS NULL)
        AND (pa.bhk_preference IS NULL OR pa.bhk_preference = $4 OR $4 IS NULL)
        AND pa.alert_threshold <= $5
    `, [req.user._id.toString(), newPrice, propertyName || '', bhkType, dropPercent]);

    let notifiedCount = 0;
    const results = [];

    for (const alert of alerts) {
      // Check Redis cooldown (don't spam the same visitor twice in 24 hours)
      const canSend = await checkAndSetAlertCooldown(alert.id);

      if (canSend) {
        try {
          await emailService.sendPriceDropAlert({
            to: alert.visitor_email,
            name: alert.visitor_name || 'there',
            propertyName: propertyName || alert.property_name || 'the property you were interested in',
            oldPrice,
            newPrice,
            dropPercent: dropPercent.toFixed(1),
            bhkType: bhkType || alert.bhk_preference,
          });

          // Update notify_count and last_notified in DB
          await pool.query(`
            UPDATE price_alerts
            SET notify_count = notify_count + 1, last_notified = NOW()
            WHERE id = $1
          `, [alert.id]);

          notifiedCount++;
          results.push({ email: alert.visitor_email, status: 'sent' });
        } catch (emailErr) {
          results.push({ email: alert.visitor_email, status: 'failed', error: emailErr.message });
        }
      } else {
        results.push({ email: alert.visitor_email, status: 'cooldown_skip' });
      }
    }

    return res.json({
      message: `Price drop alert triggered. Notified ${notifiedCount} of ${alerts.length} eligible subscribers.`,
      dropPercent: dropPercent.toFixed(1),
      totalMatched: alerts.length,
      notifiedCount,
      results,
    });
  } catch (err) {
    console.error('[Alerts] Trigger error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/alerts/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM price_alerts
      WHERE id = $1
        AND builder_id = (SELECT id FROM builders WHERE mongo_id = $2)
    `, [req.params.id, req.user._id.toString()]);

    if (!rowCount) return res.status(404).json({ error: 'Alert not found.' });
    return res.json({ message: 'Alert deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;