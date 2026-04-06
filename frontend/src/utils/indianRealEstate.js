// ─── Indian Real Estate Calculations ──────────────────────────
// Single source of truth for all financial tools

export const STATES = {
  'Telangana':    { stampDuty: 4,   registration: 0.5, tds: 1, readCost: 'Bhoomi Nirikshan: ₹1000' },
  'Andhra Pradesh':{ stampDuty: 5,  registration: 1.0, tds: 1, readCost: '' },
  'Karnataka':    { stampDuty: 5,   registration: 1.0, tds: 1, readCost: 'Khata transfer: ₹500–₹2000' },
  'Maharashtra':  { stampDuty: 5,   registration: 1.0, tds: 1, readCost: 'LBT: 1% extra in some cities' },
  'Delhi':        { stampDuty: 6,   registration: 1.0, tds: 1, readCost: 'Women buyers: 4%' },
  'Tamil Nadu':   { stampDuty: 7,   registration: 1.0, tds: 1, readCost: '' },
  'Gujarat':      { stampDuty: 4.9, registration: 1.0, tds: 1, readCost: '' },
  'Rajasthan':    { stampDuty: 5,   registration: 1.0, tds: 1, readCost: '' },
  'West Bengal':  { stampDuty: 6,   registration: 1.0, tds: 1, readCost: '' },
  'Uttar Pradesh':{ stampDuty: 7,   registration: 1.0, tds: 1, readCost: 'Women buyers: 6%' },
  'Haryana':      { stampDuty: 7,   registration: 1.0, tds: 1, readCost: 'Women buyers: 5%' },
  'Punjab':       { stampDuty: 7,   registration: 1.0, tds: 1, readCost: '' },
  'Kerala':       { stampDuty: 8,   registration: 2.0, tds: 1, readCost: '' },
  'Madhya Pradesh':{ stampDuty: 7.5,registration: 3.0, tds: 1, readCost: '' },
};

export function calcEMI(principalRs, annualRatePct, tenureYears) {
  const P = principalRs;
  const r = annualRatePct / 12 / 100;
  const n = tenureYears * 12;
  if (r === 0) return Math.round(P / n);
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

export function calcTotalPayment(emi, tenureYears) {
  return emi * tenureYears * 12;
}

export function calcStampDuty(priceRs, state, gender = 'male') {
  const s = STATES[state];
  if (!s) return null;
  let rate = s.stampDuty;
  // Gender concession for specific states
  if (gender === 'female') {
    if (state === 'Delhi')          rate = 4;
    if (state === 'Uttar Pradesh')  rate = 6;
    if (state === 'Haryana')        rate = 5;
  }
  const stampDuty    = Math.round(priceRs * rate / 100);
  const registration = Math.round(priceRs * s.registration / 100);
  const tds          = priceRs >= 5000000 ? Math.round(priceRs * s.tds / 100) : 0;
  return {
    stampDutyRate: rate,
    stampDuty,
    registration,
    tds,
    total: stampDuty + registration + tds,
    state,
    readCost: s.readCost,
  };
}

export function calc80CTaxBenefit(principalRepayment, interestPaid, taxSlab = 30) {
  const maxPrincipal = Math.min(principalRepayment, 150000); // Sec 80C limit
  const maxInterest  = Math.min(interestPaid, 200000);       // Sec 24(b) limit
  return {
    principalDeduction: maxPrincipal,
    interestDeduction:  maxInterest,
    totalDeduction:     maxPrincipal + maxInterest,
    taxSavedPrincipal:  Math.round(maxPrincipal * taxSlab / 100),
    taxSavedInterest:   Math.round(maxInterest * taxSlab / 100),
    totalTaxSaved:      Math.round((maxPrincipal + maxInterest) * taxSlab / 100),
    taxSlab,
  };
}

export function formatINR(amount) {
  if (!amount || isNaN(amount)) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000)   return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function lakhsToRupees(lakhs) { return Math.round(lakhs * 100000); }
export function rupeesToLakhs(rs)    { return (rs / 100000).toFixed(1); }

export const HINDI = {
  greeting:   'नमस्ते! मैं आपका AI प्रॉपर्टी सलाहकार हूँ। आप किस तरह का घर ढूंढ रहे हैं?',
  budget:     'आपका बजट क्या है?',
  location:   'आप कहाँ रहना चाहते हैं?',
  bhk:        'आपको कितने BHK चाहिए?',
  timeline:   'आप कब तक घर लेना चाहते हैं?',
  loan:       'क्या आप होम लोन लेंगे?',
  hotLead:    'आपकी जरूरत के हिसाब से हमारे पास एक बेहतरीन प्रॉपर्टी है!',
  emi:        'EMI कैलकुलेटर',
  stampDuty:  'स्टाम्प ड्यूटी',
  booking:    'साइट विज़िट बुक करें',
};

export const RERA_LINKS = {
  'Telangana':    'https://rera.telangana.gov.in',
  'Andhra Pradesh':'https://aprera.ap.gov.in',
  'Karnataka':    'https://rera.karnataka.gov.in',
  'Maharashtra':  'https://maharera.mahaonline.gov.in',
  'Delhi':        'https://rera.delhi.gov.in',
  'Tamil Nadu':   'https://tnrera.in',
  'Gujarat':      'https://gujrera.gujarat.gov.in',
  'Rajasthan':    'https://rера.rajasthan.gov.in',
  'West Bengal':  'https://wbhidco.in',
  'Uttar Pradesh':'https://up-rera.in',
  'Haryana':      'https://hrera.in',
  'Punjab':       'https://pbrera.punjab.gov.in',
};