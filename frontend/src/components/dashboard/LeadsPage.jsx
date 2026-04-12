// frontend/src/components/dashboard/LeadsPage.jsx
import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'
const STATUSES = ['new','contacted','qualified','converted','lost']

const INTENT_STYLE = {
  hot:  { background: '#fee2e2', color: '#b91c1c' },
  warm: { background: '#ffedd5', color: '#9a3412' },
  cold: { background: '#dbeafe', color: '#1e40af' },
}
const STATUS_STYLE = {
  new:        { background: '#f3e8ff', color: '#6b21a8' },
  contacted:  { background: '#dbeafe', color: '#1e40af' },
  qualified:  { background: '#dcfce7', color: '#15803d' },
  converted:  { background: '#d1fae5', color: '#065f46' },
  lost:       { background: '#f1f5f9', color: '#64748b' },
}

export default function LeadsPage() {
  const [leads, setLeads]   = useState([])
  const [bots, setBots]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ botId: '', intent: '', status: '' })
  const [exporting, setExporting] = useState(false)
  const [toast, setToast]   = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.patch(`${API}/api/leads/${leadId}/status`,
        { status }, { headers: { Authorization: `Bearer ${token}` } })
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: res.data.status } : l))
    } catch { showToast('Update failed') }
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.get(`${API}/api/leads/export`, {
        headers:      { Authorization: `Bearer ${token}` },
        params:       filter.botId ? { botId: filter.botId } : {},
        responseType: 'blob',
      })
      const url  = URL.createObjectURL(res.data)
      const a    = document.createElement('a')
      a.href     = url; a.download = 'propagent-leads.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Export failed') }
    setExporting(false)
  }

  const stats = {
    total:     leads.length,
    hot:       leads.filter(l => l.intentLabel === 'hot').length,
    converted: leads.filter(l => l.status === 'converted').length,
  }

  if (loading) return <div style={styles.center}>Loading leads…</div>

  return (
    <div style={styles.page}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.topBar}>
        <div>
          <h2 style={styles.h2}>Leads</h2>
          <p style={styles.sub}>All buyer inquiries captured by your chatbots.</p>
        </div>
        <button style={styles.btnSecondary} onClick={exportCSV} disabled={exporting}>
          {exporting ? '…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: 'Total Leads',   val: stats.total,     color: '#1a56db' },
          { label: '🔥 Hot Leads',  val: stats.hot,       color: '#dc2626' },
          { label: '✅ Converted',  val: stats.converted, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: 0 }}>{s.val}</p>
            <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Filter:</span>
        <select style={styles.select} value={filter.botId} onChange={e => setFilter(f => ({ ...f, botId: e.target.value }))}>
          <option value="">All Bots</option>
          {bots.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select style={styles.select} value={filter.intent} onChange={e => setFilter(f => ({ ...f, intent: e.target.value }))}>
          <option value="">All Intent</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌡 Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>
        <select style={styles.select} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filter.botId || filter.intent || filter.status) && (
          <button style={styles.clearBtn} onClick={() => setFilter({ botId:'', intent:'', status:'' })}>
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>{filtered.length} leads</span>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
          <p style={{ color: '#64748b' }}>No leads match your filters.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {['Name','Contact','First Message','Intent','Status','Date'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead._id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 600, color: '#0f172a' }}>{lead.name}</td>
                  <td style={styles.td}>
                    {lead.phone && <div style={styles.contact}>📞 {lead.phone}</div>}
                    {lead.email && <div style={styles.contact}>✉ {lead.email}</div>}
                  </td>
                  <td style={{ ...styles.td, maxWidth: 200 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lead.firstMessage || '—'}
                    </p>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(INTENT_STYLE[lead.intentLabel] || {}) }}>
                      {lead.intentLabel}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead._id, e.target.value)}
                      style={{ ...styles.select, ...STATUS_STYLE[lead.status], fontWeight: 600, border: 'none', borderRadius: 20, padding: '3px 8px', fontSize: 11 }}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ ...styles.td, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(lead.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
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

const styles = {
  page:     { padding: 32, maxWidth: 1100, margin: '0 auto', position: 'relative' },
  center:   { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#64748b' },
  topBar:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h2:       { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  sub:      { fontSize: 13, color: '#64748b', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' },
  filterBar:{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 16 },
  select:   { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer', background: '#fff' },
  clearBtn: { background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '4px 8px' },
  tableWrap:{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' },
  table:    { width: '100%', borderCollapse: 'collapse' },
  thead:    { background: '#f8fafc' },
  th:       { textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  tr:       { borderBottom: '1px solid #f1f5f9' },
  td:       { padding: '12px 16px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },
  badge:    { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  contact:  { fontSize: 12, color: '#64748b', marginBottom: 2 },
  empty:    { textAlign: 'center', padding: '60px 0', color: '#94a3b8' },
  btnSecondary: { background: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  toast:    { position: 'fixed', top: 20, right: 24, background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999 },
}