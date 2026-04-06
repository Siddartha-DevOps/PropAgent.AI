/**
 * exportService.js + export.js (Routes)
 * ----------------------------------------
 * Analytics Export System for PropAgent.AI.
 * Generates downloadable CSV and PDF reports from lead/analytics data.
 *
 * FILE: backend/src/services/exportService.js
 * STATUS: NEW
 *
 * Dependencies:
 *   npm install json2csv pdfkit
 */

const { Parser: Json2CsvParser } = require('json2csv');
const PDFDocument = require('pdfkit');

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

/**
 * Convert an array of lead objects to a CSV string.
 *
 * @param {Object[]} leads - Array of lead records from PostgreSQL
 * @returns {string} CSV content
 */
function leadsToCSV(leads) {
  const fields = [
    { label: 'Name',         value: 'name' },
    { label: 'Phone',        value: 'phone' },
    { label: 'Email',        value: 'email' },
    { label: 'Intent Score', value: 'intent_score' },
    { label: 'Intent',       value: 'intent_label' },
    { label: 'Buyer Type',   value: 'buyer_type' },
    { label: 'Budget Min',   value: (row) => row.budget_min ? `₹${Number(row.budget_min).toLocaleString('en-IN')}` : '' },
    { label: 'Budget Max',   value: (row) => row.budget_max ? `₹${Number(row.budget_max).toLocaleString('en-IN')}` : '' },
    { label: 'BHK Pref',     value: 'preferred_bhk' },
    { label: 'Status',       value: 'status' },
    { label: 'Source Page',  value: 'source_page' },
    { label: 'Created At',   value: (row) => new Date(row.created_at).toLocaleString('en-IN') },
  ];

  const parser = new Json2CsvParser({ fields });
  return parser.parse(leads);
}

/**
 * Convert daily analytics data to CSV.
 *
 * @param {Object[]} analytics - Daily analytics rows
 * @returns {string} CSV content
 */
function analyticsToCSV(analytics) {
  const fields = [
    { label: 'Date',         value: (r) => new Date(r.date).toLocaleDateString('en-IN') },
    { label: 'Total Chats',  value: 'total_chats' },
    { label: 'Total Leads',  value: 'total_leads' },
    { label: 'Hot Leads',    value: 'hot_leads' },
    { label: 'Medium Leads', value: 'medium_leads' },
    { label: 'Cold Leads',   value: 'cold_leads' },
    { label: 'Avg Intent',   value: 'avg_intent_score' },
    { label: 'NRI Leads',    value: 'nri_leads' },
    { label: 'Investor Leads', value: 'investor_leads' },
  ];

  const parser = new Json2CsvParser({ fields });
  return parser.parse(analytics);
}

// ─── PDF REPORT ───────────────────────────────────────────────────────────────

/**
 * Generate a formatted PDF analytics report using PDFKit.
 * Returns a Buffer containing the PDF bytes.
 *
 * @param {Object} data
 * @param {string} data.brandName       - Builder's brand name
 * @param {string} data.period          - Report period label e.g. "March 2025"
 * @param {Object} data.summary         - { totalLeads, hotLeads, mediumLeads, coldLeads, nriLeads, conversions }
 * @param {Object[]} data.topLeads      - Top 10 hot leads for the report
 * @param {Object[]} data.dailyTrend    - Day-by-day lead counts for the period
 * @returns {Promise<Buffer>}
 */
function generateLeadReportPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BLUE = '#1a56db';
    const DARK = '#111827';
    const GRAY = '#6b7280';
    const LIGHT = '#f3f4f6';
    const GREEN = '#059669';
    const RED = '#dc2626';

    const pageW = doc.page.width - 100; // usable width

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(BLUE);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text('PropAgent.AI', 50, 24);
    doc.fontSize(12).font('Helvetica')
      .text(`Lead Analytics Report — ${data.period}`, 50, 52);
    doc.fontSize(10)
      .text(data.brandName, doc.page.width - 200, 52, { width: 150, align: 'right' });

    doc.moveDown(3);

    // ── Summary Cards ─────────────────────────────────────────────────────────
    doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Summary', 50);
    doc.moveDown(0.5);

    const cards = [
      { label: 'Total Leads',    value: data.summary.totalLeads,    color: BLUE },
      { label: 'Hot Leads',      value: data.summary.hotLeads,      color: RED },
      { label: 'Conversions',    value: data.summary.conversions,   color: GREEN },
      { label: 'NRI Leads',      value: data.summary.nriLeads,      color: '#7c3aed' },
    ];

    const cardW = (pageW - 30) / 4;
    const cardX = 50;
    const cardY = doc.y;

    cards.forEach((card, i) => {
      const x = cardX + i * (cardW + 10);
      doc.roundedRect(x, cardY, cardW, 60, 6).fill(LIGHT);
      doc.fillColor(card.color).fontSize(24).font('Helvetica-Bold')
        .text(String(card.value), x + 10, cardY + 10, { width: cardW - 20, align: 'center' });
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
        .text(card.label, x + 10, cardY + 40, { width: cardW - 20, align: 'center' });
    });

    doc.y = cardY + 80;

    // ── Conversion Rate ───────────────────────────────────────────────────────
    const convRate = data.summary.totalLeads > 0
      ? ((data.summary.conversions / data.summary.totalLeads) * 100).toFixed(1)
      : '0.0';

    doc.fillColor(DARK).fontSize(11).font('Helvetica')
      .text(`Conversion Rate: ${convRate}%  |  Medium Leads: ${data.summary.mediumLeads}  |  Cold Leads: ${data.summary.coldLeads}`, 50);
    doc.moveDown(1.5);

    // ── Hot Leads Table ───────────────────────────────────────────────────────
    if (data.topLeads && data.topLeads.length > 0) {
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Top Hot Leads');
      doc.moveDown(0.5);

      // Table header
      const cols = [
        { label: 'Name',         w: 130 },
        { label: 'Phone',        w: 100 },
        { label: 'Intent',       w: 50  },
        { label: 'Buyer Type',   w: 80  },
        { label: 'Budget',       w: 110 },
      ];

      let tx = 50;
      const headerY = doc.y;
      doc.rect(50, headerY - 5, pageW, 20).fill(BLUE);
      cols.forEach((col) => {
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
          .text(col.label, tx + 4, headerY, { width: col.w - 4 });
        tx += col.w;
      });
      doc.y = headerY + 20;

      data.topLeads.slice(0, 10).forEach((lead, rowIdx) => {
        if (doc.y > 700) doc.addPage();

        const rowY = doc.y;
        if (rowIdx % 2 === 1) {
          doc.rect(50, rowY - 3, pageW, 18).fill(LIGHT);
        }

        const budget = lead.budget_max
          ? `₹${Math.round(lead.budget_max / 100000)}L`
          : '—';

        const rowData = [
          { text: lead.name || '—',         w: 130 },
          { text: lead.phone || '—',        w: 100 },
          { text: lead.intent_label || '—', w: 50  },
          { text: lead.buyer_type || '—',   w: 80  },
          { text: budget,                   w: 110 },
        ];

        let rx = 50;
        rowData.forEach((cell) => {
          doc.fillColor(DARK).fontSize(8).font('Helvetica')
            .text(cell.text, rx + 4, rowY, { width: cell.w - 8 });
          rx += cell.w;
        });
        doc.y = rowY + 18;
      });

      doc.moveDown(1.5);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(LIGHT);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
      .text(
        `Generated by PropAgent.AI on ${new Date().toLocaleString('en-IN')}  |  Confidential — for internal use only.`,
        50, doc.page.height - 28, { width: pageW, align: 'center' }
      );

    doc.end();
  });
}

module.exports = { leadsToCSV, analyticsToCSV, generateLeadReportPDF };