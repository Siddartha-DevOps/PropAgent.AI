import React, { useState, useEffect, useRef } from 'react';
import EMIWidget       from './widgets/EMIWidget';
import StampDutyWidget from './widgets/StampDutyWidget';
import RERAWidget      from './widgets/RERAWidget';
import BookingWidget   from './widgets/BookingWidget';
import CompareWidget   from './widgets/CompareWidget';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const CFG = {
  hot:  { color:'#E24B4A', bg:'rgba(226,75,74,0.09)',   label:'🔴 Hot Lead',  border:'rgba(226,75,74,0.25)' },
  warm: { color:'#BA7517', bg:'rgba(186,117,23,0.09)', label:'🟡 Warm Lead', border:'rgba(186,117,23,0.25)' },
  cold: { color:'#185FA5', bg:'rgba(24,95,165,0.09)',  label:'🔵 Cold Lead', border:'rgba(24,95,165,0.25)' },
};

const GREETING = "Hi! I'm PropAgent.AI, your intelligent property advisor. 👋\n\nI can help you:\n• Find the right property for your budget\n• Calculate EMI and stamp duty\n• Check RERA registration\n• Book a site visit\n\nWhat kind of home are you looking for today?";

// ── Quick action buttons shown at bottom ──────────────────────
const QUICK_ACTIONS = [
  { label:'💰 EMI Calc',   widget:'emi' },
  { label:'🏛️ Stamp Duty', widget:'stamp' },
  { label:'🔍 RERA Check', widget:'rera' },
  { label:'📅 Book Visit', widget:'booking' },
  { label:'⚖️ Compare',    widget:'compare' },
  { label:'🇮🇳 हिंदी',      action:'hindi' },
];

