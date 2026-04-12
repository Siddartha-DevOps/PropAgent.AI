import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function BotsPage() {
  const [bots, setBots]     = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios.get(`${API}/api/bots`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setBots(r.data))
      .finally(() => setLoading(false))
  }, [])

  async function deleteBot(id, name) {
    if (!window.confirm(`Delete "${name}"? This removes all training data.`)) return
    const token = localStorage.getItem('token')
    await axios.delete(`${API}/api/bots/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    setBots(prev => prev.filter(b => b._id !== id))
  }

  function copyEmbed(botId) {
    navigator.clipboard.writeText(`<script src="${API}/api/widget/${botId}.js" async><\/script>`)
    setCopied(botId)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div style={S.center}>Loading…</div>

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <h2 style={S.h2}>My Bots</h2>
          <p style={S.sub}>Create AI chatbots for your real estate projects.</p>
        </div>
        <button style={S.btnPrimary} onClick={() => navigate('/dashboard/bots/new')}>+ New Bot</button>
      </div>

      {bots.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>No bots yet</p>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Upload brochures and start capturing leads 24/7.</p>
          <button style={S.btnPrimary} onClick={() => navigate('/dashboard/bots/new')}>Create your first bot</button>
        </div>
      ) : (
        <div style={S.grid}>
          {bots.map(bot => (
            <div key={bot._id} style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ ...S.avatar, background: bot.primaryColor || '#1a56db' }}>
                  {(bot.name||'B')[0].toUpperCase()}
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                  background: bot.status==='ready' ? '#dcfce7':'#fef3c7',
                  color:      bot.status==='ready' ? '#15803d':'#92400e' }}>
                  {bot.status==='ready' ? '● Live' : '⟳ Training'}
                </span>
              </div>
              <h3 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 4px' }}>{bot.name}</h3>
              {bot.description && <p style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>{bot.description}</p>}
              <div style={{ display:'flex', gap:20, marginBottom:14 }}>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:20, fontWeight:800, color:'#0f172a', margin:0 }}>{bot.totalMessages||0}</p>
                  <p style={{ fontSize:11, color:'#94a3b8' }}>Messages</p>
                </div>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:20, fontWeight:800, color:'#0f172a', margin:0 }}>{bot.totalLeads||0}</p>
                  <p style={{ fontSize:11, color:'#94a3b8' }}>Leads</p>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.btnManage} onClick={() => navigate(`/dashboard/bots/${bot._id}/train`)}>⚙ Manage</button>
                <button style={{ ...S.btnIcon, background: copied===bot._id ? '#dcfce7':'#f1f5f9' }}
                  onClick={() => copyEmbed(bot._id)} title="Copy embed code">
                  {copied===bot._id ? '✓' : '⟨/⟩'}
                </button>
                <button style={{ ...S.btnIcon, background:'#fef2f2', color:'#ef4444' }}
                  onClick={() => deleteBot(bot._id, bot.name)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  page: { padding:32, maxWidth:1100, margin:'0 auto' },
  hdr:  { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 },
  h2:   { fontSize:22, fontWeight:700, color:'#0f172a', margin:0 },
  sub:  { fontSize:13, color:'#64748b', marginTop:4 },
  center: { display:'flex', justifyContent:'center', alignItems:'center', height:300 },
  btnPrimary: { background:'#1a56db', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:600, cursor:'pointer' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 },
  card: { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20 },
  avatar: { width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18, fontWeight:700 },
  btnManage: { flex:1, background:'#1a56db', color:'#fff', border:'none', borderRadius:9, padding:'8px 0', fontSize:13, fontWeight:600, cursor:'pointer' },
  btnIcon: { width:36, height:36, border:'none', borderRadius:9, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' },
  empty: { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'60px 40px', textAlign:'center' },
}