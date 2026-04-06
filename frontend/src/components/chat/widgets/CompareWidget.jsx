import React, { useState } from 'react';
import { formatINR } from '../../../utils/indianRealEstate';

const SAMPLE_PROPERTIES = [
  { id:'p-001', name:'Prestige Skyline',         location:'Banjara Hills',  type:'3BHK', priceMin:9500000,  priceMax:12000000, status:'Ready to move', possession:'Immediate', amenities:['Pool','Gym','Clubhouse','Security'], rera:'P05170002312', rating:4.5 },
  { id:'p-002', name:'Lodha Banjara Grand',       location:'Banjara Hills',  type:'2BHK', priceMin:8000000,  priceMax:11000000, status:'Under construction', possession:'Dec 2025', amenities:['Pool','Gym','Rooftop Garden'], rera:'P05170003821', rating:4.3 },
  { id:'p-003', name:'My Home Avatar',            location:'Gachibowli',     type:'2BHK', priceMin:5500000,  priceMax:8500000,  status:'Ready to move', possession:'Immediate', amenities:['Pool','Gym','Jogging Track'], rera:'P02400006521', rating:4.4 },
  { id:'p-005', name:'Prestige Jubilee Heights',  location:'Jubilee Hills',  type:'4BHK', priceMin:18000000, priceMax:30000000, status:'Ready', possession:'Immediate', amenities:['Pool','Concierge','Theatre','Helipad'], rera:'P05170001122', rating:4.7 },
  { id:'p-007', name:'Aparna Kanopy',             location:'Manikonda',      type:'3BHK', priceMin:7200000,  priceMax:9500000,  status:'Ready to move', possession:'Immediate', amenities:['Pool','Gym','Park','Clubhouse'], rera:'P02400008912', rating:4.2 },
];

const C = '#B8952A';

export default function CompareWidget({ onClose, suggestedIds }) {
  const [selected, setSelected] = useState(
    suggestedIds ? SAMPLE_PROPERTIES.filter(p => suggestedIds.includes(p.id)).slice(0,2) : SAMPLE_PROPERTIES.slice(0,2)
  );

  const ROWS = [
    { key:'location',   label:'📍 Location',   render: p => p.location },
    { key:'type',       label:'🏠 Type',        render: p => p.type },
    { key:'price',      label:'💰 Price Range', render: p => `${formatINR(p.priceMin)} – ${formatINR(p.priceMax)}` },
    { key:'possession', label:'📅 Possession',  render: p => p.possession },
    { key:'status',     label:'🏗️ Status',      render: p => p.status },
    { key:'rera',       label:'🏛️ RERA No.',    render: p => p.rera },
    { key:'rating',     label:'⭐ Rating',       render: p => '★'.repeat(Math.floor(p.rating)) + ` ${p.rating}` },
    { key:'amenities',  label:'🎯 Amenities',   render: p => p.amenities.join(', ') },
  ];

  const S = {
    wrap: { background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', fontFamily:"'Outfit',sans-serif", width:'100%', maxWidth:420 },
    hdr:  { background:'linear-gradient(135deg,#533AB7,#7F77DD)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    closeBtn:{ background:'rgba(255,255,255,0.3)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>⚖️ Property Comparison</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>Side-by-side analysis</div>
        </div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>

      {/* Property selector */}
      <div style={{ padding:'12px 14px', background:'#FAF8F3', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', gap:8 }}>
        {[0,1].map(idx => (
          <select key={idx} value={selected[idx]?.id || ''} onChange={e => {
            const prop = SAMPLE_PROPERTIES.find(p => p.id === e.target.value);
            const next = [...selected]; next[idx] = prop; setSelected(next);
          }} style={{ flex:1, padding:'7px 8px', borderRadius:8, border:'1px solid rgba(0,0,0,0.1)', fontSize:12, fontFamily:'inherit', color:'#1A1A22', outline:'none' }}>
            {SAMPLE_PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ))}
      </div>

      {/* Comparison table */}
      <div style={{ overflow:'auto', maxHeight:360 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ padding:'8px 10px', textAlign:'left', background:'#F5F4F0', color:'#7A7A8A', fontSize:11, fontWeight:600, width:'30%', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>Feature</th>
              {selected.map((p, i) => (
                <th key={i} style={{ padding:'8px 10px', textAlign:'left', background:'#F5F4F0', color:'#1A1A22', fontSize:12, fontWeight:700, borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                  {p?.name || '—'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row.key} style={{ background: ri%2===0 ? '#fff' : '#FAFAF8' }}>
                <td style={{ padding:'9px 10px', color:'#7A7A8A', fontWeight:600, borderBottom:'1px solid rgba(0,0,0,0.05)', fontSize:11 }}>{row.label}</td>
                {selected.map((p, ci) => {
                  const val = p ? row.render(p) : '—';
                  const isBest = row.key === 'rating' && selected.every(sp => sp && parseFloat(row.render(sp)) <= parseFloat(val));
                  return (
                    <td key={ci} style={{ padding:'9px 10px', color: isBest?'#2AAD6A':'#1A1A22', fontWeight: isBest?700:400, borderBottom:'1px solid rgba(0,0,0,0.05)', lineHeight:1.5 }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding:'10px 14px', background:'rgba(83,58,183,0.05)', borderTop:'1px solid rgba(83,58,183,0.1)', fontSize:11, color:'#7A7A8A', textAlign:'center' }}>
        Tip: Ask me "Compare Prestige and Lodha" to auto-fill this comparison
      </div>
    </div>
  );
}