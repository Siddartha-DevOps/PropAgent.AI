/**
 * webhookService.js
 * ------------------
 * HubSpot / Zoho CRM sync service for PropAgent.AI.
 * When a hot lead is detected, this service pushes the lead
 * to the builder's configured CRM via webhook or API.
 *
 * FILE: backend/src/services/webhookService.js
 * STATUS: NEW
 *
 * Supported CRMs:
 *   - HubSpot (Contacts API v3)
 *   - Zoho CRM (Leads API)
 *   - Custom (generic POST webhook)
 *
 * Usage:
 *   const webhookService = require('./webhookService');
 *   await webhookService.syncLead(lead, builderId);
 */

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// ─── FORMAT LEAD FOR CRM ──────────────────────────────────────────────────────

/**
 * Map a PropAgent lead to HubSpot contact properties format.
 */
function toHubSpotPayload(lead, fieldMap = {}) {
  const defaults = {
    firstname:      lead.name?.split(' ')[0] || '',
    lastname:       lead.name?.split(' ').slice(1).join(' ') || '',
    phone:          lead.phone || '',
    email:          lead.email || '',
    lifecyclestage: lead.intent_label === 'HIGH' ? 'lead' : 'subscriber',
    hs_lead_status: lead.status || 'NEW',
    // Custom PropAgent properties (must be created in HubSpot portal first)
    propagent_intent_score:  String(lead.intent_score || 0),
    propagent_buyer_type:    lead.buyer_type || 'local',
    propagent_budget_max:    String(lead.budget_max || ''),
    propagent_bhk:           lead.preferred_bhk || '',
    propAgent_source_page:   lead.source_page || '',
  };

  // Apply the builder's custom field mapping
  const mapped = { ...defaults };
  for (const [propField, crmField] of Object.entries(fieldMap)) {
    if (defaults[propField] !== undefined && crmField) {
      mapped[crmField] = defaults[propField];
      if (crmField !== propField) delete mapped[propField];
    }
  }

  return { properties: mapped };
}

/**
 * Map a PropAgent lead to Zoho CRM Lead format.
 */
function toZohoPayload(lead, fieldMap = {}) {
  const defaults = {
    Last_Name:       lead.name || 'Unknown',
    First_Name:      lead.name?.split(' ')[0] || '',
    Mobile:          lead.phone || '',
    Email:           lead.email || '',
    Lead_Source:     'PropAgent.AI Chat',
    Lead_Status:     lead.intent_label === 'HIGH' ? 'Assigned' : 'Attempted to Contact',
    Description:     `Buyer Type: ${lead.buyer_type || 'local'}. Budget: ₹${lead.budget_max || 'Unknown'}. BHK: ${lead.preferred_bhk || 'Any'}.`,
    Intent_Score__c: lead.intent_score || 0,
  };

  const mapped = { ...defaults };
  for (const [propField, crmField] of Object.entries(fieldMap)) {
    if (defaults[propField] !== undefined && crmField) {
      mapped[crmField] = defaults[propField];
      if (crmField !== propField) delete mapped[propField];
    }
  }

  return { data: [mapped] };
}

// ─── CRM PUSH FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Push a lead to HubSpot Contacts API.
 * Creates a new contact or updates existing (upsert by email).
 */
async function pushToHubSpot(lead, config) {
  const payload = toHubSpotPayload(lead, config.field_map || {});

  const url = lead.email
    ? `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email`
    : 'https://api.hubapi.com/crm/v3/objects/contacts';

  const method = lead.email ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`, // decrypted before passing in
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  return { status: response.status, body };
}

/**
 * Push a lead to Zoho CRM Leads module.
 */
async function pushToZoho(lead, config) {
  const payload = toZohoPayload(lead, config.field_map || {});

  const response = await fetch('https://www.zohoapis.in/crm/v3/Leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Zoho-oauthtoken ${config.api_key}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  return { status: response.status, body };
}

/**
 * Push to a custom webhook URL (generic POST).
 */
async function pushToCustom(lead, config) {
  const response = await fetch(config.endpoint_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PropAgent-Signature': config.api_key || '',
    },
    body: JSON.stringify({ lead }),
  });

  const body = await response.text();
  return { status: response.status, body };
}

// ─── MAIN SYNC FUNCTION ───────────────────────────────────────────────────────

/**
 * Sync a lead to the builder's configured CRM.
 * Called from leads.js route whenever a new lead is created or updated.
 *
 * @param {Object} lead       - Lead data (from MongoDB or PostgreSQL)
 * @param {string} mongoId    - Builder's MongoDB _id
 */
async function syncLead(lead, mongoId) {
  // Fetch webhook config from PostgreSQL
  const { rows } = await pool.query(`
    SELECT wc.*, b.id AS pg_builder_id
    FROM webhook_configs wc
    JOIN builders b ON b.id = wc.builder_id
    WHERE b.mongo_id = $1 AND wc.is_active = true
  `, [mongoId]);

  if (!rows.length) return; // No CRM configured for this builder

  const config = rows[0];

  // Decrypt the API key (in production use AES-256 decrypt here)
  // For now, we assume it's stored in plaintext during development
  const apiKey = config.api_key_enc;

  let result;
  let success = false;
  let errorMsg = null;

  try {
    const cfg = { ...config, api_key: apiKey };

    switch (config.crm_type) {
      case 'hubspot':
        result = await pushToHubSpot(lead, cfg);
        break;
      case 'zoho':
        result = await pushToZoho(lead, cfg);
        break;
      case 'custom':
        result = await pushToCustom(lead, cfg);
        break;
      default:
        throw new Error(`Unknown CRM type: ${config.crm_type}`);
    }

    success = result.status >= 200 && result.status < 300;
    if (!success) errorMsg = `HTTP ${result.status}: ${result.body.slice(0, 200)}`;
  } catch (err) {
    errorMsg = err.message;
    result = { status: 0, body: err.message };
  }

  // Log the sync result
  await pool.query(`
    INSERT INTO webhook_logs (builder_id, crm_type, status, http_status, response_body, error_message)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    config.pg_builder_id,
    config.crm_type,
    success ? 'success' : 'failed',
    result.status,
    result.body?.slice(0, 500),
    errorMsg,
  ]);

  // Update last_synced + sync_count
  if (success) {
    await pool.query(`
      UPDATE webhook_configs
      SET last_synced = NOW(), sync_count = sync_count + 1, last_error = NULL
      WHERE id = $1
    `, [config.id]);
  } else {
    await pool.query(
      'UPDATE webhook_configs SET last_error = $1 WHERE id = $2',
      [errorMsg, config.id]
    );
    console.error(`[Webhook] Sync failed for builder ${mongoId}:`, errorMsg);
  }
}

module.exports = { syncLead, toHubSpotPayload, toZohoPayload };