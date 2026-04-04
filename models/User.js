const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  company:  { type: String, required: true },
  phone:    { type: String, default: null },
  plan:     { type: String, default: 'starter', enum: ['starter', 'growth', 'enterprise'] },
  isActive: { type: Boolean, default: true },
  widgetConfig: {
    primaryColor: { type: String, default: '#B8952A' },
    agentName:    { type: String, default: 'PropAgent' },
    greeting:     { type: String, default: "Hi! I'm your AI property advisor. What kind of home are you looking for?" },
    logo:         { type: String, default: null }
  },
  apiKey:       { type: String, unique: true },
  totalLeads:   { type: Number, default: 0 },
  monthlyLeads: { type: Number, default: 0 },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = 'pa_' + crypto.randomBytes(24).toString('hex');
  }
  next();
});

UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);