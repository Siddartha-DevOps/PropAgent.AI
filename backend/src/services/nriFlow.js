/**
 * nriFlow.js
 * -----------
 * NRI (Non-Resident Indian) and Investor buyer qualification service.
 * Detects NRI/investor signals in conversation and adapts the AI's
 * behaviour: currency display, FEMA compliance info, NRI loan schemes,
 * timezone-aware follow-up scheduling.
 *
 * FILE: backend/src/services/nriFlow.js
 * STATUS: NEW
 *
 * Used by: claudeAgent.js (injects NRI context into system prompt)
 *           leads.js (tags lead as NRI/investor on save)
 */

// ─── NRI DETECTION SIGNALS ───────────────────────────────────────────────────

/**
 * Keywords and patterns that indicate an NRI or overseas investor visitor.
 * Used for both chat detection and intent scoring adjustment.
 */
const NRI_SIGNALS = [
  // Location signals
  /\b(usa|uk|canada|australia|uae|dubai|singapore|germany|usa|abroad|overseas)\b/i,
  /\bforeign\s+country\b/i,
  /\bnon[\s-]?resident\b/i,
  /\bnri\b/i,
  /\bliving\s+(in|outside)\s+(india|the\s+country)/i,

  // Financial signals
  /\bnre\s+account\b/i,                // NRE bank account
  /\bnro\s+account\b/i,                // NRO bank account
  /\bfema\b/i,                         // FEMA compliance question
  /\b(dollar|pound|euro|dirham|aud|cad|sgd)\b/i,
  /\bremittance\b/i,
  /\bforeign\s+currency\b/i,
  /\bwire\s+transfer\b/i,

  // Intent signals
  /\binvestment\s+purpose\b/i,
  /\brent(al)?\s+income\b/i,
  /\bcapital\s+appreciation\b/i,
  /\bpassive\s+income\b/i,
];

const INVESTOR_SIGNALS = [
  /\binvestment\b/i,
  /\bportfolio\b/i,
  /\broi\b/i,
  /\byield\b/i,
  /\bappreciation\b/i,
  /\bcommercial\s+property\b/i,
  /\bplot(s)?\b/i,
  /\bmultiple\s+(units|flats|properties)\b/i,
  /\bpre-?launch\b/i,
];

/**
 * Detect buyer type from the full conversation text.
 *
 * @param {string} conversationText - All messages concatenated
 * @returns {'nri' | 'investor' | 'local'}
 */
function detectBuyerType(conversationText) {
  const text = conversationText.toLowerCase();

  const nriHits = NRI_SIGNALS.filter((r) => r.test(text)).length;
  const investorHits = INVESTOR_SIGNALS.filter((r) => r.test(text)).length;

  if (nriHits >= 1) return 'nri';
  if (investorHits >= 2) return 'investor';
  return 'local';
}

// ─── CURRENCY CONVERSION HELPER ──────────────────────────────────────────────

/**
 * Exchange rate table (refresh daily in production via an FX API).
 * For a production app, replace with: https://api.exchangerate-api.com
 */
const APPROX_RATES_TO_INR = {
  USD: 83.5,
  GBP: 106.0,
  EUR: 90.5,
  AED: 22.7,   // UAE Dirham
  SGD: 62.0,
  AUD: 55.0,
  CAD: 61.5,
};

/**
 * Format a price in INR with an NRI-friendly USD equivalent.
 * E.g. "₹1.2 Cr (~$14,400 USD)"
 *
 * @param {number} priceInr - Price in Indian Rupees
 * @param {string} [currency='USD'] - Display currency for NRI
 * @returns {string}
 */
function formatNriPrice(priceInr, currency = 'USD') {
  const crore = 10_000_000;
  const lakh = 100_000;

  const rate = APPROX_RATES_TO_INR[currency] || APPROX_RATES_TO_INR.USD;
  const foreignAmount = Math.round(priceInr / rate).toLocaleString('en-US');
  const symbol = currency === 'USD' ? '$' : currency;

  let inrFormatted;
  if (priceInr >= crore) {
    inrFormatted = `₹${(priceInr / crore).toFixed(2)} Cr`;
  } else if (priceInr >= lakh) {
    inrFormatted = `₹${(priceInr / lakh).toFixed(1)} L`;
  } else {
    inrFormatted = `₹${priceInr.toLocaleString('en-IN')}`;
  }

  return `${inrFormatted} (~${symbol}${foreignAmount} ${currency})`;
}

// ─── NRI SYSTEM PROMPT ADDON ─────────────────────────────────────────────────

