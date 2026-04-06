import React, { useState } from 'react';
import { STATES, calcStampDuty, formatINR, lakhsToRupees } from '../../../utils/indianRealEstate';

const C = '#B8952A';

export default function StampDutyWidget({ onClose, initialState }) {
  const [price,  setPrice]  = useState(80);
  const [state,  setState]  = useState(initialState || 'Telangana');
  const [gender, setGender] = useState('male');

  const result = calcStampDuty(lakhsToRupees(price), state, gender);

  const S = {
    wrap:  { background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', fontFamily:"'Outfit',sans-serif", width:'100%', maxWidth:380 },
    hdr:   { background:'linear-gradient(135deg,#185FA5,#378ADD)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    body:  { padding:'16px 18px' },
    sel:   { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.1)', fontSize:13, fontFamily:'inherit', color:'#1A1A22', outline:'none', marginBottom:12 },
    label: { fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.5px' },
    slider:{ width:'100%', accentColor:'#185FA5' },
    closeBtn:{ background:'rgba(255,255,255,0.3)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🏛️ Stamp Duty Calculator</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>State-wise charges</div>
        </div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={S.body}>
        <label style={S.label}>State</label>
        <select style={S.sel} value={state} onChange={e => setState(e.target.value)}>
          {Object.keys(STATES).sort().map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={S.label}>{`Property Value: ${formatINR(lakhsToRupees(price))}`}</label>
        <input type="range" min={10} max={500} step={5} value={price}
          onChange={e => setPrice(Number(e.target.value))} style={{ ...S.slider, marginBottom:12 }}/>

        <label style={S.label}>Buyer</label>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {['male','female'].map(g => (
            <button key={g} onClick={() => setGender(g)}
              style={{ flex:1, padding:'8px', borderRadius:9, border:`1.5px solid ${gender===g?'#185FA5':'rgba(0,0,0,0.1)'}`, background:gender===g?'rgba(24,95,165,0.08)':'#fff', color:gender===g?'#185FA5':'#4A4A5A', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:gender===g?600:400 }}>
              {g === 'male' ? '👨 Male' : '👩 Female'}
            </button>
          ))}
        </div>

        {result && (
          <div style={{ background:'#EBF3FB', borderRadius:10, padding:'14px', border:'1px solid rgba(24,95,165,0.15)' }}>
            {[
              { l:`Stamp Duty (${result.stampDutyRate}%)`, v: formatINR(result.stampDuty), highlight: true },
              { l:'Registration ('+STATES[state].registration+'%)',v: formatINR(result.registration) },
              { l:'TDS (1%) — if price ≥ ₹50L',            v: formatINR(result.tds) },
            ].map(r => (
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                <span style={{ color:'#4A4A5A' }}>{r.l}</span>
                <strong style={{ color: r.highlight ? '#185FA5' : '#1A1A22' }}>{r.v}</strong>
              </div>
            ))}
            <div style={{ height:1, background:'rgba(24,95,165,0.15)', margin:'8px 0' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700 }}>
              <span>Total Extra Cost</span>
              <span style={{ color:'#185FA5' }}>{formatINR(result.total)}</span>
            </div>
            {result.readCost && <div style={{ fontSize:11, color:'#7A7A8A', marginTop:8 }}>ℹ️ {result.readCost}</div>}
            <div style={{ fontSize:11, color:'#7A7A8A', marginTop:4 }}>*Rates may vary. Verify with your sub-registrar office.</div>
          </div>
        )}

        <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(42,173,106,0.06)', borderRadius:9, border:'1px solid rgba(42,173,106,0.15)' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#2AAD6A', marginBottom:4 }}>💡 Total Budget Needed</div>
          <div style={{ fontSize:13, color:'#4A4A5A' }}>
            Property: <strong>{formatINR(lakhsToRupees(price))}</strong> + Stamp Duty: <strong>{formatINR(result?.total || 0)}</strong>
            {' = '}
            <strong style={{ color:'#2AAD6A' }}>{formatINR(lakhsToRupees(price) + (result?.total || 0))}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}