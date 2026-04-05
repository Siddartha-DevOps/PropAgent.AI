const Anthropic = require('@anthropic-ai/sdk');
const { scoreIntent, generateTags } = require('./intentScorer');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_PROPERTIES = [
  { name: 'Prestige Skyline',       area: 'Banjara Hills',  type: '3BHK',       priceRange: '95L–1.2Cr',   status: 'Ready to move' },
  { name: 'Lodha Banjara Grand',    area: 'Banjara Hills',  type: '2&3BHK',     priceRange: '80L–1.1Cr',   status: 'Dec 2025' },
  { name: 'My Home Avatar',         area: 'Gachibowli',     type: '2&3BHK',     priceRange: '55L–85L',     status: 'Ready to move' },
  { name: 'Aparna Serene Park',     area: 'Kondapur',       type: '2BHK',       priceRange: '60L–75L',     status: 'Mar 2026' },
  { name: 'Prestige Jubilee Heights', area: 'Jubilee Hills', type: '4BHK',      priceRange: '1.8Cr–3Cr',   status: 'Ready' },
  { name: 'Shriram Blue Design',    area: 'Kompally',       type: '2&3BHK',     priceRange: '45L–70L',     status: 'Jun 2026' },
  { name: 'Aparna Kanopy',          area: 'Manikonda',      type: '3BHK',       priceRange: '72L–95L',     status: 'Ready to move' },
  { name: 'Lodha Bellissimo',       area: 'Jubilee Hills',  type: '4BHK Villa', priceRange: '2.2Cr–4Cr',   status: 'Under construction' },
];

function buildSystemPrompt(config = {}, ragContext = '') {
  const properties = config.properties || DEFAULT_PROPERTIES;
  const agentName  = config.agentName  || 'PropAgent';
  const company    = config.company    || 'a premium real estate developer';

  return `You are ${agentName}, a friendly and intelligent AI property advisor for ${company}.
Your goal is to have a natural, warm conversation with website visitors to understand their property needs and qualify them as potential buyers.

## YOUR PERSONALITY
- Warm, professional, genuinely helpful — never pushy or salesy
- Conversational human tone — 2-3 sentences max per reply
- Use Indian context naturally (lakhs/crores, Indian city names, EMI, RERA)
- Celebrate their answers: "Excellent choice!", "Smart decision!"

## YOUR QUALIFICATION MISSION — Discover these 6 signals naturally:
1. Budget — price range in lakhs/crores
2. Location — preferred area/neighborhood
3. Property Type — 1BHK/2BHK/3BHK/4BHK/Villa/Plot
4. Timeline — how soon they need it
5. Financing — home loan, self-funded, or undecided
6. Contact — name, phone, email

## CONVERSATION RULES
- Ask ONE question at a time only
- Never sound like a form or questionnaire
- If asked about EMI: calculate using formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1)
  where r = monthly interest rate, n = loan tenure months. Example: ₹80L at 8.5% for 20 years = ₹69,496/month
- If asked about RERA, stamp duty, or registration: provide accurate general guidance

## PROPERTY INVENTORY
${properties.map(p => `- ${p.name} — ${p.area} — ${p.type} — ₹${p.priceRange} — ${p.status}`).join('\n')}
${ragContext}

## EXTRACTION — Append after EVERY response (hidden from user):
<<<EXTRACTED:{"name":null,"phone":null,"email":null,"budget":{"min":null,"max":null},"location":null,"propertyType":null,"timeline":null,"financing":null,"recommendedProperties":[]}>>>

Always include this block. Update fields the moment info is mentioned.
Financing values: "pre_approved", "home_loan", "self_funded", "undecided"
Timeline examples: "1 month", "3 months", "6 months", "1 year", "1+ year"`;
}

async function chat(messages, sessionData = {}, builderConfig = {}) {
  if (!process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here' ||
      process.env.ANTHROPIC_API_KEY.trim() === '') {
    throw new Error('ANTHROPIC_API_KEY not configured. Add it to backend/.env');
  }

  // Get RAG context if training data exists
  let ragContext = '';
  try {
    if (sessionData.builderId) {
      const { getRelevantContext } = require('../routes/training');
      const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
      if (lastUserMsg) {
        ragContext = getRelevantContext(sessionData.builderId, lastUserMsg.content, 3);
      }
    }
  } catch {}

  const systemPrompt = buildSystemPrompt(builderConfig, ragContext);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const fullText = response.content[0].text;

  // Extract hidden JSON block
  const match = fullText.match(/<<<EXTRACTED:(.*?)>>>/s);
  let extracted = {};
  if (match) {
    try { extracted = JSON.parse(match[1]); } catch {}
  }

  const visibleText = fullText.replace(/<<<EXTRACTED:.*?>>>/s, '').trim();

  // Merge extracted with existing session data
  const mergedData = mergeData(sessionData.extractedData || {}, extracted);
  const { score, classification, signals } = scoreIntent(mergedData);
  const tags = generateTags(mergedData, score);

  return {
    message: visibleText || "I'm here to help you find your perfect home! What kind of property are you looking for?",
    extractedData: mergedData,
    intentScore: score,
    classification,
    signals,
    tags,
    ragUsed: ragContext.length > 0,
  };
}

function mergeData(existing, newData) {
  const merged = { ...existing };
  Object.entries(newData).forEach(([key, val]) => {
    if (val === null || val === undefined) return;
    if (key === 'budget' && typeof val === 'object') {
      merged.budget = merged.budget || {};
      if (val.min) merged.budget.min = val.min;
      if (val.max) merged.budget.max = val.max;
    } else if (key === 'recommendedProperties' && Array.isArray(val) && val.length > 0) {
      merged.recommendedProperties = val;
    } else if (val !== null) {
      merged[key] = val;
    }
  });
  return merged;
}

module.exports = { chat };