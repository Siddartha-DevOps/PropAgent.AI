import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const STEPS = [
  { id: 1, title: 'Your Project',     sub: 'Tell us about your real estate project' },
  { id: 2, title: 'Property Details', sub: 'What types of properties are you selling?' },
  { id: 3, title: 'Choose Your Plan', sub: 'Pick the plan that fits your team' },
  { id: 4, title: 'Widget Ready!',    sub: 'Your AI sales agent is live' },
];

const PLANS = [
  { id:'starter', name:'Starter', price:'Free', period:'forever', color:'#2A6DD4', features:['1 widget','50 leads/month','Basic scoring','Email support'] },
  { id:'growth',  name:'Growth',  price:'₹4,999', period:'/month', color:'#B8952A', featured:true, features:['5 widgets','Unlimited leads','Full CRM dashboard','WhatsApp alerts','Analytics'] },
  { id:'enterprise', name:'Enterprise', price:'Custom', period:'', color:'#2AAD6A', features:['Unlimited widgets','Custom AI training','White-label','HubSpot sync','Dedicated manager'] },
];

const PROPERTY_TYPES = ['1BHK','2BHK','3BHK','4BHK','Villa','Plot','Penthouse','Commercial'];
const LOCATIONS_HYD  = ['Banjara Hills','Jubilee Hills','Gachibowli','Kondapur','Manikonda','Kompally','Kukatpally','Miyapur','Madhapur','Financial District'];

