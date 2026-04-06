import React, { useState } from 'react';
import { RERA_LINKS } from '../../../utils/indianRealEstate';

export default function RERAWidget({ onClose, projectName }) {
  const [state, setState] = useState('Telangana');
  const [reraNum, setReraNum] = useState('');

  const CHECKLIST = [
    { icon:'✅', text:'Check RERA registration number of the project' },
    { icon:'✅', text:'Verify builder track record on RERA portal' },
    { icon:'✅', text:'Check project completion timeline on RERA' },
    { icon:'✅', text:'Verify that land title is clear (ask for title deed)' },
    { icon:'✅', text:'Check encumbrance certificate (EC) for past dues' },
    { icon:'✅', text:'Confirm OC (Occupancy Certificate) status if ready' },
    { icon:'✅', text:'Verify carpet area vs super built-up area ratio' },
    { icon:'⚠️', text:'Builder must deposit 70% of collections in escrow' },
    { icon:'⚠️', text:'Never pay more than 10% before registration of agreement' },
  ];

  const S = {
    wrap:{ background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', fontFamily:"'Outfit',sans-serif", width:'100%', maxWidth:380 },
    hdr: { background:'linear-gradient(135deg,#2AAD6A,#34D399)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    body:{ padding:'16px 18px' },
    sel: { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.1)', fontSize:13, fontFamily:'inherit', color:'#1A1A22', outline:'none', marginBottom:12 },
    inp: { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.1)', fontSize:13, fontFamily:'inherit', color:'#1A1A22', outline:'none', marginBottom:12, boxSizing:'border-box' },
    btn: { width:'100%', padding:'11px', borderRadius:100, background:'linear-gradient(135deg,#2AAD6A,#34D399)', color:'#fff', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', marginBottom:14 },
    closeBtn:{ background:'rgba(255,255,255,0.3)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🏛️ RERA Verification</div>
          <div style={{ color:'rgba(255,255,255,0.8)', fontSize:11 }}>Real Estate Regulatory Authority</div>
        </div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={S.body}>
        <label style={{ fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.5px' }}>Select State</label>
        <select style={S.sel} value={state} onChange={e => setState(e.target.value)}>
          {Object.keys(RERA_LINKS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={{ fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.5px' }}>RERA Number (optional)</label>
        <input style={S.inp} value={reraNum} onChange={e => setReraNum(e.target.value)}
          placeholder="e.g. P02400004821" onFocus={e=>e.target.style.borderColor='#2AAD6A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.1)'}/>

        <a href={RERA_LINKS[state]} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, display:'block', textAlign:'center', textDecoration:'none', boxSizing:'border-box' }}>
          🔍 Check on {state} RERA Portal →
        </a>

        <div style={{ fontSize:12, fontWeight:600, color:'#1A1A22', marginBottom:8 }}>RERA Buyer Checklist</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {CHECKLIST.map((c, i) => (
            <div key={i} style={{ display:'flex', gap:8, padding:'7px 10px', background:c.icon==='⚠️'?'rgba(255,149,0,0.06)':'rgba(42,173,106,0.04)', borderRadius:8, border:`1px solid ${c.icon==='⚠️'?'rgba(255,149,0,0.15)':'rgba(42,173,106,0.1)'}` }}>
              <span style={{ fontSize:13, flexShrink:0 }}>{c.icon}</span>
              <span style={{ fontSize:12, color:'#4A4A5A', lineHeight:1.5 }}>{c.text}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(24,95,165,0.06)', borderRadius:9, border:'1px solid rgba(24,95,165,0.15)', fontSize:12, color:'#4A4A5A', lineHeight:1.6 }}>
          <strong style={{ color:'#185FA5' }}>Know your rights:</strong> Under RERA, if the builder delays possession, you are entitled to interest at State Bank of India's Marginal Cost of Funds rate.
        </div>
      </div>
    </div>
  );
}