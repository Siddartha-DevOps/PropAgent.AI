// frontend/src/components/dashboard/EmbedPage.jsx
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function EmbedPage() {
  const { botId } = useParams()
  const navigate  = useNavigate()
  const [bot, setBot]       = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios.get(`${API}/api/bots/${botId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setBot(r.data)).catch(console.error)
  }, [botId])

  const embedCode  = `<script src="${API}/api/widget/${botId}.js" async><\/script>`
  const directLink = `${API}/chat/${botId}`

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!bot) return <div style={styles.center}>Loading…</div>

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate('/dashboard/bots')}>← Back</button>
      <h2 style={styles.h2}>Embed — {bot.name}</h2>
      <p style={styles.sub}>Add your chatbot to any website in one line.</p>

      {/* Embed snippet */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📋 Embed Code</h3>
        <p style={styles.hint}>
          Paste this snippet just before the <code style={styles.code}>&lt;/body&gt;</code> tag on any page of your website.
        </p>
        <div style={styles.codeBlock}>
          <pre style={styles.pre}>{embedCode}</pre>
          <button style={styles.copyBtn} onClick={() => copy(embedCode, 'embed')}>
            {copied === 'embed' ? '✓ Copied!' : '⟨/⟩ Copy'}
          </button>
        </div>
      </div>

      {/* Direct link */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔗 Direct Chat Link</h3>
        <p style={styles.hint}>Share this link directly with buyers — opens your chatbot in full screen.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input readOnly style={{ ...styles.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            value={directLink} />
          <button style={styles.btnPrimary} onClick={() => copy(directLink, 'link')}>
            {copied === 'link' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>👁 Widget Preview</h3>
        <p style={styles.hint}>This is how your chat button will look on a website.</p>
        <div style={styles.preview}>
          <div style={styles.previewSite}>
            <div style={styles.fakeNav} />
            <div style={styles.fakeText} />
            <div style={{ ...styles.fakeText, width: '60%' }} />
            <div style={{ ...styles.fakeText, width: '75%' }} />
          </div>
          <div style={{ ...styles.previewBtn, background: bot.primaryColor || '#1a56db' }}>
            💬
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ ...styles.card, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <h3 style={{ ...styles.cardTitle, color: '#1e40af' }}>✅ Go-Live Checklist</h3>
        {[
          ['Upload brochures and pricing PDFs in the Train tab', true],
          ['Test the chat widget in a staging environment first', false],
          ['Paste the embed code in your website\'s HTML', false],
          ['Check that leads are appearing in your Leads tab', false],
          ['Set up follow-up reminders for hot leads', false],
        ].map(([item, done]) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>{done ? '✅' : '⬜'}</span>
            <span style={{ fontSize: 13, color: done ? '#15803d' : '#334155' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page:     { padding: 32, maxWidth: 720, margin: '0 auto' },
  center:   { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 },
  back:     { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 16 },
  h2:       { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  sub:      { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 28 },
  card:     { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, marginBottom: 16 },
  cardTitle:{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' },
  hint:     { fontSize: 13, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 },
  code:     { background: '#f1f5f9', padding: '1px 6px', borderRadius: 5, fontFamily: 'monospace', fontSize: 12 },
  codeBlock:{ position: 'relative' },
  pre:      { background: '#0f172a', color: '#7dd3fc', padding: 18, borderRadius: 12, overflowX: 'auto', fontSize: 12.5, fontFamily: 'monospace', margin: 0, lineHeight: 1.6 },
  copyBtn:  { position: 'absolute', top: 10, right: 10, background: '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  input:    { padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none', color: '#334155' },
  btnPrimary: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  preview:  { background: '#f8fafc', borderRadius: 12, padding: 24, position: 'relative', minHeight: 140 },
  previewSite: { display: 'flex', flexDirection: 'column', gap: 8 },
  fakeNav:  { height: 12, background: '#e2e8f0', borderRadius: 4, width: '40%' },
  fakeText: { height: 8, background: '#e2e8f0', borderRadius: 4 },
  previewBtn: { position: 'absolute', bottom: 16, right: 16, width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,0,0,.2)', cursor: 'default' },
}