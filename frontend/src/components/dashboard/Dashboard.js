import React, { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, useParams } from 'react-router-dom'
import BotsPage      from './BotsPage'
import NewBotPage    from './NewBotPage'
import TrainPage     from './TrainPage'
import LeadsPage     from './LeadsPage'
import EmbedPage     from './EmbedPage'
import AnalyticsPage from './AnalyticsPage'
import BotCustomizePage      from './BotCustomizePage'
import ConversationHistoryPage from './ConversationHistoryPage'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

const NAV = [
  { to:'/dashboard',           label:'🏠 Overview',   end:true },
  { to:'/dashboard/bots',      label:'🤖 Bots'              },
  { to:'/dashboard/leads',     label:'👥 Leads'             },
  { to:'/dashboard/analytics', label:'📊 Analytics'         },
]

// Add state for selected bot and active page:
export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [activePage, setActivePage]   = useState('bots');   // already exists, adjust
  const [selectedBotId, setSelectedBotId] = useState(null);

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || '{}')) } catch {}
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
    : 'PA'

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <span style={{ fontSize:22 }}>🏢</span>
          <span style={S.logoTxt}>PropAgent.AI</span>
        </div>
        <nav style={S.nav}>
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}
              style={({ isActive }) => ({ ...S.link, ...(isActive ? S.linkActive:{}) })}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={S.userArea}>
          <div style={S.avatar}>{initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.name || 'Builder'}
            </p>
            <p style={{ fontSize:11, color:'#94a3b8', margin:'1px 0 0', textTransform:'capitalize' }}>
              {user?.plan || 'starter'} plan
            </p>
          </div>
          <button onClick={logout} title="Logout"
            style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:4 }}>
            ⎋
          </button>
        </div>
      </aside>

      <main style={S.main}>
        <Routes>
          <Route path="/"               element={<OverviewPage user={user} />} />
          <Route path="/bots"           element={<BotsPage />} />
          <Route path="/bots/new"       element={<NewBotPage />} />
          <Route path="/bots/:botId/train" element={<TrainPage />} />
          <Route path="/bots/:botId/embed" element={<EmbedPage />} />
          <Route path="/leads"          element={<LeadsPage />} />
          <Route path="/analytics"      element={<AnalyticsPage />} />
        </Routes>
      </main>
    </div>
  )
}

{activePage === 'customize' && (
  <BotCustomizePage
    botId={selectedBotId}
    token={token}
    onBack={() => setActivePage('bots')}
  />
)}
{activePage === 'history' && (
  <ConversationHistoryPage
    botId={selectedBotId}
    token={token}
    onBack={() => setActivePage('bots')}
  />
)}

function OverviewPage({ user }) {
  const navigate = useNavigate()
  const [stats, setStats]       = useState({ bots:0, leads:0, messages:0, hot:0 })
  const [recentLeads, setRecent] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const hdrs  = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API}/api/bots`,  { headers: hdrs }).then(r=>r.json()),
      fetch(`${API}/api/leads`, { headers: hdrs }).then(r=>r.json()),
    ]).then(([bots, leadsRes]) => {
      const leads = leadsRes.leads || leadsRes
      setStats({
        bots:     bots.length,
        leads:    leads.length,
        messages: bots.reduce((s,b)=>s+(b.totalMessages||0),0),
        hot:      leads.filter(l=>l.intentLabel==='hot').length,
      })
      setRecent(leads.slice(0,5))
    }).catch(console.error)
  }, [])

  return (
    <div style={{ padding:32, maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700, color:'#0f172a', margin:0 }}>
            Good day, {user?.name?.split(' ')[0] || 'there'} 👋
          </h2>
          <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Here's your PropAgent.AI summary.</p>
        </div>
        <button style={{ background:'#1a56db', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:600, cursor:'pointer' }}
          onClick={() => navigate('/dashboard/bots/new')}>+ New Bot</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Bots',    val:stats.bots,     icon:'🤖', color:'#1a56db' },
          { label:'Total Leads',   val:stats.leads,    icon:'👥', color:'#059669' },
          { label:'Messages Sent', val:stats.messages, icon:'💬', color:'#7c3aed' },
          { label:'Hot Leads 🔥',  val:stats.hot,      icon:'🔥', color:'#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', padding:'20px 24px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:28 }}>{s.icon}</div>
            <div>
              <p style={{ fontSize:26, fontWeight:800, color:s.color, margin:0 }}>{s.val}</p>
              <p style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {recentLeads.length > 0 && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:0 }}>Recent Leads</h3>
            <button style={{ background:'none', border:'none', color:'#1a56db', fontSize:13, cursor:'pointer' }}
              onClick={() => navigate('/dashboard/leads')}>View all →</button>
          </div>
          {recentLeads.map(l => (
            <div key={l._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid #f8fafc' }}>
              <div>
                <p style={{ fontWeight:600, fontSize:14, color:'#0f172a', margin:0 }}>{l.name}</p>
                <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>{l.phone || l.email}</p>
              </div>
              <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                background: l.intentLabel==='hot'?'#fee2e2':l.intentLabel==='warm'?'#ffedd5':'#dbeafe',
                color:      l.intentLabel==='hot'?'#b91c1c':l.intentLabel==='warm'?'#9a3412':'#1e40af' }}>
                {l.intentLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  shell:   { display:'flex', height:'100vh', overflow:'hidden', background:'#f8fafc' },
  sidebar: { width:220, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', flexShrink:0 },
  logo:    { display:'flex', alignItems:'center', gap:10, padding:'20px 18px', borderBottom:'1px solid #f1f5f9' },
  logoTxt: { fontSize:15, fontWeight:800, color:'#0f172a' },
  nav:     { flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2 },
  link:    { display:'block', padding:'9px 12px', borderRadius:10, fontSize:13.5, fontWeight:500, color:'#64748b', textDecoration:'none' },
  linkActive: { background:'#eff6ff', color:'#1a56db', fontWeight:700 },
  userArea:{ padding:'12px 14px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10 },
  avatar:  { width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1a56db,#3b82f6)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  main:    { flex:1, overflowY:'auto' },
}