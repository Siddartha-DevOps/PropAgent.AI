// backend/src/models/Conversation.js
// Chat conversation — MongoDB is source of truth here (not Postgres).
// Each conversation holds its full message array.

const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    // Matches conversations.id in Postgres (created there first, referenced here)
    pgId:       { type: String, unique: true, sparse: true },
    botId:      { type: String, required: true, index: true },
    builderId:  { type: String, required: true },
    sessionId:  { type: String, required: true, index: true },
    leadId:     { type: String, default: null, index: true },
    sourcePage: { type: String, default: null },
    resolved:   { type: Boolean, default: false },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);