export default function OnboardingPage({ onComplete, onBack }) {
  const { token, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('starter');

  const [form, setForm] = useState({
    projectName: '', projectCity: '', website: '',
    locations: [], propertyTypes: [],
    priceMin: '', priceMax: '',
  });

  const S = {
    wrap: { minHeight:'100vh', background:'#FAF8F3', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Outfit',sans-serif" },
    card: { background:'#fff', borderRadius:20, padding:'36px', width:'100%', maxWidth:560, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 20px 60px rgba(0,0,0,0.08)' },
    stepper: { display:'flex', gap:8, marginBottom:32 },
    stepDot: (active, done) => ({ flex:1, height:4, borderRadius:4, background: done?'#B8952A': active?'#F0CC6A':'#F0EEE8', transition:'all 0.3s' }),
    label: { fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'10px 13px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.11)', fontSize:14, fontFamily:'inherit', color:'#1A1A22', outline:'none', marginBottom:14, boxSizing:'border-box' },
    tag: (sel) => ({ padding:'6px 14px', borderRadius:100, border:`1.5px solid ${sel?'#B8952A':'rgba(0,0,0,0.12)'}`, background:sel?'rgba(184,149,42,0.1)':'#fff', color:sel?'#B8952A':'#4A4A5A', fontSize:13, fontWeight:sel?600:400, cursor:'pointer', transition:'all 0.15s' }),
    btn: { width:'100%', padding:'13px', borderRadius:100, border:'none', background:'linear-gradient(135deg,#B8952A,#F0CC6A)', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
    btnOut: { width:'100%', padding:'12px', borderRadius:100, border:'1px solid rgba(0,0,0,0.14)', background:'#fff', color:'#1A1A22', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
    code: { background:'#0C0C0F', color:'#F0CC6A', borderRadius:10, padding:'14px 16px', fontSize:12, fontFamily:'monospace', lineHeight:1.8, wordBreak:'break-all', marginBottom:12 },
  };

  function toggleTag(field, val) {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(val) ? p[field].filter(v=>v!==val) : [...p[field], val]
    }));
  }

  async function saveOnboarding() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/builder/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, priceMin: Number(form.priceMin)||null, priceMax: Number(form.priceMax)||null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateUser({ isOnboarded: true });

      // Get widget config / API key
      const wRes = await fetch(`${API}/builder/widget-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const wData = await wRes.json();
      setApiKey(wData.apiKey || 'pa_demo_key');
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:24 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:15, color:'#fff' }}>P</div>
          <span style={{ fontWeight:700, fontSize:16 }}>PropAgent<span style={{ color:'#B8952A' }}>.AI</span></span>
          <span style={{ marginLeft:'auto', fontSize:12, color:'#9A9A9A' }}>Step {step} of 4</span>
        </div>

        {/* Step progress */}
        <div style={S.stepper}>
          {STEPS.map((s,i) => <div key={s.id} style={S.stepDot(step===s.id, step>s.id)} />)}
        </div>

        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:'#0C0C0F', marginBottom:4 }}>{STEPS[step-1].title}</div>
        <div style={{ fontSize:14, color:'#7A7A8A', marginBottom:24 }}>{STEPS[step-1].sub}</div>

        {error && <div style={{ background:'rgba(255,87,87,0.08)', border:'1px solid rgba(255,87,87,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#CC3333', marginBottom:14 }}>⚠️ {error}</div>}

        {/* ── STEP 1: Project Info ── */}
        {step === 1 && (
          <div>
            <label style={S.label}>Project / Company Name</label>
            <input style={S.input} value={form.projectName} onChange={e=>setForm(p=>({...p,projectName:e.target.value}))} placeholder="Prestige Skyline" required
              onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.11)'} />

            <label style={S.label}>City</label>
            <input style={S.input} value={form.projectCity} onChange={e=>setForm(p=>({...p,projectCity:e.target.value}))} placeholder="Hyderabad"
              onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.11)'} />

            <label style={S.label}>Website URL <span style={{ color:'#9A9A9A', fontWeight:400 }}>(optional)</span></label>
            <input style={S.input} value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} placeholder="https://prestigeskyline.com"
              onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.11)'} />

            <label style={S.label}>Areas / Localities you sell in</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
              {LOCATIONS_HYD.map(loc => (
                <button key={loc} type="button" style={S.tag(form.locations.includes(loc))} onClick={()=>toggleTag('locations',loc)}>{loc}</button>
              ))}
            </div>

            <button style={S.btn} onClick={() => { if (!form.projectName.trim()) { setError('Please enter your project name'); return; } setError(''); setStep(2); }}>
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Property Details ── */}
        {step === 2 && (
          <div>
            <label style={S.label}>Property Types you sell</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:20 }}>
              {PROPERTY_TYPES.map(t => (
                <button key={t} type="button" style={S.tag(form.propertyTypes.includes(t))} onClick={()=>toggleTag('propertyTypes',t)}>{t}</button>
              ))}
            </div>

            <label style={S.label}>Price Range</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:4 }}>Minimum (₹)</div>
                <input style={{ ...S.input, marginBottom:0 }} value={form.priceMin} onChange={e=>setForm(p=>({...p,priceMin:e.target.value}))} placeholder="4500000"
                  onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.11)'} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#9A9A9A', marginBottom:4 }}>Maximum (₹)</div>
                <input style={{ ...S.input, marginBottom:0 }} value={form.priceMax} onChange={e=>setForm(p=>({...p,priceMax:e.target.value}))} placeholder="30000000"
                  onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.11)'} />
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...S.btnOut, flex:0.4 }} onClick={() => setStep(1)}>← Back</button>
              <button style={{ ...S.btn, flex:1, marginTop:0 }} onClick={() => { setError(''); setStep(3); }}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Choose Plan ── */}
        {step === 3 && (
          <div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
              {PLANS.map(plan => (
                <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${selectedPlan===plan.id?plan.color:'rgba(0,0,0,0.09)'}`, background:selectedPlan===plan.id?`${plan.color}08`:'#fff', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${plan.color}`, background:selectedPlan===plan.id?plan.color:'transparent', flexShrink:0, transition:'all 0.15s' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'#0C0C0F' }}>{plan.name}</span>
                      {plan.featured && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:100, background:`${plan.color}15`, color:plan.color, fontWeight:700 }}>Popular</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#7A7A8A', marginTop:2 }}>{plan.features.join(' · ')}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:16, fontWeight:800, color:plan.color }}>{plan.price}</div>
                    <div style={{ fontSize:11, color:'#9A9A9A' }}>{plan.period}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...S.btnOut, flex:0.4 }} onClick={() => setStep(2)}>← Back</button>
              <button style={{ ...S.btn, flex:1, marginTop:0 }} onClick={saveOnboarding} disabled={loading}>
                {loading ? 'Setting up...' : selectedPlan === 'starter' ? 'Launch Free Widget →' : 'Continue to Payment →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Widget Ready ── */}
        {step === 4 && (
          <div>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🎉</div>
              <div style={{ fontSize:15, color:'#4A4A5A', lineHeight:1.7 }}>Your PropAgent.AI widget is ready. Add this code to your website and your AI sales agent goes live immediately.</div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'#7A7A8A', fontWeight:600, marginBottom:6 }}>YOUR API KEY</div>
              <div style={{ ...S.code, fontSize:13 }}>{apiKey}</div>
              <div style={{ fontSize:12, color:'#9A9A9A' }}>Keep this secret. Used to authenticate your widget.</div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'#7A7A8A', fontWeight:600, marginBottom:6 }}>EMBED CODE — Paste before {'</body>'}</div>
              <div style={S.code}>{`<script>\n  window.PROPAGENT_CONFIG = {\n    apiKey: "${apiKey}"\n  };\n</script>\n<script src="https://cdn.propagent.ai/widget.js" async></script>`}</div>
            </div>

            <button style={S.btn} onClick={() => onComplete(selectedPlan !== 'starter')}>
              {selectedPlan === 'starter' ? 'Go to Dashboard →' : 'Continue to Payment →'}
            </button>
            <button style={{ ...S.btnOut, marginTop:8 }} onClick={() => onComplete(false)}>
              Try the Demo First
            </button>
          </div>
        )}
      </div>
    </div>
  );
}