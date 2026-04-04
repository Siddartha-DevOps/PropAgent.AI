const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { chat } = require('../services/claudeAgent');

const sessions = new Map();

// FIX: Check API key early and return clear error
function checkApiKey(res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key_here' || key.trim() === '') {
    res.status(503).json({
      error: 'ANTHROPIC_API_KEY not configured',
      message: "I'm not connected to AI yet. Please add your ANTHROPIC_API_KEY to backend/.env and restart the server.",
      fix: 'Open backend/.env → set ANTHROPIC_API_KEY=sk-ant-...'
    });
    return false;
  }
  return true;
}

// Start a new chat session
router.post('/start', (req, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    sessionId,
    messages: [],
    extractedData: {},
    intentScore: 0,
    classification: 'cold',
    startTime: new Date()
  });
  res.json({ sessionId });
});

// Send a message and get AI response
router.post('/message', async (req, res) => {
  if (!checkApiKey(res)) return;

  const { sessionId, message, builderConfig } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      messages: [],
      extractedData: {},
      intentScore: 0,
      classification: 'cold',
      startTime: new Date()
    };
    sessions.set(sessionId, session);
  }

  const userMsg = { role: 'user', content: message, timestamp: new Date() };
  const messages = [...(session.messages || []), userMsg];

  try {
    const result = await chat(messages, session, builderConfig || {});

    // FIX: Always ensure message is a string
    const responseMessage = (result.message && typeof result.message === 'string' && result.message.trim())
      ? result.message.trim()
      : "I'm here to help you find your perfect home! Could you tell me what type of property you're looking for?";

    const assistantMsg = { role: 'assistant', content: responseMessage, timestamp: new Date() };
    const updatedMessages = [...messages, assistantMsg];

    sessions.set(sessionId, {
      ...session,
      messages: updatedMessages,
      extractedData: result.extractedData || {},
      intentScore: result.intentScore || 0,
      classification: result.classification || 'cold'
    });

    res.json({
      message: responseMessage,
      intentScore: result.intentScore || 0,
      classification: result.classification || 'cold',
      signals: result.signals || [],
      tags: result.tags || []
    });

  } catch (err) {
    console.error('Chat error:', err.message);

    // FIX: Always return a usable message, never let frontend get undefined
    let userFriendlyMessage = "I'm experiencing a connection issue. Please try again in a moment.";

    if (err.message?.includes('401') || err.message?.includes('authentication')) {
      userFriendlyMessage = "AI authentication failed. Please check your ANTHROPIC_API_KEY in backend/.env";
    } else if (err.message?.includes('rate') || err.message?.includes('429')) {
      userFriendlyMessage = "I'm getting too many requests right now. Please wait a moment and try again.";
    }

    res.status(500).json({
      error: 'AI service error',
      message: userFriendlyMessage,
      details: err.message
    });
  }
});

// Get session data
router.get('/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

module.exports = router;