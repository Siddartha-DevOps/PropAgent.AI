const Anthropic = require('@anthropic-ai/sdk');
const { scoreIntent, generateTags } = require('./intentScorer');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_PROPERTIES = [
  { name: 'Prestige Skyline', area: 'Banjara Hills', type: '3BHK', priceRange: '95L–1.2Cr', status: 'Ready to move' },
  { name: 'Lodha Banjara Grand', area: 'Banjara Hills', type: '2&3BHK', priceRange: '80L–1.1Cr', status: 'Dec 2025' },
  { name: 'My Home Avatar', area: 'Gachibowli', type: '2&3BHK', priceRange: '55L–85L', status: 'Ready to move' },
  { name: 'Aparna Serene Park', area: 'Kondapur', type: '2BHK', priceRange: '60L–75L', status: 'Mar 2026' },
  { name: 'Prestige Jubilee Heights', area: 'Jubilee Hills', type: '4BHK', priceRange: '1.8Cr–3Cr', status: 'Ready' },
  { name: 'Shriram Blue Design', area: 'Kompally', type: '2&3BHK', priceRange: '45L–70L', status: 'Jun 2026' },
  { name: 'Aparna Kanopy', area: 'Manikonda', type: '3BHK', priceRange: '72L–95L', status: 'Ready to move' },
];

function buildSystemPrompt(config = {}) {
  const properties = config.properties || DEFAULT_PROPERTIES;
  return `You are PropAgent, a friendly and intelligent AI property advisor for ${config.company || 'a premium real estate developer'}. Have a natural, warm conversation to understand property needs and qualify buyers.

## YOUR PERSONALITY
- Warm, professional, genuinely helpful — never pushy
- Conversational human tone — not robotic
- Brief responses: 2-3 sentences max
- Use Indian context naturally (lakhs/crores, Indian cities)

## YOUR MISSION — Discover 6 signals naturally:
1. Budget — price range in lakhs/crores
2. Location — preferred area/neighborhood
3. Property Type — 1BHK/2BHK/3BHK/4BHK/Villa/Plot
4. Timeline — how soon they need it
5. Financing — home loan, self-funded, or undecided
6. Contact — name, phone, email

## CONVERSATION RULES
- Ask ONE question at a time only
- Feel like talking to a knowledgeable friend, not a form
- Celebrate answers: "Great choice!", "Smart decision"
- If vague on budget, give anchor ranges
- After learning needs, recommend 1-2 properties from inventory
- Near end, naturally ask for name and phone for sales team

## PROPERTY INVENTORY
${properties.map(p => `- ${p.name} — ${p.area} — ${p.type} — ₹${p.priceRange} — ${p.status}`).join('\n')}

## EXTRACTION — After EVERY response, append this block (hidden from user):
<<<EXTRACTED:{"name":null,"phone":null,"email":null,"budget":{"min":null,"max":null},"location":null,"propertyType":null,"timeline":null,"financing":null,"recommendedProperties":[]}>>>

Always include this block even if all values are null. Update any field the moment info is mentioned.
Financing values must be: "pre_approved", "home_loan", "self_funded", or "undecided"
Timeline examples: "1 month", "3 months", "6 months", "1 year", "1+ year"`;
}

async function chat(messages, sessionData = {}, builderConfig = {}) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: buildSystemPrompt(builderConfig),
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  });

  const fullText = response.content[0].text;
  const match = fullText.match(/<<<EXTRACTED:(.*?)>>>/s);
  let extracted = {};

  if (match) {
    try { extracted = JSON.parse(match[1]); } catch {}
  }

  const visibleText = fullText.replace(/<<<EXTRACTED:.*?>>>/s, '').trim();
  const mergedData = mergeData(sessionData.extractedData || {}, extracted);
  const { score, classification, signals } = scoreIntent(mergedData);
  const tags = generateTags(mergedData, score);

  return { message: visibleText, extractedData: mergedData, intentScore: score, classification, signals, tags };
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
    } else {
      merged[key] = val;
    }
  });
  return merged;
}

module.exports = { chat };