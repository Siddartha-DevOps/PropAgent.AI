/**
 * monthlyReportService.js
 * ------------------------
 * Monthly Builder Analytics Email — PropAgent.AI.
 * Sends each builder a personalised monthly performance email
 * with their lead funnel, top leads, and actionable insights.
 *
 * FILE: backend/src/services/monthlyReportService.js
 * STATUS: NEW
 *
 * Schedule: 1st of each month at 8:00 AM IST
 *
 * Dependencies:
 *   npm install node-cron nodemailer
 *
 * Usage:
 *   require('./services/monthlyReportService'); // in server.js — registers cron
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// ─── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── REPORT DATA FETCHER ──────────────────────────────────────────────────────

/**
 * Fetch monthly analytics for a single builder.
 * Compares current month vs previous month.
 *
 * @param {string} pgBuilderId - PostgreSQL UUID for the builder
 * @param {string} month       - ISO date string for first day of the month e.g. '2025-03-01'
 * @returns {Object} Report data
 */
async function fetchBuilderMonthlyData(pgBuilderId, month) {
  const monthStart = new Date(month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const prevMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0);

  const [currentStats, prevStats, topLeads, dailyTrend] = await Promise.all([
    // Current month stats
    pool.query(`
      SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (WHERE intent_label = 'HIGH')  AS hot_leads,
        COUNT(*) FILTER (WHERE intent_label = 'MEDIUM') AS medium_leads,
        COUNT(*) FILTER (WHERE intent_label = 'LOW')    AS cold_leads,
        COUNT(*) FILTER (WHERE buyer_type = 'nri')      AS nri_leads,
        COUNT(*) FILTER (WHERE status = 'converted')    AS conversions,
        ROUND(AVG(intent_score), 1)                     AS avg_intent
      FROM leads
      WHERE builder_id = $1 AND created_at BETWEEN $2 AND $3
    `, [pgBuilderId, monthStart, monthEnd]),

    // Previous month for comparison
    pool.query(`
      SELECT COUNT(*) AS total_leads,
             COUNT(*) FILTER (WHERE intent_label = 'HIGH') AS hot_leads,
             COUNT(*) FILTER (WHERE status = 'converted') AS conversions
      FROM leads
      WHERE builder_id = $1 AND created_at BETWEEN $2 AND $3
    `, [pgBuilderId, prevMonthStart, prevMonthEnd]),

    // Top 5 hot leads this month
    pool.query(`
      SELECT name, phone, intent_score, buyer_type, budget_max, preferred_bhk
      FROM leads
      WHERE builder_id = $1 AND created_at BETWEEN $2 AND $3
        AND intent_label = 'HIGH'
      ORDER BY intent_score DESC
      LIMIT 5
    `, [pgBuilderId, monthStart, monthEnd]),

    // Daily lead trend for the month
    pool.query(`
      SELECT date, total_leads, hot_leads
      FROM daily_analytics
      WHERE builder_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date ASC
    `, [pgBuilderId, monthStart, monthEnd]),
  ]);

  return {
    current: currentStats.rows[0],
    previous: prevStats.rows[0],
    topLeads: topLeads.rows,
    dailyTrend: dailyTrend.rows,
  };
}

// ─── EMAIL TEMPLATE ───────────────────────────────────────────────────────────

/**
 * Generate the HTML email body for a builder's monthly report.
 * Fully inline-styled for email client compatibility.
 */
