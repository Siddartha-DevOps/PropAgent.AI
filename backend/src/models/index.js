// backend/src/models/index.js
// Single export point for all Mongoose models.
// The root-level models/ folder is DELETED — these are the canonical definitions.

module.exports = {
  Builder:      require("./Builder"),
  Bot:          require("./Bot"),
  Session:      require("./Session"),
  Conversation: require("./Conversation"),
  Lead:         require("./Lead"),
};