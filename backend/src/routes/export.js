/**
 * export.js (Routes)
 * -------------------
 * Analytics Export API for PropAgent.AI.
 * Builders download their leads and analytics as CSV or PDF from the CRM.
 *
 * FILE: backend/src/routes/export.js
 * STATUS: NEW
 *
 * Endpoints:
 *   GET /api/export/leads/csv          Export leads as CSV
 *   GET /api/export/leads/pdf          Export leads report as PDF
 *   GET /api/export/analytics/csv      Export daily analytics as CSV
 *   GET /api/export/analytics/pdf      Export analytics summary as PDF
 *
 * Query params (all optional):
 *   dateFrom, dateTo, intentLabel (HIGH|MEDIUM|LOW), buyerType (local|nri|investor)
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');
const { leadsToCSV, analyticsToCSV, generateLeadReportPDF } = require('../services/exportService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// All export routes require auth + at least basic plan
router.use(authMiddleware, requirePlan('basic'));

// ─── Helper: Build lead query with filters ────────────────────────────────────
async function fetchLeads(builderId, filters = {}) {
  const { dateFrom, dateTo, intentLabel, buyerType } = filters;

  const conditions = ['b.mongo_id = $1'];
  const params = [builderId];
  let idx = 2;

  if (dateFrom) { conditions.push(`l.created_at >= $${idx++}`); params.push(dateFrom); }
  if (dateTo)   { conditions.push(`l.created_at <= $${idx++}`); params.push(dateTo); }
  if (intentLabel) { conditions.push(`l.intent_label = $${idx++}`); params.push(intentLabel.toUpperCase()); }
  if (buyerType)   { conditions.push(`l.buyer_type = $${idx++}`); params.push(buyerType.toLowerCase()); }

  const { rows } = await pool.query(`
    SELECT
      l.name, l.phone, l.email, l.intent_score, l.intent_label,
      l.buyer_type, l.budget_min, l.budget_max, l.preferred_bhk,
      l.status, l.source_page, l.created_at
    FROM leads l
    JOIN builders b ON b.id = l.builder_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY l.intent_score DESC, l.created_at DESC
    LIMIT 5000
  `, params);

  return rows;
}

// ─── GET /api/export/leads/csv ────────────────────────────────────────────────
router.get('/leads/csv', async (req, res) => {
  try {
    const leads = await fetchLeads(req.user._id.toString(), req.query);

    if (!leads.length) {
      return res.status(404).json({ error: 'No leads found for the selected filters.' });
    }

    const csv = leadsToCSV(leads);
    const filename = `propAgent_leads_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + csv); // BOM prefix for Excel compatibility
  } catch (err) {
    console.error('[Export] Leads CSV error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/export/leads/pdf ────────────────────────────────────────────────
router.get('/leads/pdf', requirePlan('pro'), async (req, res) => {
  try {
    const leads = await fetchLeads(req.user._id.toString(), req.query);

    // Summary stats
    const summary = {
      totalLeads:   leads.length,
      hotLeads:     leads.filter((l) => l.intent_label === 'HIGH').length,
      mediumLeads:  leads.filter((l) => l.intent_label === 'MEDIUM').length,
      coldLeads:    leads.filter((l) => l.intent_label === 'LOW').length,
      nriLeads:     leads.filter((l) => l.buyer_type === 'nri').length,
      conversions:  leads.filter((l) => l.status === 'converted').length,
    };

    // Get builder brand name
    const { rows: builderRows } = await pool.query(
      'SELECT brand_name FROM builders WHERE mongo_id = $1',
      [req.user._id.toString()]
    );

    const period = req.query.dateFrom && req.query.dateTo
      ? `${req.query.dateFrom} to ${req.query.dateTo}`
      : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const pdfBuffer = await generateLeadReportPDF({
      brandName: builderRows[0]?.brand_name || 'Your Company',
      period,
      summary,
      topLeads: leads.filter((l) => l.intent_label === 'HIGH').slice(0, 10),
    });

    const filename = `propAgent_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[Export] Leads PDF error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/export/analytics/csv ───────────────────────────────────────────
router.get('/analytics/csv', async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  try {
    const params = [req.user._id.toString()];
    const conditions = ['b.mongo_id = $1'];
    let idx = 2;

    if (dateFrom) { conditions.push(`da.date >= $${idx++}`); params.push(dateFrom); }
    if (dateTo)   { conditions.push(`da.date <= $${idx++}`); params.push(dateTo); }

    const { rows } = await pool.query(`
      SELECT da.*
      FROM daily_analytics da
      JOIN builders b ON b.id = da.builder_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY da.date DESC
      LIMIT 365
    `, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No analytics data found for the selected period.' });
    }

    const csv = analyticsToCSV(rows);
    const filename = `propAgent_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[Export] Analytics CSV error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;