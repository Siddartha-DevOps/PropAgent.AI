import React, { useState, useEffect } from 'react';
import { calcEMI, calcTotalPayment, calc80CTaxBenefit, formatINR, lakhsToRupees } from '../../../utils/indianRealEstate';

const C = '#B8952A';

export default function EMIWidget({ onClose, initialPrice }) {
  const [price,   setPrice]   = useState(initialPrice ? Math.round(initialPrice / 100000) : 80);
  const [down,    setDown]    = useState(20);
  const [rate,    setRate]    = useState(8.5);
  const [tenure,  setTenure]  = useState(20);
  const [slab,    setSlab]    = useState(30);

  const loanAmount = lakhsToRupees(price - down);
  const emi        = loanAmount > 0 ? calcEMI(loanAmount, rate, tenure) : 0;
  const total      = calcTotalPayment(emi, tenure);
  const interest   = total - loanAmount;

  // Approximate year-1 interest and principal
  const yr1Interest  = Math.round(loanAmount * rate / 100);
  const yr1Principal = (emi * 12) - yr1Interest;
  const taxBenefit   = calc80CTaxBenefit(yr1Principal, yr1Interest, slab);

  const S = {
    wrap:  { background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', fontFamily:"'Outfit',sans-serif", width:'100%', maxWidth:380 },
    hdr:   { background:`linear-gradient(135deg,${C},#F0CC6A)`, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    body:  { padding:'16px 18px' },
    label: { fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.5px' },
    row:   { marginBottom:12 },
    slider:{ width:'100%', accentColor:C },
    val:   { fontSize:13, fontWeight:700, color:C, float:'right' },
    result:{ background:'#FAF8F3', borderRadius:10, padding:'14px', marginTop:12, border:'1px solid rgba(184,149,42,0.15)' },
    rRow:  { display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 },
    big:   { fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:800, color:C, textAlign:'center', margin:'6px 0' },
    tax:   { background:'rgba(42,173,106,0.06)', borderRadius:8, padding:'10px 12px', marginTop:10, border:'1px solid rgba(42,173,106,0.15)' },
    closeBtn:{ background:'rgba(255,255,255,0.3)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>💰 EMI Calculator</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>Home Loan Calculator</div>
        </div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={S.body}>
        {[
          { label:`Property Price: ${formatINR(lakhsToRupees(price))}`, key:'price', min:10, max:500, step:5, val:price, set:setPrice },
          { label:`Down Payment: ${formatINR(lakhsToRupees(down))} (${Math.round(down/price*100)}%)`, key:'down', min:0, max:price, step:5, val:down, set:setDown },
          { label:`Interest Rate: ${rate}% p.a.`, key:'rate', min:6, max:15, step:0.1, val:rate, set:v=>setRate(parseFloat(v)) },
          { label:`Loan Tenure: ${tenure} years`, key:'tenure', min:1, max:30, step:1, val:tenure, set:setTenure },
        ].map(f => (
          <div key={f.key} style={S.row}>
            <label style={S.label}>{f.label}</label>
            <input type="range" min={f.min} max={f.max} step={f.step} value={f.val}
              onChange={e => f.set(e.target.value)} style={S.slider}/>
          </div>
        ))}

        <div style={S.result}>
          <div style={{ fontSize:12, color:'#7A7A8A', textAlign:'center', marginBottom:2 }}>Monthly EMI</div>
          <div style={S.big}>{formatINR(emi)}</div>
          <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'10px 0' }}/>
          <div style={S.rRow}><span style={{ color:'#7A7A8A' }}>Loan Amount</span><strong>{formatINR(loanAmount)}</strong></div>
          <div style={S.rRow}><span style={{ color:'#7A7A8A' }}>Total Interest</span><strong style={{ color:'#E24B4A' }}>{formatINR(interest)}</strong></div>
          <div style={S.rRow}><span style={{ color:'#7A7A8A' }}>Total Payment</span><strong>{formatINR(total)}</strong></div>
        </div>

        {/* Tax benefits */}
        <div style={S.tax}>
          <div style={{ fontSize:12, fontWeight:600, color:'#2AAD6A', marginBottom:8 }}>🎯 Annual Tax Benefits</div>
          <div style={{ display:'flex', gap:8, marginBottom:6 }}>
            {[{l:'Tax Slab',v:'30%',opts:['10%','20%','30%']},{l:'',v:'',opts:[]}].slice(0,1).map(()=>(
              <select key="slab" value={slab} onChange={e=>setSlab(Number(e.target.value))}
                style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid rgba(0,0,0,0.1)', fontSize:12, fontFamily:'inherit', color:'#1A1A22', outline:'none' }}>
                {[10,20,30].map(s=><option key={s} value={s}>{s}% Slab</option>)}
              </select>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { l:'Sec 80C (Principal)', v:formatINR(taxBenefit.taxSavedPrincipal) },
              { l:'Sec 24b (Interest)',  v:formatINR(taxBenefit.taxSavedInterest) },
              { l:'Total Deduction',    v:formatINR(taxBenefit.totalDeduction) },
              { l:'Total Tax Saved',    v:formatINR(taxBenefit.totalTaxSaved) },
            ].map(i=>(
              <div key={i.l} style={{ background:'#fff', borderRadius:7, padding:'7px 9px', border:'1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize:10, color:'#7A7A8A' }}>{i.l}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#2AAD6A' }}>{i.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10, color:'#9A9A9A', marginTop:8 }}>*Approximate. Consult your CA for exact calculations.</div>
        </div>
      </div>
    </div>
  );
}