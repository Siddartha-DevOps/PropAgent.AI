import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'
const STATUSES = ['new','contacted','qualified','converted','lost']

export default function LeadsPage() {
  const [leads, setLeads]   = useState([])
  const [bots, setBots]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ botId:'', intent:'', status:'' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const hdrs  = { Authorization: `Bearer ${token}` }
    Promise.all([
      axios.get(`${API}/api/leads`, { headers: hdrs }),
      axios.get(`${API}/api/bots`,  { headers: hdrs }),
    ]).then(([l, b]) => {
      setLeads(l.data.leads || l.data)
      setBots(b.data)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = leads.filter(l => {
    if (filter.botId  && l.botId       !== filter.botId)  return false
    if (filter.intent && l.intentLabel !== filter.intent) return false
    if (filter.status && l.status      !== filter.status) return false
    return true
  })

  async function updateStatus(leadId, status) {
    const token = localStorage.getItem('token')
    await axios.patch(`${API}/api/leads/${leadId}/status`, { status },
      { headers: { Authorization: `Bearer ${token}` } })
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status } : l))
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.get(`${API}/api/leads/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params:  filter.botId ? { botId: filter.botId } : {},
        responseType: 'blob',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(res.data)
      a.download = 'propagent-leads.csv'; a.click()
    } catch {}
    setExporting(false)
  }

  if (loading) return <div style={S.center}>Loading leads…</div>

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <div>
          <h2 style={S.h2}>Leads</h2>
          <p style={S.sub}>All buyer inquiries captured by your chatbots.</p>
        </div>
        <button style={S.btnSec} onClick={exportCSV} disabled={exporting}>
          {exporting ? '…':'⬇ Export CSV'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {[
          { label:'Total Leads',  val:leads.length,                                          color:'#1a56db' },
          { label:'🔥 Hot Leads', val:leads.filter(l=>l.intentLabel==='hot').length,          color:'#dc2626' },
          { label:'✅ Converted', val:leads.filter(l=>l.status==='converted').length,         color:'#059669' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', padding:'16px 20px', textAlign:'center' }}>
            <p style={{ fontSize:26, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
            <p style={{ fontSize:12, color:'#64748b', marginTop:3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <span style={{ fontSize:13, color:'#64748b', fontWeight:500 }}>Filter:</span>
        <select style={S.select} value={filter.botId} onChange={e => setFilter(f=>({...f,botId:e.target.value}))}>
          <option value="">All Bots</option>
          {bots.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select style={S.select} value={filter.intent} onChange={e => setFilter(f=>({...f,intent:e.target.value}))}>
          <option value="">All Intent</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌡 Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>
        <select style={S.select} value={filter.status} onChange={e => setFilter(f=>({...f,status:e.target.value}))}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filter.botId||filter.intent||filter.status) &&
          <button style={{ background:'none',border:'none',color:'#ef4444',fontSize:13,cursor:'pointer' }}
            onClick={() => setFilter({botId:'',intent:'',status:''})}>Clear</button>}
        <span style={{ marginLeft:'auto', fontSize:13, color:'#94a3b8' }}>{filtered.length} leads</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8' }}>
          <p style={{ fontSize:28 }}>📭</p>
          <p>No leads match your filters.</p>
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Name','Contact','First Message','Intent','Status','Date'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:12, fontWeight:600, color:'#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead._id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={S.td}><strong style={{ color:'#0f172a' }}>{lead.name}</strong></td>
                  <td style={S.td}>
                    {lead.phone && <div style={{ fontSize:12, color:'#64748b' }}>📞 {lead.phone}</div>}
                    {lead.email && <div style={{ fontSize:12, color:'#64748b' }}>✉ {lead.email}</div>}
                  </td>
                  <td style={{ ...S.td, maxWidth:200 }}>
                    <p style={{ margin:0, fontSize:12, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lead.firstMessage||'—'}
                    </p>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                      background: lead.intentLabel==='hot'?'#fee2e2':lead.intentLabel==='warm'?'#ffedd5':'#dbeafe',
                      color:      lead.intentLabel==='hot'?'#b91c1c':lead.intentLabel==='warm'?'#9a3412':'#1e40af' }}>
                      {lead.intentLabel}
                    </span>
                  </td>
                  <td style={S.td}>
                    <select value={lead.status} onChange={e => updateStatus(lead._id, e.target.value)}
                      style={{ fontSize:11, border:'1px solid #e2e8f0', borderRadius:20, padding:'3px 8px', outline:'none', cursor:'pointer', background:'#fff' }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, color:'#94a3b8', fontSize:12, whiteSpace:'nowrap' }}>
                    {new Date(lead.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S = {
  page:      { padding:32, maxWidth:1100, margin:'0 auto' },
  center:    { display:'flex', justifyContent:'center', alignItems:'center', height:300 },
  topBar:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  h2:        { fontSize:22, fontWeight:700, color:'#0f172a', margin:0 },
  sub:       { fontSize:13, color:'#64748b', marginTop:4 },
  filterBar: { display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'12px 16px', marginBottom:16 },
  select:    { padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', cursor:'pointer', background:'#fff' },
  td:        { padding:'12px 16px', fontSize:13, color:'#334155', verticalAlign:'middle' },
  btnSec:    { background:'#fff', color:'#334155', border:'1px solid #e2e8f0', borderRadius:10, padding:'9px 16px', fontSize:14, fontWeight:500, cursor:'pointer' },
}