function buildMonthlyEmailHTML(builderName, period, data) {
  const { current, previous } = data;

  const changeIcon = (curr, prev) => {
    if (!prev || prev === '0') return '';
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct > 0) return `<span style="color:#059669"> ↑ ${pct}%</span>`;
    if (pct < 0) return `<span style="color:#dc2626"> ↓ ${Math.abs(pct)}%</span>`;
    return '<span style="color:#6b7280"> →</span>';
  };

  const topLeadsHTML = data.topLeads.length > 0
    ? data.topLeads.map((l) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${l.name || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${l.phone || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1a56db;font-weight:600">${l.intent_score}/100</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${l.buyer_type || 'local'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding:12px;color:#6b7280;text-align:center">No hot leads this month. Keep going!</td></tr>';

  const convRate = current.total_leads > 0
    ? ((current.conversions / current.total_leads) * 100).toFixed(1)
    : '0.0';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:#1a56db;padding:32px 32px 24px;color:#fff">
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;margin-bottom:8px">Monthly Report</div>
      <h1 style="margin:0;font-size:22px;font-weight:700">${builderName}</h1>
      <div style="margin-top:6px;font-size:14px;opacity:.9">${period}</div>
    </div>

    <!-- KPI Cards -->
    <div style="padding:24px 32px 0">
      <div style="display:flex;gap:12px;flex-wrap:wrap">

        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:8px;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#1a56db">${current.total_leads || 0}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Total Leads ${changeIcon(current.total_leads, previous.total_leads)}</div>
        </div>

        <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:8px;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#dc2626">${current.hot_leads || 0}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Hot Leads ${changeIcon(current.hot_leads, previous.hot_leads)}</div>
        </div>

        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:8px;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#059669">${convRate}%</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Conversion Rate</div>
        </div>

        <div style="flex:1;min-width:120px;background:#faf5ff;border-radius:8px;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#7c3aed">${current.nri_leads || 0}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">NRI Leads</div>
        </div>

      </div>
    </div>

    <!-- Top Hot Leads -->
    <div style="padding:24px 32px 0">
      <h2 style="margin:0 0 12px;font-size:16px;color:#111827">Top Hot Leads This Month</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb">Name</th>
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb">Phone</th>
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb">Score</th>
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb">Type</th>
          </tr>
        </thead>
        <tbody>${topLeadsHTML}</tbody>
      </table>
    </div>

    <!-- Insights -->
    <div style="padding:20px 32px 0">
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px">
        <div style="font-weight:700;color:#92400e;margin-bottom:6px">💡 This month's insight</div>
        <div style="color:#78350f;font-size:13px">
          ${
            current.nri_leads > 2
              ? `You had ${current.nri_leads} NRI leads this month — consider enabling NRI-specific content on your chat widget to convert more.`
              : current.hot_leads > 5
              ? `You have ${current.hot_leads} hot leads! Make sure your sales team follows up within 24 hours — that's when conversion probability is highest.`
              : `Upload more property documents to your knowledge base to improve chat answer quality and lead qualification accuracy.`
          }
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:28px 32px;text-align:center">
      <a href="${process.env.FRONTEND_URL}/dashboard"
         style="background:#1a56db;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb">
      PropAgent.AI · You're receiving this because you have a PropAgent.AI account.<br>
      <a href="${process.env.FRONTEND_URL}/settings/notifications" style="color:#6b7280">Unsubscribe from monthly reports</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ─── SEND MONTHLY REPORTS ─────────────────────────────────────────────────────

/**
 * Fetch all active builders and send each a monthly report email.
 * Run on the 1st of each month.
 */
async function sendMonthlyReports() {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = lastMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' });

  console.log(`[MonthlyReport] Starting monthly report send for ${period}`);

  // Fetch all active builders with analytics data
  const { rows: builders } = await pool.query(`
    SELECT id, mongo_id, email, brand_name
    FROM builders
    WHERE is_active = true AND plan != 'free'
    ORDER BY created_at ASC
  `);

  console.log(`[MonthlyReport] Sending to ${builders.length} builders`);

  let sent = 0;
  let failed = 0;

  for (const builder of builders) {
    try {
      const data = await fetchBuilderMonthlyData(builder.id, lastMonthStart.toISOString());

      // Skip if no activity at all this month
      if (parseInt(data.current.total_leads) === 0) {
        console.log(`[MonthlyReport] Skipping ${builder.email} — no leads last month`);
        continue;
      }

      const html = buildMonthlyEmailHTML(
        builder.brand_name || 'Your Project',
        period,
        data
      );

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'PropAgent.AI <noreply@propagent.ai>',
        to: builder.email,
        subject: `📊 Your ${period} Lead Report — PropAgent.AI`,
        html,
      });

      sent++;
      console.log(`[MonthlyReport] ✓ Sent to ${builder.email}`);

      // Throttle: 2 emails/second to avoid SMTP rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`[MonthlyReport] ✗ Failed for ${builder.email}:`, err.message);
    }
  }

  console.log(`[MonthlyReport] Done. Sent: ${sent}, Failed: ${failed}, Skipped: ${builders.length - sent - failed}`);
}

// ─── CRON SCHEDULE ────────────────────────────────────────────────────────────

/**
 * Schedule: 1st of every month at 8:00 AM IST (UTC+5:30 = 2:30 AM UTC)
 * Cron format: minute hour day-of-month month day-of-week
 */
function scheduleMonthlyReports() {
  // Run at 02:30 UTC on the 1st of every month = 08:00 AM IST
  cron.schedule('30 2 1 * *', async () => {
    console.log('[MonthlyReport] Cron triggered — sending monthly reports');
    try {
      await sendMonthlyReports();
    } catch (err) {
      console.error('[MonthlyReport] Fatal error in cron job:', err);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[MonthlyReport] Monthly report cron scheduled (1st of each month, 8:00 AM IST)');
}

module.exports = {
  scheduleMonthlyReports,
  sendMonthlyReports,      // Export for manual trigger via admin route
  buildMonthlyEmailHTML,   // Export for preview in dashboard
};