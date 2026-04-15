// backend/src/models/Organization.js
// One Organization = one builder's tenant.
// All bots, leads, and docs are scoped to an orgId.
const mongoose = require('mongoose');

const orgSchema = new mongoose.Schema({
  // Mirrors PostgreSQL organizations.id (UUID) — set after PG insert
  pgId:      { type: String, unique: true, sparse: true },

  name:      { type: String, required: true, trim: true },
  slug:      { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Owner (the builder who created this org)
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  plan:      { type: String, enum: ['starter', 'growth', 'enterprise'], default: 'starter' },
  isActive:  { type: Boolean, default: true },

  // Branding
  logoUrl:      { type: String, default: null },
  primaryColor: { type: String, default: '#1a56db' },
  website:      { type: String, default: null },

  // Limits (copied from owner's plan for fast reads)
  maxWidgets:       { type: Number, default: 1 },
  maxLeadsPerMonth: { type: Number, default: 50 },
  maxTeamMembers:   { type: Number, default: 1 },

  // Metadata
  industry:     { type: String, default: 'real_estate' },
  city:         { type: String, default: null },
  memberCount:  { type: Number, default: 1 },
}, { timestamps: true });

orgSchema.index({ slug: 1 });
orgSchema.index({ ownerId: 1 });

// Generate a URL-safe slug from name
orgSchema.statics.generateSlug = function (name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
};

module.exports = mongoose.models.Organization || mongoose.model('Organization', orgSchema);