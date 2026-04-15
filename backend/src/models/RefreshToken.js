// backend/src/models/RefreshToken.js
// Tracks issued refresh tokens for rotation + revocation.
const mongoose = require('mongoose');
const crypto   = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash:  { type: String, required: true, unique: true },   // SHA-256 of raw token
  familyId:   { type: String, required: true, index: true },    // UUID — revoke family on reuse
  userAgent:  { type: String, default: null },
  ipAddress:  { type: String, default: null },
  expiresAt:  { type: Date, required: true },
  revokedAt:  { type: Date, default: null },
  replacedBy: { type: String, default: null },                  // tokenHash of successor
}, { timestamps: true });

// TTL index — MongoDB auto-removes expired tokens after 35 days
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3024000 }); // 35 days

refreshTokenSchema.statics.hash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

refreshTokenSchema.methods.isValid = function () {
  return !this.revokedAt && this.expiresAt > new Date();
};

module.exports = mongoose.models.RefreshToken ||
  mongoose.model('RefreshToken', refreshTokenSchema);