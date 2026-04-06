/**
 * webhooks.js (Routes)
 * ---------------------
 * CRM Webhook Configuration API for PropAgent.AI.
 * Builders connect their HubSpot or Zoho account from the CRM dashboard.
 *
 * FILE: backend/src/routes/webhooks.js
 * STATUS: NEW
 *
 * Endpoints:
 *   GET    /api/webhooks/config          Get current CRM config
 *   POST   /api/webhooks/config          Save/update CRM config
 *   DELETE /api/webhooks/config          Disconnect CRM
 *   POST   /api/webhooks/test            Send a test lead to CRM
 *   GET    /api/webhooks/logs            View recent sync logs
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');
const { syncLead } = require('../services/webhookService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

router.use(authMiddleware, requirePlan('pro'));

// ─── GET /api/webhooks/config ─────────────────────────────────────────────────
router.get('/config', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT crm_type, endpoint_url, field_map, is_active, last_synced, sync_count, last_error
      FROM webhook_configs wc
      JOIN builders b ON b.id = wc.builder_id
      WHERE b.mongo_id = $1
    `, [req.user._id.toString()]);

    if (!rows.length) return res.json({ configured: false });

    const config = rows[0];
    config.configured = true;
    config.api_key_enc = '••••••••'; // Never expose the encrypted key
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/config ────────────────────────────────────────────────
/**
 * Save or update CRM configuration.
 * Body: { crmType, apiKey, endpointUrl?, fieldMap? }
 *
 * crmType: 'hubspot' | 'zoho' | 'custom'
 * apiKey: HubSpot private app token / Zoho OAuth token / custom secret
 */
router.post('/config', async (req, res) => {
  const { crmType, apiKey, endpointUrl, fieldMap = {} } = req.body;

  const validTypes = ['hubspot', 'zoho', 'custom'];
  if (!validTypes.includes(crmType)) {
    return res.status(400).json({ error: `crmType must be: ${validTypes.join(' | ')}` });
  }

  if (!apiKey) return res.status(400).json({ error: 'apiKey is required.' });
  if (crmType === 'custom' && !endpointUrl) {
    return res.status(400).json({ error: 'endpointUrl is required for custom webhook.' });
  }

  try {
    const builderRow = await pool.query(
      'SELECT id FROM builders WHERE mongo_id = $1',
      [req.user._id.toString()]
    );
    if (!builderRow.rows.length) return res.status(404).json({ error: 'Builder not found.' });

    const builderId = builderRow.rows[0].id;

    // In production: encrypt apiKey with AES-256 before storing
    // const encryptedKey = crypto.aesEncrypt(apiKey, process.env.ENCRYPTION_KEY);
    const encryptedKey = apiKey; // TODO: add encryption before production deploy

    await pool.query(`
      INSERT INTO webhook_configs (builder_id, crm_type, api_key_enc, endpoint_url, field_map, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (builder_id) DO UPDATE SET
        crm_type = EXCLUDED.crm_type,
        api_key_enc = EXCLUDED.api_key_enc,
        endpoint_url = EXCLUDED.endpoint_url,
        field_map = EXCLUDED.field_map,
        is_active = true,
        last_error = NULL
    `, [builderId, crmType, encryptedKey, endpointUrl, JSON.stringify(fieldMap)]);

    return res.json({ message: `${crmType} CRM connected successfully.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/webhooks/config ──────────────────────────────────────────────
router.delete('/config', async (req, res) => {
  try {
    await pool.query(`
      DELETE FROM webhook_configs
      WHERE builder_id = (SELECT id FROM builders WHERE mongo_id = $1)
    `, [req.user._id.toString()]);

    return res.json({ message: 'CRM integration disconnected.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/test ──────────────────────────────────────────────────
/**
 * Send a synthetic test lead to the configured CRM to verify the connection.
 */
router.post('/test', async (req, res) => {
  const testLead = {
    name: 'Test Lead — PropAgent.AI',
    phone: '+91 9999999999',
    email: 'test@propagent.ai',
    intent_score: 95,
    intent_label: 'HIGH',
    buyer_type: 'local',
    budget_max: 5000000,
    preferred_bhk: '2BHK',
    source_page: '/test-sync',
    status: 'new',
  };

  try {
    await syncLead(testLead, req.user._id.toString());
    return res.json({ message: 'Test lead sent! Check your CRM for the entry.' });
  } catch (err) {
    return res.status(500).json({ error: `Test failed: ${err.message}` });
  }
});

// ─── GET /api/webhooks/logs ───────────────────────────────────────────────────
/**
 * View recent CRM sync logs for debugging.
 */
router.get('/logs', async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const { rows } = await pool.query(`
      SELECT wl.crm_type, wl.status, wl.http_status, wl.error_message, wl.created_at
      FROM webhook_logs wl
      JOIN builders b ON b.id = wl.builder_id
      WHERE b.mongo_id = $1
      ORDER BY wl.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user._id.toString(), parseInt(limit), offset]);

    return res.json({ logs: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;