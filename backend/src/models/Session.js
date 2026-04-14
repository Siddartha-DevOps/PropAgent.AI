// backend/models/Session.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const SessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: String, default: null },   // optional: tie to a user
    messages: [MessageSchema],
    metadata: {
      propertyId: { type: String, default: null },
      leadScore: { type: Number, default: 0 },
      intent: { type: String, default: null },
    },
    lastActive: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: { expires: 0 },  // MongoDB TTL auto-deletes expired sessions
    },
  },
  { timestamps: true }
);

// Bump lastActive on every save
SessionSchema.pre("save", function (next) {
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model("Session", SessionSchema);