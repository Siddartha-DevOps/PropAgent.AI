// Dashboard.js — Full CRM Dashboard
// Copy the Dashboard.js from /propiq/dashboard/src/components/Dashboard.js
// Then update the color palette to match PropAgent.AI theme:
//   --gold → #B8952A / #F0CC6A
//   --ink  → #0C0C0F
//   --fog  → #F5F4F0
//   background: #FAF8F3
// The component logic is identical — only colors change.

// For now this file re-exports the working Dashboard with theme patch:
import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const T = {
  hot:  { c:'#FF5757', bg:'rgba(255,87,87,0.09)',  l:'Hot',  b:'rgba(255,87,87,0.2)' },
  warm: { c:'#E07A00', bg:'rgba(224,122,0,0.09)', l:'Warm', b:'rgba(224,122,0,0.2)' },
  cold: { c:'#2A6DD4', bg:'rgba(42,109,212,0.09)', l:'Cold', b:'rgba(42,109,212,0.2)' }
};

export default function Dashboard({ onBack }) {
  const [tab, setTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, ar] = await Promise.all([fetch(`${API}/leads`), fetch(`${API}/leads/analytics`)]);
      setLeads(await lr.json()); setAnalytics(await ar.json());
    } catch { setLeads(DEMO); setAnalytics(DEMO_A); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter==='all' ? leads : leads.filter(l=>l.classification===filter);

  const s = { // base styles
    wrap: { height:'100vh', background:'#FAF8F3', display:'flex', flexDirection:'column', fontFamily:"'Outfit',sans-serif" },
    hdr: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.07)', flexShrink:0 },
    logoIco: { width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff' },
    back: { background:'none', border:'1px solid rgba(0,0,0,0.12)', color:'#4A4A5A', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit' },
    tab: (a) => ({ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', background: tab===a?'rgba(184,149,42,0.1)':'none', color: tab===a?'#B8952A':'#7A7A8A', textTransform:'capitalize' }),
    body: { flex:1, overflowY:'auto', padding:'20px 24px' },
    card: { background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' },
  };

  return (
    <div style={s.wrap}>
      <div style={s.hdr}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button style={s.back} onClick={onBack}>← Back</button>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={s.logoIco}>P</div>
            <div><div style={{ fontSize:14, fontWeight:700 }}>PropAgent CRM</div><div style={{ fontSize:11, color:'#7A7A8A' }}>Sales Intelligence Dashboard</div></div>
          </div>
          <div style={{ display:'flex', gap:2, marginLeft:8 }}>
            {['overview','leads','analytics'].map(t=><button key={t} style={s.tab(t)} onClick={()=>setTab(t)}>{t}</button>)}
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <span style={{ fontSize:11, color:'#7A7A8A' }}>Updated {new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
          <button style={s.back} onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div style={s.body}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#7A7A8A' }}>Loading...</div>
        ) : tab==='overview' ? (
          <Overview a={analytics} leads={leads} onViewLeads={()=>setTab('leads')} sc={s} T={T} onSelect={setSel} />
        ) : tab==='leads' ? (
          <LeadsTab leads={filtered} filter={filter} setFilter={setFilter} onSelect={setSel} T={T} />
        ) : (
          <AnalyticsTab a={analytics} />
        )}
      </div>
      {sel && <LeadModal lead={sel} onClose={()=>setSel(null)} T={T} />}
    </div>
  );
}

function Overview({ a, leads, onViewLeads, sc, T, onSelect }) {
  if (!a) return null;
  const { summary, trend } = a;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
        {[{l:'Total Leads',v:summary.total,ico:'👥',c:'#1A1A22'},{l:'Hot Leads',v:summary.hot,ico:'🔴',c:'#FF5757'},{l:'Warm Leads',v:summary.warm,ico:'🟡',c:'#E07A00'},{l:'Avg Score',v:summary.avgScore,ico:'🎯',c:'#B8952A'},{l:'Hot Rate',v:`${summary.conversionRate}%`,ico:'📈',c:'#2AAD6A'}].map(k=>(
          <div key={k.l} style={{ padding:'16px', background:'#fff', borderRadius:12, border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{k.ico}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:k.c, lineHeight:1 }}>{k.v}</div>
            <div style={{ fontSize:11, color:'#7A7A8A', marginTop:4 }}>{k.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Lead Volume — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF5757" stopOpacity={0.25}/><stop offset="95%" stopColor="#FF5757" stopOpacity={0}/></linearGradient>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E07A00" stopOpacity={0.25}/><stop offset="95%" stopColor="#E07A00" stopOpacity={0}/></linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:12 }}/>
              <Area type="monotone" dataKey="hot" stackId="1" stroke="#FF5757" fill="url(#hg)" strokeWidth={2}/>
              <Area type="monotone" dataKey="warm" stackId="1" stroke="#E07A00" fill="url(#wg)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Lead Mix</div>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart><Pie data={[{v:summary.hot,c:'#FF5757'},{v:summary.warm,c:'#E07A00'},{v:summary.cold,c:'#2A6DD4'}]} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="v" strokeWidth={0}>{['#FF5757','#E07A00','#2A6DD4'].map((c,i)=><Cell key={i} fill={c}/>)}</Pie><Tooltip contentStyle={{ background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:11 }}/></PieChart>
          </ResponsiveContainer>
          {[{l:'Hot',c:'#FF5757',v:summary.hot},{l:'Warm',c:'#E07A00',v:summary.warm},{l:'Cold',c:'#2A6DD4',v:summary.cold}].map(i=>(
            <div key={i.l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:8, height:8, borderRadius:2, background:i.c }}/><span style={{ fontSize:12, color:'#4A4A5A' }}>{i.l}</span></div>
              <span style={{ fontSize:12, fontWeight:700, color:i.c }}>{i.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>🔴 Priority Leads</div>
          <button onClick={onViewLeads} style={{ background:'none', border:'none', color:'#B8952A', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>View all →</button>
        </div>
        {leads.filter(l=>l.classification==='hot').slice(0,3).map(l=><LeadRow key={l.id} lead={l} T={T} compact onClick={()=>onSelect(l)}/>)}
      </div>
    </div>
  );
}

function LeadsTab({ leads, filter, setFilter, onSelect, T }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:14, fontWeight:700 }}>{leads.length} Leads</span>
        <div style={{ display:'flex', gap:6, marginLeft:6 }}>
          {['all','hot','warm','cold'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', background: filter===f?(f==='all'?'rgba(184,149,42,0.1)':T[f]?.bg||'rgba(184,149,42,0.1)'):'#F5F4F0', color: filter===f?(f==='all'?'#B8952A':T[f]?.c||'#B8952A'):'#7A7A8A', textTransform:'capitalize' }}>
              {f==='all'?'All':f}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {leads.map(l=><LeadRow key={l.id} lead={l} T={T} onClick={()=>onSelect(l)}/>)}
        {leads.length===0 && <div style={{ textAlign:'center', color:'#7A7A8A', padding:'40px', fontSize:14 }}>No leads yet.</div>}
      </div>
    </div>
  );
}

function LeadRow({ lead, onClick, compact, T }) {
  const [hov, setHov] = useState(false);
  const t = T[lead.classification];
  const bgt = lead.budget ? `₹${(lead.budget.max/100000).toFixed(0)}L` : '—';
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ display:'flex', alignItems:'center', gap:12, padding:compact?'9px 12px':'13px 16px', background:hov?'#F5F4F0':'#fff', border:`1px solid ${hov?'rgba(0,0,0,0.12)':'rgba(0,0,0,0.07)'}`, borderRadius:10, cursor:onClick?'pointer':'default', transition:'all 0.15s' }}>
      <div style={{ width:36, height:36, borderRadius:9, background:t.bg, border:`1px solid ${t.b}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:t.c, flexShrink:0 }}>{(lead.name||'?')[0].toUpperCase()}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
          <span style={{ fontWeight:700, fontSize:13 }}>{lead.name||'Anonymous'}</span>
          {lead.tags?.includes('urgent') && <Chip l="Urgent" c="#FF5757"/>}
          {lead.tags?.includes('cash_buyer') && <Chip l="Cash" c="#2AAD6A"/>}
        </div>
        <div style={{ fontSize:11, color:'#7A7A8A', display:'flex', gap:10, flexWrap:'wrap' }}>
          {lead.location && <span>📍 {lead.location}</span>}
          {lead.propertyType && <span>🏠 {lead.propertyType}</span>}
          {lead.budget && <span>💰 {bgt}</span>}
          {lead.timeline && <span>⏰ {lead.timeline}</span>}
        </div>
      </div>
      <ScoreDial s={lead.intentScore} c={t.c}/>
      <Chip l={t.l} c={t.c}/>
    </div>
  );
}

function AnalyticsTab({ a }) {
  if (!a) return null;
  const { locations, budgetBuckets, propertyTypes, trend } = a;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>💰 Budget Distribution</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={budgetBuckets} layout="vertical">
            <XAxis type="number" tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
            <YAxis dataKey="range" type="category" tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false} width={80}/>
            <Tooltip contentStyle={{ background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:11 }}/>
            <Bar dataKey="count" fill="#B8952A" radius={[0,4,4,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>📍 Top Locations</div>
        {(locations||[]).slice(0,6).map((l,i)=>(
          <div key={l.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:11, color:'#7A7A8A', width:14, textAlign:'right' }}>{i+1}</span>
            <span style={{ flex:1, fontSize:12 }}>{l.name}</span>
            <div style={{ width:80, background:'#F5F4F0', borderRadius:4, height:5 }}><div style={{ height:'100%', width:`${Math.round((l.count/(locations[0]?.count||1))*100)}%`, background:'#B8952A', borderRadius:4 }}/></div>
            <span style={{ fontSize:12, fontWeight:700, color:'#B8952A', width:18, textAlign:'right' }}>{l.count}</span>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🏠 Property Demand</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={propertyTypes}>
            <XAxis dataKey="type" tick={{ fontSize:11, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:11 }}/>
            <Bar dataKey="count" fill="#2A6DD4" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.07)', padding:'20px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🎯 Avg Intent Score Trend</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={trend}>
            <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#B8952A" stopOpacity={0.25}/><stop offset="95%" stopColor="#B8952A" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="date" tick={{ fontSize:9, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
            <YAxis domain={[0,100]} tick={{ fontSize:10, fill:'#7A7A8A' }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:11 }}/>
            <Area type="monotone" dataKey="avgScore" stroke="#B8952A" fill="url(#sg)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LeadModal({ lead, onClose, T }) {
  const t = T[lead.classification];
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', width:'100%', maxWidth:580, maxHeight:'85vh', overflow:'auto', fontFamily:"'Outfit',sans-serif" }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:11, background:t.bg, border:`1px solid ${t.b}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:t.c }}>{(lead.name||'?')[0].toUpperCase()}</div>
            <div><div style={{ fontWeight:700, fontSize:15 }}>{lead.name||'Anonymous'}</div><div style={{ fontSize:12, color:'#7A7A8A' }}>{lead.email||lead.phone||'No contact yet'}</div></div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <ScoreDial s={lead.intentScore} c={t.c} lg/>
            <button onClick={onClose} style={{ background:'#F5F4F0', border:'1px solid rgba(0,0,0,0.1)', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>✕</button>
          </div>
        </div>
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[{l:'Budget',v:lead.budget?`₹${(lead.budget.min/100000).toFixed(0)}L–₹${(lead.budget.max/100000).toFixed(0)}L`:'Unknown'},{l:'Location',v:lead.location||'Unknown'},{l:'Type',v:lead.propertyType||'Unknown'},{l:'Timeline',v:lead.timeline||'Unknown'},{l:'Financing',v:lead.financing?.replace('_',' ')||'Unknown'},{l:'Messages',v:`${lead.messageCount||0} msgs`}].map(f=>(
              <div key={f.l} style={{ padding:'10px 12px', background:'#F5F4F0', borderRadius:8 }}>
                <div style={{ fontSize:10, color:'#7A7A8A', marginBottom:2 }}>{f.l}</div>
                <div style={{ fontSize:13, fontWeight:600 }}>{f.v}</div>
              </div>
            ))}
          </div>
          {lead.tags?.length > 0 && <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{lead.tags.map(tag=><Chip key={tag} l={tag.replace(/_/g,' ')} c="#B8952A"/>)}</div>}
          <div style={{ display:'flex', gap:8 }}>
            {lead.phone && <a href={`tel:${lead.phone}`} style={{ flex:1, padding:'10px', borderRadius:8, background:'rgba(42,173,106,0.08)', border:'1px solid rgba(42,173,106,0.2)', color:'#2AAD6A', textAlign:'center', fontSize:12, fontWeight:600, textDecoration:'none' }}>📞 {lead.phone}</a>}
            {lead.email && <a href={`mailto:${lead.email}`} style={{ flex:1, padding:'10px', borderRadius:8, background:'rgba(184,149,42,0.08)', border:'1px solid rgba(184,149,42,0.2)', color:'#B8952A', textAlign:'center', fontSize:12, fontWeight:600, textDecoration:'none' }}>✉️ Email</a>}
            {!lead.phone && !lead.email && <div style={{ flex:1, padding:'10px', borderRadius:8, background:'#F5F4F0', color:'#7A7A8A', textAlign:'center', fontSize:12 }}>Contact not captured yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ s, c, lg }) {
  const sz = lg ? 50 : 40; const in_ = lg ? 38 : 30;
  return (
    <div style={{ width:sz, height:sz, borderRadius:'50%', background:`conic-gradient(${c} ${s*3.6}deg, #F5F4F0 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <div style={{ width:in_, height:in_, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:lg?13:11, fontWeight:800, color:c }}>{s}</div>
    </div>
  );
}

function Chip({ l, c }) {
  return <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background:`${c}12`, color:c, border:`1px solid ${c}25` }}>{l}</span>;
}

const DEMO = [
  { id:'ld-001', name:'Priya Sharma', intentScore:87, classification:'hot', budget:{min:8000000,max:12000000}, location:'Banjara Hills', propertyType:'3BHK', timeline:'3 months', financing:'home_loan', messageCount:14, tags:['urgent','loan_ready'], phone:'+91 98765 43210', email:'priya@example.com', createdAt: new Date(Date.now()-7200000).toISOString() },
  { id:'ld-002', name:'Rahul Mehta', intentScore:62, classification:'warm', budget:{min:5000000,max:7000000}, location:'Gachibowli', propertyType:'2BHK', timeline:'6 months', financing:'self_funded', messageCount:9, tags:[], phone:'+91 87654 32109', email:null, createdAt: new Date(Date.now()-18000000).toISOString() },
  { id:'ld-003', name:'Vikram Nair', intentScore:91, classification:'hot', budget:{min:15000000,max:25000000}, location:'Jubilee Hills', propertyType:'4BHK', timeline:'1 month', financing:'self_funded', messageCount:21, tags:['vip','cash_buyer','urgent'], phone:'+91 95432 10987', email:'vikram@example.com', createdAt: new Date(Date.now()-3600000).toISOString() },
  { id:'ld-004', name:'Ananya Reddy', intentScore:28, classification:'cold', budget:{min:3000000,max:5000000}, location:'Kompally', propertyType:'2BHK', timeline:'1+ year', financing:'undecided', messageCount:4, tags:[], phone:null, email:null, createdAt: new Date(Date.now()-86400000).toISOString() },
];
const DEMO_A = {
  summary:{ total:4, hot:2, warm:1, cold:1, avgScore:67, conversionRate:50 },
  trend:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>({ date:d, hot:Math.floor(Math.random()*3), warm:Math.floor(Math.random()*4), cold:Math.floor(Math.random()*5), avgScore:50+Math.floor(Math.random()*40) })),
  locations:[{name:'Banjara Hills',count:2},{name:'Gachibowli',count:1},{name:'Jubilee Hills',count:1}],
  budgetBuckets:[{range:'Under 50L',count:0},{range:'50L-1Cr',count:2},{range:'1Cr-2Cr',count:1},{range:'Above 2Cr',count:1}],
  propertyTypes:[{type:'2BHK',count:2},{type:'3BHK',count:1},{type:'4BHK',count:1}],
};


