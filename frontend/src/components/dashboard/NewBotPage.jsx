import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getAccessToken } from '../../services/api';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'
const COLORS = ['#1a56db','#059669','#7c3aed','#dc2626','#ea580c','#0891b2','#db2777']

export default function NewBotPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const token = getAccessToken();
  const [error, setError]     = useState('')
  const [form, setForm] = useState({
    name:'', description:'', primaryColor:'#1a56db',
    welcomeMessage:"Hi! I'm your real estate assistant. How can I help you today?",
    placeholder:'Ask about pricing, availability, floor plans...',
    captureLeads:true, leadFormTitle:'Get More Details', requirePhone:true,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Bot name is required'); return }
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.post(`${API}/api/bots`, form, { headers: { Authorization: `Bearer ${token}` } })
      navigate(`/dashboard/bots/${res.data._id}/train`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bot')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.page}>
      <button style={S.back} onClick={() => navigate('/dashboard/bots')}>← Back</button>
      <h2 style={S.h2}>Create New Bot</h2>
      <p style={S.sub}>Set up an AI assistant for a real estate project.</p>

      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={S.card}>
          <h3 style={S.ct}>Basic Info</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={S.label}>Project / Bot Name *</label>
              <input style={S.input} placeholder="e.g. Prestige Lakeside Heights"
                value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label style={S.label}>Description</label>
              <textarea style={{ ...S.input, resize:'none', height:68 }}
                placeholder="Brief description..." value={form.description}
                onChange={e => set('description', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Brand Color</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => set('primaryColor', c)}
                    style={{ width:34, height:34, borderRadius:8, background:c, border:'none', cursor:'pointer',
                      outline: form.primaryColor===c ? '3px solid #0f172a':'none', outlineOffset:2,
                      transform: form.primaryColor===c ? 'scale(1.15)':'scale(1)', transition:'transform .15s' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={S.ct}>Chat Widget</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={S.label}>Welcome Message</label>
              <textarea style={{ ...S.input, resize:'none', height:64 }}
                value={form.welcomeMessage} onChange={e => set('welcomeMessage', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Input Placeholder</label>
              <input style={S.input} value={form.placeholder} onChange={e => set('placeholder', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={S.ct}>Lead Capture</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Toggle label="Enable lead capture form" hint="Ask name & contact before answering"
              checked={form.captureLeads} onChange={v => set('captureLeads', v)} />
            {form.captureLeads && (
              <>
                <div>
                  <label style={S.label}>Form Title</label>
                  <input style={S.input} value={form.leadFormTitle} onChange={e => set('leadFormTitle', e.target.value)} />
                </div>
                <Toggle label="Require phone number" hint="Phone is mandatory in the form"
                  checked={form.requirePhone} onChange={v => set('requirePhone', v)} />
              </>
            )}
          </div>
        </div>

        {error && <p style={{ color:'#ef4444', fontSize:13 }}>{error}</p>}
        <div style={{ display:'flex', gap:12 }}>
          <button type="button" style={S.btnSec} onClick={() => navigate('/dashboard/bots')}>Cancel</button>
          <button type="submit" disabled={loading} style={S.btnPrimary}>
            {loading ? 'Creating…' : 'Create Bot →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <p style={{ fontSize:14, fontWeight:500, color:'#334155', margin:0 }}>{label}</p>
        {hint && <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} style={{
        width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
        background: checked ? '#1a56db':'#e2e8f0', position:'relative', transition:'background .2s',
      }}>
        <span style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
          background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
          transition:'left .2s', left: checked ? 23:3 }} />
      </button>
    </div>
  )
}

const S = {
  page:  { padding:32, maxWidth:680, margin:'0 auto' },
  back:  { background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:14, padding:0, marginBottom:16 },
  h2:    { fontSize:22, fontWeight:700, color:'#0f172a', margin:0 },
  sub:   { fontSize:13, color:'#64748b', marginTop:4, marginBottom:28 },
  card:  { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:24 },
  ct:    { fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' },
  label: { display:'block', fontSize:13, fontWeight:500, color:'#334155', marginBottom:6 },
  input: { width:'100%', padding:'10px 13px', fontSize:13.5, border:'1.5px solid #e2e8f0', borderRadius:10, outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  btnPrimary: { flex:1, background:'#1a56db', color:'#fff', border:'none', borderRadius:10, padding:'11px 0', fontSize:14, fontWeight:600, cursor:'pointer' },
  btnSec:     { flex:1, background:'#f1f5f9', color:'#334155', border:'1px solid #e2e8f0', borderRadius:10, padding:'11px 0', fontSize:14, fontWeight:500, cursor:'pointer' },
}