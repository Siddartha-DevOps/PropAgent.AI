// frontend/src/components/dashboard/AnalyticsPage.jsx
// npm install recharts  (if not already installed)

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

export default function AnalyticsPage() {
  const [bots, setBots]   = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const hdrs  = { Authorization: `Bearer ${token}` }
    Promise.all([
      axios.get(`${API}/api/bots`,  { headers: hdrs }),
      axios.get(`${API}/api/leads`, { headers: hdrs }),
    ]).then(([b, l]) => {
      setBots(b.data)
      setLeads(l.data.leads || l.data)
    }).finally(() => setLoading(false))
  }, [])

  // Leads per day — last 14 days
  const leadsPerDay = Array.from({ length: 14 }, (_, i) => {
    const date  = daysAgo(13 - i)
    const count = leads.filter(l => (l.createdAt || '').slice(0, 10) === date).length
    return { date: fmtDate(date), count }
  })

  // Intent breakdown
  const intentData = [
    { name: 'Hot 🔥',  value: leads.filter(l => l.intentLabel === 'hot').length,  color: '#ef4444' },
    { name: 'Warm 🌡', value: leads.filter(l => l.intentLabel === 'warm').length, color: '#f97316' },
    { name: 'Cold ❄️', value: leads.filter(l => l.intentLabel === 'cold').length, color: '#3b82f6' },
  ].filter(d => d.value > 0)

  // Status funnel
  const statusData = ['new','contacted','qualified','converted','lost'].map(s => ({
    name: s, value: leads.filter(l => l.status === s).length,
  })).filter(d => d.value > 0)

  // Bot performance
  const botPerf = bots.map(b => ({
    name:     b.name.length > 16 ? b.name.slice(0, 16) + '…' : b.name,
    messages: b.totalMessages || 0,
    leads:    b.totalLeads    || 0,
  }))

  const kpis = [
    { label: 'Total Leads',    val: leads.length,                                        color: '#1a56db' },
    { label: 'Hot Leads 🔥',   val: leads.filter(l => l.intentLabel === 'hot').length,   color: '#ef4444' },
    { label: 'Converted ✅',   val: leads.filter(l => l.status === 'converted').length,  color: '#059669' },
    { label: 'Total Messages', val: bots.reduce((s, b) => s + (b.totalMessages || 0), 0), color: '#7c3aed' },
  ]

  if (loading) return <div style={styles.center}>Loading analytics…</div>

  return (
    <div style={styles.page}>
      <h2 style={styles.h2}>Analytics</h2>
      <p style={styles.sub}>Performance overview across all your bots.</p>

      {/* KPIs */}
      <div style={styles.kpiRow}>
        {kpis.map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <p style={{ fontSize: 28, fontWeight: 800, color: k.color, margin: 0 }}>{k.val}</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={styles.row2}>
        <ChartCard title="Leads Last 14 Days">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={leadsPerDay} margin={{ top: 5, right: 16, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Line type="monotone" dataKey="count" name="Leads" stroke="#1a56db" strokeWidth={2.5} dot={{ r: 3, fill: '#1a56db' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bot Performance">
          {botPerf.length === 0
            ? <Empty msg="No bots yet" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={botPerf} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="messages" name="Messages" fill="#bfdbfe" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="leads"    name="Leads"    fill="#1a56db" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div style={styles.row2}>
        <ChartCard title="Lead Intent">
          {intentData.length === 0 ? <Empty msg="No leads yet" /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width="50%" height={170}>
                <PieChart>
                  <Pie data={intentData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={4}>
                    {intentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {intentData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#334155' }}>{d.name}</span>
                    <strong style={{ marginLeft: 'auto', fontSize: 14, color: '#0f172a' }}>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Lead Pipeline">
          {statusData.length === 0 ? <Empty msg="No leads yet" /> : (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={statusData} margin={{ top: 5, right: 16, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" name="Leads" radius={[6, 6, 0, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={['#a78bfa','#60a5fa','#34d399','#10b981','#94a3b8'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>{title}</h3>
      {children}
    </div>
  )
}
function Empty({ msg }) {
  return <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>{msg}</div>
}

const styles = {
  page:      { padding: 32, maxWidth: 1100, margin: '0 auto' },
  center:    { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#64748b' },
  h2:        { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  sub:       { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 24 },
  kpiRow:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  kpiCard:   { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center' },
  row2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  chartCard: { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 },
  chartTitle:{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' },
}