export default function ChatWidget({ onBack }) {
  const [sessionId, setSessionId]         = useState(null);
  const [messages,  setMessages]          = useState([]);
  const [input,     setInput]             = useState('');
  const [loading,   setLoading]           = useState(false);
  const [intentScore, setIntentScore]     = useState(0);
  const [classification, setClassification] = useState('cold');
  const [signals,   setSignals]           = useState([]);
  const [showPanel, setShowPanel]         = useState(true);
  const [sessionReady, setSessionReady]   = useState(false);
  const [apiError,  setApiError]          = useState(null);
  const [activeWidget, setActiveWidget]   = useState(null); // 'emi'|'stamp'|'rera'|'booking'|'compare'
  const [lang, setLang]                   = useState('en');
  const [lastExtracted, setLastExtracted] = useState({});
  const endRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, activeWidget]);

  useEffect(() => {
    addMsg('assistant', GREETING);
    startSession();
  }, []);

  async function startSession() {
    try {
      const res = await fetch(`${API_BASE}/chat/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSessionId(data.sessionId);
      setSessionReady(true);
    } catch {
      setApiError('Cannot reach backend. Is it running on port 3001?');
    }
  }

  function addMsg(role, content) {
    if (!content?.trim()) return;
    setMessages(p => [...p, { role, content: content.trim(), time: new Date() }]);
  }

  async function send(textOverride) {
    const text = (textOverride || input).trim();
    if (!text || loading) return;
    if (!sessionId) { setApiError('Connecting... please wait a moment.'); return; }

    setInput('');
    setApiError(null);
    addMsg('user', text);
    setLoading(true);

    // Check if user is asking for a widget
    const lower = text.toLowerCase();
    if (lower.includes('emi') || lower.includes('लोन') || lower.includes('किस्त')) { setActiveWidget('emi'); }
    else if (lower.includes('stamp') || lower.includes('stamp duty') || lower.includes('स्टाम्प')) { setActiveWidget('stamp'); }
    else if (lower.includes('rera') || lower.includes('registration')) { setActiveWidget('rera'); }
    else if (lower.includes('visit') || lower.includes('book') || lower.includes('appointment') || lower.includes('विज़िट')) { setActiveWidget('booking'); }
    else if (lower.includes('compar') || lower.includes('vs') || lower.includes('versus') || lower.includes('difference')) { setActiveWidget('compare'); }

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId, message: text, lang }),
      });
      const data = await res.json();

      if (data.message) {
        addMsg('assistant', data.message);
        if (typeof data.intentScore === 'number') setIntentScore(data.intentScore);
        if (data.classification) setClassification(data.classification);
        if (data.signals) setSignals(data.signals);
        if (data.extractedData) setLastExtracted(data.extractedData);
      } else if (data.error) {
        addMsg('assistant', data.message || 'Something went wrong. Please try again.');
      }
    } catch {
      addMsg('assistant', 'Connection lost. Please check backend is running.');
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  function handleQuickAction(action) {
    if (action.widget) {
      setActiveWidget(action.widget);
      addMsg('user', `Open ${action.label}`);
      const msgs = {
        emi:     'Great! Here\'s the EMI calculator. Adjust the sliders to match your loan amount.',
        stamp:   'Of course! Let me pull up the stamp duty calculator for your state.',
        rera:    'Smart! Always verify RERA before booking. Here\'s the checker.',
        booking: 'I\'ll schedule a site visit for you right away!',
        compare: 'Let me show you a side-by-side comparison of our properties.',
      };
      setTimeout(() => addMsg('assistant', msgs[action.widget] || 'Here you go!'), 400);
    }
    if (action.action === 'hindi') {
      setLang(l => l === 'hi' ? 'en' : 'hi');
      addMsg('assistant', lang === 'en' ? 'अब मैं हिंदी में बात करूँगा। आप किस तरह का घर ढूंढ रहे हैं?' : 'Switching back to English. How can I help?');
    }
  }

  const cfg = CFG[classification] || CFG.cold;
  const SIGNAL_META = [
    { key:'budget_defined',   label:'Budget defined',      icon:'💰', pts:20 },
    { key:'location_defined', label:'Location specified',  icon:'📍', pts:15 },
    { key:'property_type',    label:'Property type known', icon:'🏠', pts:10 },
    { key:'timeline_urgent',  label:'Urgent timeline',     icon:'⏰', pts:25 },
    { key:'financing_ready',  label:'Financing sorted',    icon:'🏦', pts:20 },
    { key:'contact_shared',   label:'Contact shared',      icon:'📱', pts:10 },
  ];

  const F = { fontFamily:"'Outfit',sans-serif" };

  return (
    <div style={{ height:'100vh', background:'#FAF8F3', display:'flex', flexDirection:'column', ...F }}>
      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 18px', background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} style={{ background:'none', border:'1px solid rgba(0,0,0,0.12)', color:'#4A4A5A', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, ...F }}>← Back</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'#fff' }}>P</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>PropAgent.AI{lang==='hi'?' 🇮🇳':''}</div>
              <div style={{ fontSize:11, color:'#2AAD6A', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#2AAD6A', display:'inline-block' }}/> {sessionReady ? 'Online' : 'Connecting...'}
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowPanel(p => !p)} style={{ background:'#F5F4F0', border:'1px solid rgba(0,0,0,0.1)', color:'#4A4A5A', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:11, ...F }}>
          {showPanel ? 'Hide' : 'Show'} Score Panel
        </button>
      </div>

      {/* DEMO BANNER */}
      <div style={{ flexShrink:0, margin:'6px 14px 0', padding:'6px 14px', borderRadius:8, background:'rgba(184,149,42,0.08)', border:'1px solid rgba(184,149,42,0.2)', fontSize:11, color:'#B8952A', textAlign:'center' }}>
        🎯 Demo Mode — Chat as a buyer · Use quick actions below for EMI, Stamp Duty, RERA, Booking
      </div>

      {apiError && (
        <div style={{ flexShrink:0, margin:'4px 14px 0', padding:'7px 14px', borderRadius:8, background:'rgba(226,75,74,0.06)', border:'1px solid rgba(226,75,74,0.2)', fontSize:12, color:'#CC3333' }}>⚠️ {apiError}</div>
      )}

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        {/* MESSAGES + WIDGET */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:9 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start', gap:7, alignItems:'flex-end' }}>
                {m.role==='assistant' && <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>P</div>}
                <div style={{ maxWidth:'72%', padding:'10px 14px', borderRadius: m.role==='user'?'16px 16px 3px 16px':'3px 16px 16px 16px', background: m.role==='user'?'linear-gradient(135deg,#B8952A,#F0CC6A)':'#fff', color: m.role==='user'?'#fff':'#1A1A22', border: m.role==='user'?'none':'1px solid rgba(0,0,0,0.07)', fontSize:13.5, lineHeight:1.6, boxShadow:'0 2px 6px rgba(0,0,0,0.05)', whiteSpace:'pre-wrap' }}>
                  {m.content}
                  <div style={{ fontSize:10, opacity:0.5, marginTop:3, textAlign:'right' }}>{m.time?.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            ))}

            {/* Inline widget panel */}
            {activeWidget && (
              <div style={{ display:'flex', justifyContent:'flex-start', gap:7, alignItems:'flex-start', marginTop:4 }}>
                <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0, marginTop:4 }}>P</div>
                <div style={{ flex:1, maxWidth:400 }}>
                  {activeWidget === 'emi'     && <EMIWidget       onClose={() => setActiveWidget(null)} initialPrice={lastExtracted?.budget?.max} />}
                  {activeWidget === 'stamp'   && <StampDutyWidget  onClose={() => setActiveWidget(null)} initialState={lastExtracted?.location?.includes('Telangana')?'Telangana':lastExtracted?.location?.includes('Karnataka')?'Karnataka':'Telangana'} />}
                  {activeWidget === 'rera'    && <RERAWidget       onClose={() => setActiveWidget(null)} />}
                  {activeWidget === 'booking' && <BookingWidget    onClose={() => setActiveWidget(null)} sessionId={sessionId} onBooked={(b) => { setActiveWidget(null); addMsg('assistant', `Your ${b.type.replace('_',' ')} is confirmed for ${b.date} at ${b.time}! Our team will call ${b.phone} to confirm. 🎉`); }} />}
                  {activeWidget === 'compare' && <CompareWidget    onClose={() => setActiveWidget(null)} />}
                </div>
              </div>
            )}

            {loading && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:7 }}>
                <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>P</div>
                <div style={{ padding:'11px 15px', borderRadius:'3px 16px 16px 16px', background:'#fff', border:'1px solid rgba(0,0,0,0.07)', display:'flex', gap:5 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#B8952A', animation:`bounce 1.2s ease ${i*0.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}`}</style>
            <div ref={endRef}/>
          </div>

          {/* QUICK ACTION BUTTONS */}
          <div style={{ flexShrink:0, padding:'8px 12px', background:'#fff', borderTop:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => handleQuickAction(a)}
                  style={{ padding:'6px 12px', borderRadius:20, border:'1px solid rgba(0,0,0,0.1)', background: activeWidget===a.widget?'rgba(184,149,42,0.1)':'#FAF8F3', color: activeWidget===a.widget?'#B8952A':'#4A4A5A', fontSize:12, cursor:'pointer', ...F, whiteSpace:'nowrap', flexShrink:0, fontWeight: activeWidget===a.widget?600:400 }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT */}
          <div style={{ padding:'10px 14px', background:'#fff', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
              placeholder={lang==='hi'?'अपना सवाल टाइप करें...':'Ask about properties, EMI, RERA, bookings...'}
              disabled={loading || !sessionReady}
              style={{ flex:1, padding:'10px 15px', borderRadius:24, background:'#F5F4F0', border:'1.5px solid rgba(0,0,0,0.1)', color:'#1A1A22', fontSize:13.5, outline:'none', ...F, transition:'border-color 0.2s' }}
              onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.1)'}/>
            <button onClick={() => send()} disabled={!input.trim()||loading||!sessionReady}
              style={{ width:42, height:42, borderRadius:'50%', border:'none', flexShrink:0, background:(input.trim()&&!loading&&sessionReady)?'linear-gradient(135deg,#B8952A,#F0CC6A)':'#ECEAE3', color:(input.trim()&&!loading&&sessionReady)?'#fff':'#9A9A9A', cursor:(input.trim()&&!loading&&sessionReady)?'pointer':'not-allowed', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>↑</button>
          </div>
        </div>

        {/* SCORE PANEL */}
        {showPanel && (
          <div style={{ width:265, background:'#fff', borderLeft:'1px solid rgba(0,0,0,0.08)', padding:'16px', overflowY:'auto', display:'flex', flexDirection:'column', gap:14, flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#7A7A8A', letterSpacing:'0.8px', textTransform:'uppercase' }}>🧠 Intent Score</div>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:84, height:84, borderRadius:'50%', margin:'0 auto 12px', background:`conic-gradient(${cfg.color} ${intentScore*3.6}deg, #ECEAE3 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.8s' }}>
                <div style={{ width:65, height:65, borderRadius:'50%', background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:24, color:cfg.color, lineHeight:1, fontWeight:800 }}>{intentScore}</span>
                  <span style={{ fontSize:9, color:'#9A9A9A' }}>/100</span>
                </div>
              </div>
              <div style={{ display:'inline-block', padding:'3px 12px', borderRadius:20, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, fontSize:12, fontWeight:600 }}>{cfg.label}</div>
            </div>
            <div style={{ background:'#F0EEE8', borderRadius:4, height:4 }}>
              <div style={{ height:'100%', width:`${intentScore}%`, borderRadius:4, background:`linear-gradient(90deg,#185FA5,${cfg.color})`, transition:'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#7A7A8A', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:7 }}>Signals</div>
              {SIGNAL_META.map(sig => {
                const fired = signals.find(s => s.key===sig.key);
                return (
                  <div key={sig.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', borderRadius:7, marginBottom:3, background:fired?.fired?'rgba(42,173,106,0.07)':'#F5F4F0', border:`1px solid ${fired?.fired?'rgba(42,173,106,0.2)':'transparent'}`, transition:'all 0.3s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12 }}>{sig.icon}</span>
                      <span style={{ fontSize:11, color:fired?.fired?'#1A1A22':'#7A7A8A' }}>{sig.label}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:fired?.fired?'#2AAD6A':'#9A9A9A' }}>{fired?.fired?`+${fired.points}`:`+${sig.pts}`}</span>
                  </div>
                );
              })}
            </div>

            {/* Phase 4 quick tools in panel */}
            <div>
              <div style={{ fontSize:11, color:'#7A7A8A', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:7 }}>Quick Tools</div>
              {QUICK_ACTIONS.slice(0,4).map(a => (
                <button key={a.label} onClick={() => handleQuickAction(a)}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid rgba(0,0,0,0.08)', background:activeWidget===a.widget?'rgba(184,149,42,0.08)':'#FAF8F3', color:activeWidget===a.widget?'#B8952A':'#4A4A5A', fontSize:12, cursor:'pointer', ...F, marginBottom:5, textAlign:'left' }}>
                  {a.label}
                </button>
              ))}
            </div>

            <div style={{ padding:9, borderRadius:9, background:'#F5F4F0', border:'1px solid rgba(0,0,0,0.07)', fontSize:11, color:'#4A4A5A', lineHeight:1.7 }}>
              💡 Score 70+ = Hot lead. Sales team notified instantly via email.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}