// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const ROLES = ['superadmin', 'builder', 'manager', 'agent', 'viewer'];
const PLANS = ['starter', 'growth', 'enterprise'];

const userSchema = new mongoose.Schema({
  // ── Identity ──────────────────────────────────────────────────────────────
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },          // null for OAuth-only users
  phone:    { type: String, default: null },
  company:  { type: String, trim: true, default: '' },
  avatarUrl:{ type: String, default: null },

  // ── Role & Org (multi-tenancy) ─────────────────────────────────────────────
  role:        { type: String, enum: ROLES, default: 'builder', index: true },
  orgId:       { type: String, default: null, index: true }, // PostgreSQL organizations.id (UUID)
  orgName:     { type: String, default: null },
  orgSlug:     { type: String, default: null },
  permissions: { type: Object, default: {} },         // fine-grained permission overrides

  // ── OAuth ──────────────────────────────────────────────────────────────────
  googleId:    { type: String, default: null, sparse: true, index: true },
  isOAuthUser: { type: Boolean, default: false },
  oauthProvider: { type: String, enum: ['google', null], default: null },

  // ── Plan ──────────────────────────────────────────────────────────────────
  plan:               { type: String, enum: PLANS, default: 'starter' },
  planStatus:         { type: String, enum: ['active', 'trialing', 'past_due', 'cancelled'], default: 'active' },
  subscriptionEndsAt: { type: Date, default: null },
  trialEndsAt:        { type: Date, default: null },
  lastPaymentAt:      { type: Date, default: null },
  stripeCustomerId:   { type: String, default: null },
  maxWidgets:         { type: Number, default: 1 },
  maxLeadsPerMonth:   { type: Number, default: 50 },
  monthlyLeads:       { type: Number, default: 0 },
  monthReset:         { type: Date, default: Date.now },

  // ── API ───────────────────────────────────────────────────────────────────
  apiKey:      { type: String, unique: true, sparse: true },
  widgetConfig:{ type: Object, default: { agentName: 'PropAgent', primaryColor: '#1a56db', position: 'bottom-right' } },
  projectInfo: { type: Object, default: {} },
  website:     { type: String, default: '' },
  isOnboarded: { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true, index: true },

  // ── Account state ─────────────────────────────────────────────────────────
  emailVerified:      { type: Boolean, default: false },
  emailVerifyToken:   { type: String, default: null, select: false },
  emailVerifyExpires: { type: Date, default: null },
  lastLoginAt:        { type: Date, default: null },
  loginCount:         { type: Number, default: 0 },
  failedLoginCount:   { type: Number, default: 0 },
  lockedUntil:        { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ── Indexes ────────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ orgId: 1, role: 1 });

// ── Pre-save: hash password ────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Pre-save: generate API key for builders ────────────────────────────────────
userSchema.pre('save', function (next) {
  if (!this.apiKey && (this.role === 'builder' || this.role === 'superadmin')) {
    this.apiKey = 'pa_' + crypto.randomBytes(24).toString('hex');
  }
  next();
});

// ── Instance method: compare password ─────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// ── Instance method: apply plan limits ────────────────────────────────────────
userSchema.methods.applyPlanLimits = function () {
  const LIMITS = {
    starter:    { maxWidgets: 1,      maxLeadsPerMonth: 50 },
    growth:     { maxWidgets: 5,      maxLeadsPerMonth: 99999 },
    enterprise: { maxWidgets: 99999,  maxLeadsPerMonth: 99999 },
  };
  const l = LIMITS[this.plan] || LIMITS.starter;
  this.maxWidgets = l.maxWidgets;
  this.maxLeadsPerMonth = l.maxLeadsPerMonth;
};

// ── Instance method: is account locked? ───────────────────────────────────────
userSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > new Date();
};

// ── Instance method: handle failed login ──────────────────────────────────────
userSchema.methods.incFailedLogin = async function () {
  this.failedLoginCount += 1;
  if (this.failedLoginCount >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
  }
  await this.save();
};

// ── Instance method: reset failed login ───────────────────────────────────────
userSchema.methods.resetFailedLogin = async function () {
  this.failedLoginCount = 0;
  this.lockedUntil = null;
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  await this.save();
};

// ── Virtual: is plan active ────────────────────────────────────────────────────
userSchema.virtual('isPlanActive').get(function () {
  if (this.plan === 'starter') return true;
  if (!this.subscriptionEndsAt) return false;
  return new Date(this.subscriptionEndsAt) > new Date();
});

// ── Static: safe fields for API response ─────────────────────────────────────
userSchema.statics.safeFields =
  '_id name email phone company avatarUrl role orgId orgName orgSlug plan planStatus maxWidgets maxLeadsPerMonth apiKey widgetConfig projectInfo website isOnboarded isActive emailVerified lastLoginAt loginCount createdAt';

module.exports = mongoose.models.User || mongoose.model('User', userSchema);