/**
 * Returns additional instructions to inject into Claude's system prompt
 * when the buyer is detected as NRI or investor.
 *
 * @param {'nri' | 'investor' | 'local'} buyerType
 * @returns {string} Additional system prompt section
 */
function getNriSystemPromptAddon(buyerType) {
  if (buyerType === 'nri') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NRI BUYER DETECTED — SPECIAL INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This visitor is likely an NRI (Non-Resident Indian). Adapt your responses:

1. CURRENCY: Mention prices in both INR (Crore/Lakh) and a major foreign currency (USD or AED).
2. NRI ELIGIBILITY: Confirm they can buy property in India under FEMA regulations (NRIs can buy residential and commercial property — not agricultural land).
3. NRI HOME LOANS: Mention that leading banks (SBI, HDFC, ICICI) offer special NRI home loan packages with competitive rates.
4. PAYMENT: NRIs must pay via NRE/NRO accounts or inward remittance (not cash). Mention this if payment comes up.
5. POA: If they cannot visit in person, they can appoint a Power of Attorney (POA) to complete the purchase.
6. TAX: Mention 1% TDS deduction for NRI buyers and that they should consult a CA for repatriation rules.
7. TIMEZONE: If they mention a specific country, acknowledge the time difference and offer to schedule a callback at a convenient time for them.
8. FOCUS: Many NRIs are buying for investment, retirement, or family. Ask about their primary purpose.

Key qualifying questions for NRIs:
- "Are you looking for self-use or as an investment property?"
- "What is your preferred timeline for possession?"
- "Would you like us to arrange a virtual site tour?"
`;
  }

  if (buyerType === 'investor') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTOR BUYER DETECTED — SPECIAL INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This visitor appears to be a property investor. Adapt your responses:

1. ROI FOCUS: Emphasise expected rental yield (%), capital appreciation history, and locality growth potential.
2. PRE-LAUNCH: If applicable, highlight pre-launch pricing and early-bird discounts.
3. MULTIPLE UNITS: Offer information about bulk-buying discounts if they seem interested in multiple units.
4. RENTAL DEMAND: Mention proximity to IT parks, metro stations, hospitals that drive rental demand.
5. PAST PROJECTS: Reference the builder's previous projects and their appreciation track record.
6. EMI vs. CASH: Discuss whether the builder accepts full payment at booking for better pricing.

Key qualifying questions for investors:
- "Are you looking for rental income or long-term capital appreciation?"
- "What is your target holding period — 3 years, 5 years, or longer?"
- "Are you considering multiple units?"
`;
  }

  return ''; // local buyer — no addon needed
}

// ─── NRI LEAD ENRICHMENT ──────────────────────────────────────────────────────

/**
 * Extract NRI-specific data points from a conversation for lead enrichment.
 *
 * @param {string} conversationText
 * @returns {{ country: string|null, currency: string|null, purpose: string|null }}
 */
function extractNriMetadata(conversationText) {
  const text = conversationText.toLowerCase();

  // Try to detect country of residence
  const countryMap = {
    usa: 'USA', 'united states': 'USA', america: 'USA',
    uk: 'UK', england: 'UK', 'united kingdom': 'UK',
    uae: 'UAE', dubai: 'UAE', 'abu dhabi': 'UAE',
    canada: 'Canada', australia: 'Australia',
    singapore: 'Singapore', germany: 'Germany',
  };

  let country = null;
  for (const [pattern, label] of Object.entries(countryMap)) {
    if (text.includes(pattern)) { country = label; break; }
  }

  // Detect preferred currency
  const currencyMap = {
    dollar: 'USD', usd: 'USD',
    pound: 'GBP', gbp: 'GBP',
    euro: 'EUR', eur: 'EUR',
    dirham: 'AED', aed: 'AED',
    sgd: 'SGD',
  };

  let currency = null;
  for (const [pattern, label] of Object.entries(currencyMap)) {
    if (text.includes(pattern)) { currency = label; break; }
  }

  // Default currency by country
  if (!currency && country) {
    const defaults = { USA: 'USD', UK: 'GBP', UAE: 'AED', Canada: 'CAD', Australia: 'AUD', Singapore: 'SGD' };
    currency = defaults[country] || 'USD';
  }

  // Detect purchase purpose
  let purpose = null;
  if (/invest|roi|yield|rental/.test(text)) purpose = 'investment';
  else if (/self.?use|personal|family|retire|live/.test(text)) purpose = 'self-use';

  return { country, currency, purpose };
}

module.exports = {
  detectBuyerType,
  getNriSystemPromptAddon,
  extractNriMetadata,
  formatNriPrice,
  NRI_SIGNALS,
  INVESTOR_SIGNALS,
};