/**
 * emailService.js
 * ----------------
 * Centralised email service for PropAgent.AI.
 * Uses Nodemailer with SMTP. All email templates live here.
 *
 * FILE: backend/src/services/emailService.js
 * STATUS: MODIFIED — adds team invite, price alert, and confirmation templates
 *
 * Templates added:
 *  - sendTeamInvite()         Team member invitation
 *  - sendAlertConfirmation()  Price alert subscription confirmation
 *  - sendPriceDropAlert()     Price drop notification to visitor
 *  - sendHotLeadNotification() Existing — hot lead detected
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'PropAgent.AI <noreply@propagent.ai>';

// ─── BASE TEMPLATE ─────────────────────────────────────────────────────────────
function baseEmail(title, bodyHtml) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#1a56db;padding:24px 32px;color:#fff">
    <div style="font-weight:700;font-size:18px">PropAgent.AI</div>
    <div style="margin-top:6px;font-size:14px;opacity:.9">${title}</div>
  </div>
  <div style="padding:28px 32px">${bodyHtml}</div>
  <div style="background:#f9fafb;padding:14px 32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb">
    © PropAgent.AI · AI Sales Platform for Real Estate
  </div>
</div>
</body></html>`.trim();
}

// ─── TEAM INVITE EMAIL ────────────────────────────────────────────────────────
/**
 * @param {{ to, name, inviterBrand, role, inviteUrl }}
 */
async function sendTeamInvite({ to, name, inviterBrand, role, inviteUrl }) {
  const body = `
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151"><strong>${inviterBrand}</strong> has invited you to join their sales team on PropAgent.AI as a <strong>${role}</strong>.</p>
    <p style="color:#374151">Click below to accept the invitation and set up your account:</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${inviteUrl}" style="background:#1a56db;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
        Accept Invitation
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px">This link expires in 72 hours. If you did not expect this invitation, you can safely ignore this email.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `You're invited to join ${inviterBrand} on PropAgent.AI`,
    html: baseEmail(`Team Invitation — ${role}`, body),
  });
}

// ─── PRICE ALERT CONFIRMATION ─────────────────────────────────────────────────
/**
 * @param {{ to, name, propertyName, unsubscribeUrl }}
 */
async function sendAlertConfirmation({ to, name, propertyName, unsubscribeUrl }) {
  const body = `
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">You've subscribed to price alerts for <strong>${propertyName}</strong>.</p>
    <p style="color:#374151">We'll notify you as soon as the price drops so you don't miss a great deal.</p>
    <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
      <div style="font-size:24px;margin-bottom:8px">🔔</div>
      <div style="color:#1e40af;font-weight:600">You're on the watchlist!</div>
      <div style="color:#1e40af;font-size:13px;margin-top:4px">We'll email you the moment prices move.</div>
    </div>
    <p style="color:#6b7280;font-size:12px">
      <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe from price alerts</a>
    </p>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `✅ Price Alert Set — ${propertyName}`,
    html: baseEmail('Price Alert Confirmed', body),
  });
}

// ─── PRICE DROP NOTIFICATION ──────────────────────────────────────────────────
/**
 * @param {{ to, name, propertyName, oldPrice, newPrice, dropPercent, bhkType }}
 */
async function sendPriceDropAlert({ to, name, propertyName, oldPrice, newPrice, dropPercent, bhkType }) {
  const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  const body = `
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">Great news! The price of <strong>${propertyName}</strong>${bhkType ? ` (${bhkType})` : ''} has dropped.</p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <div style="font-size:13px;color:#6b7280;margin-bottom:8px">Price Update</div>
      <div style="display:flex;justify-content:center;align-items:center;gap:16px">
        <div style="text-decoration:line-through;color:#9ca3af;font-size:20px">${formatINR(oldPrice)}</div>
        <div style="font-size:28px">→</div>
        <div style="color:#059669;font-size:28px;font-weight:700">${formatINR(newPrice)}</div>
      </div>
      <div style="margin-top:12px;background:#059669;color:#fff;display:inline-block;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:700">
        You save ${dropPercent}%!
      </div>
    </div>
    <p style="color:#374151">This is the price you were waiting for. Contact the sales team now to lock it in.</p>
    <p style="color:#6b7280;font-size:12px">Prices are subject to availability. This alert was triggered based on your preferences.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `📉 Price Drop Alert — ${propertyName} dropped ${dropPercent}%!`,
    html: baseEmail('Price Drop Alert', body),
  });
}

// ─── HOT LEAD NOTIFICATION (existing — updated template) ─────────────────────
/**
 * Notify the builder when a hot lead is detected.
 * @param {{ to, builderName, lead: { name, phone, intentScore, buyerType, budgetMax } }}
 */
async function sendHotLeadNotification({ to, builderName, lead }) {
  const body = `
    <p style="color:#374151">Hi ${builderName},</p>
    <p style="color:#374151">A <strong style="color:#dc2626">HIGH INTENT</strong> lead just came in through your PropAgent chat widget.</p>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:16px;margin:20px 0">
      <div style="color:#374151;font-size:14px;line-height:1.8">
        <strong>Name:</strong> ${lead.name || '—'}<br>
        <strong>Phone:</strong> ${lead.phone || '—'}<br>
        <strong>Intent Score:</strong> ${lead.intentScore || 0}/100<br>
        <strong>Buyer Type:</strong> ${lead.buyerType || 'local'}<br>
        <strong>Budget:</strong> ${lead.budgetMax ? `₹${Number(lead.budgetMax).toLocaleString('en-IN')}` : '—'}
      </div>
    </div>
    <p style="color:#374151">⚡ <strong>Call within 15 minutes</strong> to maximise conversion probability.</p>
    <div style="text-align:center;margin:20px 0">
      <a href="${process.env.FRONTEND_URL}/dashboard/leads"
         style="background:#1a56db;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
        View Lead in CRM →
      </a>
    </div>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `🔥 Hot Lead Alert — ${lead.name || 'New Visitor'} is ready to buy!`,
    html: baseEmail('Hot Lead Detected', body),
  });
}

module.exports = {
  sendTeamInvite,
  sendAlertConfirmation,
  sendPriceDropAlert,
  sendHotLeadNotification,
  transporter, // Export for testing
};

async function sendPasswordReset({ to, name, resetUrl }) {
  const body = `
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">We received a request to reset your PropAgent.AI password.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="background:#1a56db;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
        Reset password
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Reset your PropAgent.AI password`,
    html: baseEmail('Password Reset Request', body),
  });
}
 
// ── EMAIL VERIFICATION ────────────────────────────────────────────────────────
/**
 * @param {{ to, name, verifyUrl }}
 */
async function sendEmailVerification({ to, name, verifyUrl }) {
  const body = `
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">Welcome to PropAgent.AI! Please verify your email address to activate your account.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${verifyUrl}" style="background:#1a56db;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">
        Verify email address
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px">This link expires in 24 hours.</p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Verify your PropAgent.AI email`,
    html: baseEmail('Email Verification', body),
  });
}