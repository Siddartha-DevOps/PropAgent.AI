// backend/src/services/tokenService.js
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { v4: uuid } = require('uuid');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_SECRET  = process.env.JWT_SECRET        || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TTL     = '15m';
const REFRESH_TTL    = 30 * 24 * 60 * 60; // 30 days in seconds

// ── Generate access token (short-lived, 15 min) ────────────────────────────────
function signAccessToken(user) {
  return jwt.sign(
    {
      userId:  user._id.toString(),
      email:   user.email,
      role:    user.role,
      orgId:   user.orgId || null,
      plan:    user.plan || 'starter',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

// ── Generate raw refresh token + persist hash ──────────────────────────────────
async function issueRefreshToken(user, { userAgent, ipAddress, familyId } = {}) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = RefreshToken.hash(rawToken);
  const family    = familyId || uuid();

  await RefreshToken.create({
    userId:    user._id,
    tokenHash,
    familyId:  family,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
  });

  return { rawToken, familyId: family };
}

// ── Verify access token ────────────────────────────────────────────────────────
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

// ── Rotate refresh token ───────────────────────────────────────────────────────
// Returns new access + refresh tokens, revokes old token.
// On reuse detection (token already revoked) → revoke entire family.
async function rotateRefreshToken(rawToken, { userAgent, ipAddress } = {}) {
  const tokenHash = RefreshToken.hash(rawToken);
  const stored    = await RefreshToken.findOne({ tokenHash }).populate('userId');

  if (!stored) throw new Error('Refresh token not found');

  if (stored.revokedAt) {
    // Reuse detected — revoke entire family (token theft scenario)
    await RefreshToken.updateMany(
      { familyId: stored.familyId, revokedAt: null },
      { revokedAt: new Date() }
    );
    throw new Error('Refresh token reuse detected — all sessions invalidated');
  }

  if (stored.expiresAt < new Date()) throw new Error('Refresh token expired');

  const user = stored.userId; // populated
  if (!user || !user.isActive) throw new Error('User not found or deactivated');

  // Revoke old token and issue new pair
  stored.revokedAt   = new Date();
  stored.replacedBy  = 'rotating';
  await stored.save();

  const accessToken           = signAccessToken(user);
  const { rawToken: newRaw, familyId } = await issueRefreshToken(user, {
    userAgent,
    ipAddress,
    familyId: stored.familyId,
  });

  return { accessToken, refreshToken: newRaw, user };
}

// ── Revoke a single refresh token (logout) ────────────────────────────────────
async function revokeRefreshToken(rawToken) {
  const tokenHash = RefreshToken.hash(rawToken);
  await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
}

// ── Revoke all refresh tokens for a user (logout all devices) ─────────────────
async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────
const COOKIE_NAME = 'pa_rt';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   REFRESH_TTL * 1000,
  path:     '/api/auth',
};

function setRefreshCookie(res, rawToken) {
  res.cookie(COOKIE_NAME, rawToken, COOKIE_OPTS);
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
}

function getRefreshFromCookie(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshFromCookie,
  COOKIE_NAME,
};