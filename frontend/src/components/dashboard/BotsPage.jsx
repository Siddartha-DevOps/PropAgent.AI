// frontend/src/components/dashboard/BotsPage.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function BotsPage() {
  const [bots, setBots]       = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchBots() }, [])

  async function fetchBots() {
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.get(`${API}/api/bots`, { headers: { Authorization: `Bearer ${token}` } })
      setBots(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function deleteBot(id, name) {
    if (!window.confirm(`Delete "${name}"? This removes all training data.`)) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API}/api/bots/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setBots(prev => prev.filter(b => b._id !== id))
    } catch { alert('Delete failed') }
  }

  function copyEmbed(botId) {
    const snippet = `<script src="${API}/api/widget/${botId}.js" async><\/script>`
    navigator.clipboard.writeText(snippet)
    setCopied(botId)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div style={styles.center}><Spinner /></div>

  return (
    <div style={styles.page}>
      <div style={styles.hdr}>
        <div>
          <h2 style={styles.h2}>My Bots</h2>
          <p style={styles.sub}>Create AI chatbots for your real estate projects.</p>
        </div>
        <button style={styles.btnPrimary} onClick={() => navigate('/dashboard/bots/new')}>
          + New Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>🤖</div>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No bots yet</p>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            Upload brochures and start capturing leads 24/7.
          </p>
          <button style={styles.btnPrimary} onClick={() => navigate('/dashboard/bots/new')}>
            Create your first bot
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {bots.map(bot => (
            <div key={bot._id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={{ ...styles.avatar, background: bot.primaryColor || '#1a56db' }}>
                  {(bot.name || 'B')[0].toUpperCase()}
                </div>
                <span style={{
                  ...styles.badge,
                  background: bot.status === 'ready' ? '#dcfce7' : '#fef3c7',
                  color:      bot.status === 'ready' ? '#15803d' : '#92400e',
                }}>
                  {bot.status === 'ready' ? '● Live' : '⟳ Training'}
                </span>
              </div>

              <h3 style={styles.cardName}>{bot.name}</h3>
              {bot.description && <p style={styles.cardDesc}>{bot.description}</p>}

              <div style={styles.stats}>
                <div><strong>{bot.totalMessages || 0}</strong><span>Messages</span></div>
                <div><strong>{bot.totalLeads || 0}</strong><span>Leads</span></div>
              </div>

              <div style={styles.cardActions}>
                <button style={styles.btnManage} onClick={() => navigate(`/dashboard/bots/${bot._id}`)}>
                  ⚙ Manage
                </button>
                <button
                  style={{ ...styles.btnIcon, background: copied === bot._id ? '#dcfce7' : '#f1f5f9' }}
                  onClick={() => copyEmbed(bot._id)}
                  title="Copy embed code"
                >
                  {copied === bot._id ? '✓' : '⟨/⟩'}
                </button>
                <button
                  style={{ ...styles.btnIcon, background: '#fef2f2', color: '#ef4444' }}
                  onClick={() => deleteBot(bot._id, bot.name)}
                  title="Delete bot"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTop: '3px solid #1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
}

const styles = {
  page:    { padding: 32, maxWidth: 1100, margin: '0 auto' },
  hdr:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  h2:      { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4 },
  center:  { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 },
  btnPrimary: {
    background: '#1a56db', color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  grid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 },
  card:  { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  avatar:  { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 },
  badge:   { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  cardName: { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 },
  cardDesc: { fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  stats:   { display: 'flex', gap: 24, '& div': { display: 'flex', flexDirection: 'column' } },
  cardActions: { display: 'flex', gap: 8, marginTop: 4 },
  btnManage: { flex: 1, background: '#1a56db', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnIcon:   { width: 36, height: 36, border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '60px 40px', textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
}