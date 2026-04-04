const SIGNALS = {
  budget_defined:   { weight: 20 },
  location_defined: { weight: 15 },
  property_type:    { weight: 10 },
  timeline_urgent:  { weight: 25 },
  financing_ready:  { weight: 20 },
  contact_shared:   { weight: 10 },
};

function scoreIntent(data) {
  let score = 0;
  const signals = [];

  if (data.budget?.min || data.budget?.max) {
    score += SIGNALS.budget_defined.weight;
    signals.push({ key: 'budget_defined', fired: true, points: SIGNALS.budget_defined.weight });
  }

  if (data.location && data.location !== 'unknown') {
    score += SIGNALS.location_defined.weight;
    signals.push({ key: 'location_defined', fired: true, points: SIGNALS.location_defined.weight });
  }

  if (data.propertyType && data.propertyType !== 'unknown') {
    score += SIGNALS.property_type.weight;
    signals.push({ key: 'property_type', fired: true, points: SIGNALS.property_type.weight });
  }

  if (data.timeline) {
    const t = data.timeline.toLowerCase();
    if (['1 month', '2 month', 'immediate', 'asap'].some(k => t.includes(k))) {
      score += SIGNALS.timeline_urgent.weight;
      signals.push({ key: 'timeline_urgent', fired: true, points: SIGNALS.timeline_urgent.weight });
    } else if (['3 month', '4 month', '6 month'].some(k => t.includes(k))) {
      const pts = Math.round(SIGNALS.timeline_urgent.weight * 0.6);
      score += pts;
      signals.push({ key: 'timeline_urgent', fired: true, points: pts });
    }
  }

  if (data.financing) {
    const f = data.financing.toLowerCase();
    if (['pre_approved', 'self_funded', 'cash'].some(k => f.includes(k))) {
      score += SIGNALS.financing_ready.weight;
      signals.push({ key: 'financing_ready', fired: true, points: SIGNALS.financing_ready.weight });
    } else if (f.includes('home_loan') || f.includes('loan')) {
      const pts = Math.round(SIGNALS.financing_ready.weight * 0.6);
      score += pts;
      signals.push({ key: 'financing_ready', fired: true, points: pts });
    }
  }

  if (data.phone || data.email) {
    score += SIGNALS.contact_shared.weight;
    signals.push({ key: 'contact_shared', fired: true, points: SIGNALS.contact_shared.weight });
  }

  score = Math.min(100, Math.max(0, score));
  const classification = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  return { score, classification, signals };
}

function generateTags(data, score) {
  const tags = [];
  if (score >= 80) tags.push('high_priority');
  if (data.financing === 'pre_approved') tags.push('loan_ready');
  if (['self_funded', 'cash'].includes(data.financing)) tags.push('cash_buyer');
  if (data.timeline?.includes('1 month')) tags.push('urgent');
  if (data.budget?.max >= 20000000) tags.push('luxury');
  if (data.name && data.phone) tags.push('contact_complete');
  return tags;
}

module.exports = { scoreIntent, generateTags };