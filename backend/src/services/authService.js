// backend/src/services/authService.js
const crypto       = require('crypto');
const { Pool }     = require('pg');
const User         = require('../models/User');
const Organization = require('../models/Organization');
const tokenService = require('./tokenService');
const emailService = require('./emailService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Register new builder ────────────────────────────────────────────────────────
async function register({ name, email, password, company, phone }) {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  // Create user
  const user = new User({ name, email, password, company: company || '', phone: phone || null, role: 'builder' });
  user.applyPlanLimits();

  // Generate email verification token
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerifyToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await user.save();

  // Provision an Organization for this builder
  const orgSlug = await _uniqueSlug(company || name);
  const org = await Organization.create({
    name:    company || name,
    slug:    orgSlug,
    ownerId: user._id,
    plan:    'starter',
  });

  // Backfill org into user
  user.orgId   = org._id.toString();
  user.orgName = org.name;
  user.orgSlug = org.slug;
  await user.save();

  // Sync org to PostgreSQL organizations table
  try {
    const { rows } = await pool.query(
      `INSERT INTO organizations (mongo_id, name, slug, plan)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (mongo_id) DO UPDATE SET name=EXCLUDED.name
       RETURNING id`,
      [org._id.toString(), org.name, org.slug, 'starter']
    );
    await Organization.findByIdAndUpdate(org._id, { pgId: rows[0].id });
  } catch (e) {
    console.warn('[authService] PG org sync failed (non-fatal):', e.message);
  }

  // Send verification email (non-blocking)
  _sendVerificationEmail(user, rawToken).catch(console.warn);

  return user;
}

// ── Login ────────────────────────────────────────────────────────────────────────
async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  if (!user.isActive) throw Object.assign(new Error('Account deactivated'), { status: 403 });
  if (user.isLocked()) throw Object.assign(new Error('Account temporarily locked — try again in 15 minutes'), { status: 429 });
  if (!user.password) throw Object.assign(new Error('This account uses Google sign-in. Please use "Continue with Google".'), { status: 400 });

  const valid = await user.comparePassword(password);
  if (!valid) {
    await user.incFailedLogin();
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  await user.resetFailedLogin();
  return user;
}

// ── Upsert Google OAuth user ────────────────────────────────────────────────────
async function upsertGoogleUser({ googleId, email, name, avatarUrl }) {
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    const orgSlug = await _uniqueSlug(name);
    user = await User.create({
      name, email, googleId,
      avatarUrl:     avatarUrl || null,
      isOAuthUser:   true,
      oauthProvider: 'google',
      emailVerified: true,
      role:          'builder',
    });
    user.applyPlanLimits();

    const org = await Organization.create({
      name:    name,
      slug:    orgSlug,
      ownerId: user._id,
    });
    user.orgId   = org._id.toString();
    user.orgName = org.name;
    user.orgSlug = org.slug;
    await user.save();

    try {
      const { rows } = await pool.query(
        `INSERT INTO organizations (mongo_id, name, slug) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
        [org._id.toString(), org.name, org.slug]
      );
      if (rows[0]) await Organization.findByIdAndUpdate(org._id, { pgId: rows[0].id });
    } catch (e) {}
  } else {
    // Merge Google ID if missing
    if (!user.googleId) { user.googleId = googleId; user.isOAuthUser = true; user.oauthProvider = 'google'; }
    if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
    user.emailVerified = true;
    await user.resetFailedLogin();
  }

  // Upsert oauth_accounts in Postgres for audit
  try {
    await pool.query(
      `INSERT INTO oauth_accounts (mongo_user_id, provider, provider_uid, email, display_name, avatar_url)
       VALUES ($1,'google',$2,$3,$4,$5)
       ON CONFLICT (provider, provider_uid) DO UPDATE
         SET email=$3, display_name=$4, avatar_url=$5, updated_at=NOW()`,
      [user._id.toString(), googleId, email, name, avatarUrl]
    );
  } catch (e) {}

  return user;
}

// ── Verify email ──────────────────────────────────────────────────────────────
async function verifyEmail(rawToken) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user   = await User.findOne({
    emailVerifyToken:   hashed,
    emailVerifyExpires: { $gt: new Date() },
  });
  if (!user) throw Object.assign(new Error('Invalid or expired verification link'), { status: 400 });
  user.emailVerified      = true;
  user.emailVerifyToken   = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  return user;
}

// ── Request password reset ────────────────────────────────────────────────────
async function forgotPassword(email) {
  const user = await User.findOne({ email });
  // Always return success to prevent email enumeration
  if (!user || user.isOAuthUser) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash     = crypto.createHash('sha256').update(rawToken).digest('hex');

  await pool.query(
    `INSERT INTO password_reset_tokens (mongo_user_id, token_hash, expires_at)
     VALUES ($1,$2,$3)`,
    [user._id.toString(), hash, new Date(Date.now() + 60 * 60 * 1000)] // 1h
  );

  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${rawToken}`;
  await emailService.sendPasswordReset?.({ to: email, name: user.name, resetUrl })
    .catch(console.warn);
}

// ── Reset password ────────────────────────────────────────────────────────────
async function resetPassword(rawToken, newPassword) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash=$1 AND used_at IS NULL AND expires_at > NOW()`,
    [hash]
  );
  if (!rows.length) throw Object.assign(new Error('Invalid or expired reset link'), { status: 400 });

  const user = await User.findById(rows[0].mongo_user_id).select('+password');
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  user.password          = newPassword;
  user.failedLoginCount  = 0;
  user.lockedUntil       = null;
  await user.save();

  await pool.query(`UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=$1`, [hash]);
  await tokenService.revokeAllUserTokens(user._id);

  return user;
}

// ── Audit log helper ──────────────────────────────────────────────────────────
async function auditLog(userId, action, req, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO auth_audit_logs (mongo_user_id, action, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        userId?.toString() || null,
        action,
        req?.ip || null,
        req?.headers?.['user-agent']?.slice(0, 250) || null,
        JSON.stringify(metadata),
      ]
    );
  } catch (e) {
    console.warn('[authService] Audit log failed:', e.message);
  }
}

// ── Private: unique org slug ──────────────────────────────────────────────────
async function _uniqueSlug(base) {
  let slug    = Organization.generateSlug(base);
  let counter = 0;
  while (await Organization.findOne({ slug })) {
    counter++;
    slug = `${Organization.generateSlug(base)}-${counter}`;
  }
  return slug;
}

// ── Private: send email verification ─────────────────────────────────────────
async function _sendVerificationEmail(user, rawToken) {
  const url = `${FRONTEND_URL}/auth/verify-email?token=${rawToken}`;
  await emailService.sendEmailVerification?.({ to: user.email, name: user.name, verifyUrl: url });
}

module.exports = {
  register,
  login,
  upsertGoogleUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  auditLog,
};