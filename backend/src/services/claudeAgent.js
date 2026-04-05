/**
 * claudeAgent.js
 * ---------------
 * PropAgent.AI's core AI conversation engine.
 * Integrates with Anthropic Claude API and injects RAG context
 * from the builder's uploaded knowledge base before each response.
 *
 * LOCATION: backend/src/services/claudeAgent.js
 * STATUS: MODIFIED (RAG context injection added)
 *
 * Flow:
 *   1. Receive visitor message + conversation history + builderId
 *   2. Retrieve relevant knowledge chunks via ragService.retrieveContext()
 *   3. Build a dynamic system prompt using builder config + RAG context
 *   4. Send to Claude claude-opus-4-5 with full conversation history
 *   5. Return Claude's reply + metadata for intent scoring
 */

const Anthropic = require('@anthropic-ai/sdk');
const ragService = require('./ragService');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Claude model to use ─────────────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-opus-4-5';
const MAX_TOKENS = 1024;

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * Build the dynamic system prompt for this conversation.
 * Injects:
 *  - Builder's brand name and tone
 *  - Retrieved RAG knowledge as context
 *  - Visitor qualification instructions
 *  - Lead capture instructions
 *
 * @param {Object} builderConfig  - Builder settings from the DB
 * @param {string} ragContext     - Top-K relevant chunks from knowledge base
 * @returns {string}              - Complete system prompt for Claude
 */
function buildSystemPrompt(builderConfig, ragContext) {
  const brand = builderConfig?.brandName || 'this real estate developer';
  const tone = builderConfig?.tone || 'professional, warm, and helpful';
  const language = builderConfig?.language || 'English';

  // Base identity
  let prompt = `You are PropAgent, an expert AI sales assistant for ${brand}.
Your role is to help website visitors find their ideal property, answer questions, and guide them toward booking a site visit.
Tone: ${tone}. Language: ${language}.

CORE RESPONSIBILITIES:
1. Answer property-related questions using the knowledge base provided below.
2. Recommend suitable properties based on visitor preferences (budget, location, BHK type, lifestyle).
3. Qualify buyer intent by gently asking about budget, timeline, family size, and purpose (investment vs self-use).
4. Collect the visitor's name and phone number before ending the conversation.
5. If a visitor seems highly interested, encourage them to book a site visit or call.

LEAD QUALIFICATION SIGNALS TO WATCH FOR:
- Mentions specific budget range → HIGH interest
- Asks about possession date or handover timeline → HIGH interest
- Asks about EMI or home loan → HIGH interest
- Asks about floor plan or specific unit → HIGH interest
- Just browsing or comparing multiple projects → MEDIUM interest
- No budget clarity and vague requirements → LOW interest

RULES:
- Never make up property details. Only use information from the knowledge base below.
- If you don't know something, say "Let me connect you with our sales team for this detail."
- Always be polite. Never pressure the visitor.
- Keep responses concise (2-4 sentences). Avoid walls of text.
- After 3-4 exchanges, try to collect the visitor's name and phone number.
`;

  // Inject RAG context if available
  if (ragContext && ragContext.trim().length > 0) {
    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KNOWLEDGE BASE (use this to answer questions):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ragContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  } else {
    prompt += `
NOTE: No specific property knowledge has been uploaded yet. 
Answer general real estate questions and encourage the visitor to connect with the sales team for specific details.
`;
  }

  return prompt;
}

// ─── Main agent function ──────────────────────────────────────────────────────

/**
 * Send a visitor message to Claude and get a response.
 * This is the primary function called from chat.js route.
 *
 * @param {Object} options
 * @param {string}   options.userMessage     - Latest message from the visitor
 * @param {Array}    options.conversationHistory - Previous messages [{role, content}]
 * @param {string}   options.builderId       - MongoDB _id of the builder
 * @param {Object}   [options.builderConfig] - Builder settings (brand name, tone, etc.)
 * @param {boolean}  [options.useRAG=true]   - Whether to retrieve RAG context
 *
 * @returns {Promise<Object>} { reply: string, ragContextUsed: boolean, tokensUsed: number }
 */
async function chat({
  userMessage,
  conversationHistory = [],
  builderId,
  builderConfig = {},
  useRAG = true,
}) {
  try {
    // ── Step 1: Retrieve relevant knowledge chunks ─────────────────────────
    let ragContext = '';
    let ragContextUsed = false;

    if (useRAG && builderId) {
      try {
        ragContext = await ragService.retrieveContext(
          userMessage,
          builderId,
          5 // top 5 most relevant chunks
        );
        ragContextUsed = ragContext.length > 0;
      } catch (ragErr) {
        // RAG failure is non-fatal — Claude will still respond
        console.warn('[ClaudeAgent] RAG retrieval failed:', ragErr.message);
      }
    }

    // ── Step 2: Build system prompt with RAG context ───────────────────────
    const systemPrompt = buildSystemPrompt(builderConfig, ragContext);

    // ── Step 3: Build message array for Claude ─────────────────────────────
    // Sanitise conversation history to only include valid roles
    const validHistory = conversationHistory
      .filter(
        (m) =>
          m.role &&
          ['user', 'assistant'].includes(m.role) &&
          m.content &&
          m.content.trim().length > 0
      )
      .map((m) => ({ role: m.role, content: m.content }));

    // Append current visitor message
    const messages = [
      ...validHistory,
      { role: 'user', content: userMessage },
    ];

    // ── Step 4: Call Claude API ────────────────────────────────────────────
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0]?.text || 'Sorry, I could not generate a response.';
    const tokensUsed = response.usage?.output_tokens || 0;

    return {
      reply,
      ragContextUsed,
      tokensUsed,
      model: CLAUDE_MODEL,
    };
  } catch (err) {
    console.error('[ClaudeAgent] Error:', err.message);
    throw new Error(`AI agent error: ${err.message}`);
  }
}

// ─── Quick reply for simple greetings ────────────────────────────────────────

/**
 * Detect if the message is a simple greeting that doesn't need RAG retrieval.
 * Optimisation to skip embedding + DB lookup for "Hi", "Hello", etc.
 *
 * @param {string} message
 * @returns {boolean}
 */
function isSimpleGreeting(message) {
  const greetings = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|hii+|yo)\s*[!.]?$/i;
  return greetings.test(message.trim());
}

/**
 * Wrapper used by chat.js — skips RAG for greetings to reduce latency.
 */
async function respondToVisitor({
  userMessage,
  conversationHistory,
  builderId,
  builderConfig,
}) {
  const skipRAG = isSimpleGreeting(userMessage);

  return chat({
    userMessage,
    conversationHistory,
    builderId,
    builderConfig,
    useRAG: !skipRAG,
  });
}

module.exports = {
  respondToVisitor,
  chat,
  buildSystemPrompt, // Exported for unit testing
};