// backend/routes/chat.js
const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const Session = require("../models/Session");

// ─── REMOVED: const sessions = new Map(); ───
// Sessions now live in MongoDB via the Session model.

/**
 * POST /api/chat
 * Body: { sessionId?, message, userId? }
 */
router.post("/", async (req, res) => {
  try {
    const { message, userId } = req.body;
    let { sessionId } = req.body;

    // 1. Resolve or create session
    let session;
    if (sessionId) {
      session = await Session.findOne({ sessionId });
    }

    if (!session) {
      sessionId = uuidv4();
      session = new Session({
        sessionId,
        userId: userId || null,
        messages: [],
      });
    }

    // 2. Append the user message
    session.messages.push({ role: "user", content: message });

    // 3. Build history for your AI call (last 20 messages to stay within context)
    const history = session.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4. Call your AI / LLM here — replace with your actual AI integration
    const aiReply = await callAI(history);   // ← your existing AI call

    // 5. Append assistant reply
    session.messages.push({ role: "assistant", content: aiReply });

    // 6. Optional: update lead score / intent from AI response
    // session.metadata.leadScore = detectLeadScore(aiReply);

    // 7. Persist to MongoDB
    await session.save();

    return res.json({
      sessionId,
      reply: aiReply,
      messageCount: session.messages.length,
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/chat/:sessionId/history
 * Returns full message history for a session
 */
router.get("/:sessionId/history", async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json({ sessionId: session.sessionId, messages: session.messages });
  } catch (err) {
    console.error("History route error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/chat/:sessionId
 * Clears a session
 */
router.delete("/:sessionId", async (req, res) => {
  try {
    await Session.deleteOne({ sessionId: req.params.sessionId });
    return res.json({ message: "Session cleared" });
  } catch (err) {
    console.error("Delete session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Placeholder: wire in your actual AI/LLM function ──────────────────
async function callAI(history) {
  // Replace this with your real OpenAI / Gemini / Claude call
  // Example with OpenAI:
  //
  // const { OpenAI } = require("openai");
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await openai.chat.completions.create({
  //   model: "gpt-4o",
  //   messages: history,
  // });
  // return response.choices[0].message.content;

  return "AI response placeholder — wire in your LLM here.";
}

module.exports = router;