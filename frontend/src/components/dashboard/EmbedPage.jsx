import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getAccessToken } from '../../services/api';


const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function EmbedPage() {
  const { botId } = useParams()
  const navigate  = useNavigate()
  const [bot, setBot]       = useState(null)
  const [copied, setCopied] = useState(null)
  const token = getAccessToken();

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios.get(`${API}/api/bots/${botId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setBot(r.data))
  }, [botId])

  const embedCode  = `<script src="${API}/api/widget/${botId}.js" async><\/script>`
  const directLink = `${window.location.origin}/chat/${botId}`

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  if (!bot) return <div style={S.center}>Loading…</div>

  return (
    <div style={S.page}>
      <h2 style={S.h2}>Embed — {bot.name}</h2>
      <p style={S.sub}>Add your chatbot to any website in one line.</p>

      <div style={S.card}>
        <h3 style={S.ct}>📋 Embed Code</h3>
        <p style={S.hint}>Paste this just before the <code style={S.code}>&lt;/body&gt;</code> tag on any page.</p>
        <div style={{ position:'relative' }}>
          <pre style={S.pre}>{embedCode}</pre>
          <button style={S.copyBtn} onClick={() => copy(embedCode, 'embed')}>
            {copied==='embed' ? '✓ Copied!' : '⟨/⟩ Copy'}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.ct}>🔗 Direct Chat Link</h3>
        <p style={S.hint}>Share this link directly with buyers.</p>
        <div style={{ display:'flex', gap:10 }}>
          <input readOnly style={{ ...S.input, flex:1, fontFamily:'monospace', fontSize:12 }} value={directLink} />
          <button style={S.btnPrimary} onClick={() => copy(directLink, 'link')}>
            {copied==='link' ? '✓ Copied':'Copy'}
          </button>
        </div>
      </div>

      <div style={{ ...S.card, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <h3 style={{ ...S.ct, color:'#1e40af' }}>✅ Go-Live Checklist</h3>
        {[
          ['Upload brochures and pricing PDFs in the Train tab', true],
          ["Paste the embed code in your website's HTML", false],
          ['Test the chat widget on your site', false],
          ['Check that leads appear in your Leads tab', false],
        ].map(([item, done]) => (
          <div key={item} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:16 }}>{done ? '✅':'⬜'}</span>
            <span style={{ fontSize:13, color: done ? '#15803d':'#334155' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  page:    { padding:32, maxWidth:720, margin:'0 auto' },
  center:  { display:'flex', justifyContent:'center', alignItems:'center', height:300 },
  h2:      { fontSize:22, fontWeight:700, color:'#0f172a', margin:0 },
  sub:     { fontSize:13, color:'#64748b', marginTop:4, marginBottom:28 },
  card:    { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:24, marginBottom:16 },
  ct:      { fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 8px' },
  hint:    { fontSize:13, color:'#64748b', margin:'0 0 14px', lineHeight:1.5 },
  code:    { background:'#f1f5f9', padding:'1px 6px', borderRadius:5, fontFamily:'monospace', fontSize:12 },
  pre:     { background:'#0f172a', color:'#7dd3fc', padding:18, borderRadius:12, overflowX:'auto', fontSize:12.5, fontFamily:'monospace', margin:0, lineHeight:1.6 },
  copyBtn: { position:'absolute', top:10, right:10, background:'#1e293b', color:'#e2e8f0', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer' },
  input:   { padding:'10px 13px', border:'1.5px solid #e2e8f0', borderRadius:10, outline:'none', color:'#334155' },
  btnPrimary: { background:'#1a56db', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
}