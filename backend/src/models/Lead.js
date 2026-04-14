// backend/src/models/Lead.js
// Mirrors the leads table in Postgres (Supabase is source of truth for leads).
// This Mongo model is a lightweight cache / real-time mirror only.
// Write to Postgres via Supabase client; sync here for fast in-memory access if needed.
// If you don't need the mirror, delete this file and query Supabase directly.

const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    // Mirrors the Postgres leads.id UUID
    pgId:       { type: String, required: true, unique: true, index: true },
    botId:      { type: String, required: true, index: true },
    builderId:  { type: String, required: true },
    propertyId: { type: String, default: null },
    sessionId:  { type: String, default: null },
    // Contact
    name:  { type: String, required: true },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    // Scoring
    intentScore: { type: Number, default: 50, min: 0, max: 100 },
    intentLabel: {
      type: String,
      enum: ["cold", "warm", "hot"],
      default: "warm",
    },
    firstMessage: { type: String, default: null },
    // Status
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "converted", "lost"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);s