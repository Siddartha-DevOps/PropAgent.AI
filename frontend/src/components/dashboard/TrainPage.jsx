// frontend/src/components/dashboard/TrainPage.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function TrainPage() {
  const { botId }  = useParams()
  const navigate   = useNavigate()
  const fileRef    = useRef()

  const [bot, setBot]           = useState(null)
  const [docs, setDocs]         = useState([])
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [urlLoading, setUrlLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast]       = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const hdrs  = { Authorization: `Bearer ${token}` }
      const [botRes, docsRes] = await Promise.all([
        axios.get(`${API}/api/bots/${botId}`, { headers: hdrs }),
        axios.get(`${API}/api/training/${botId}/documents`, { headers: hdrs }),
      ])
      setBot(botRes.data)
      setDocs(docsRes.data)
    } catch (e) { console.error(e) }
  }, [botId])

  useEffect(() => { load() }, [load])

  // Poll while any doc is processing
  useEffect(() => {
    const processing = docs.some(d => d.status === 'processing')
    if (!processing) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [docs, load])

  async function uploadPDF(file) {
    if (!file || !file.name.endsWith('.pdf')) { showToast('Only PDF files allowed'); return }
    setUploading(true); setProgress(0)
    const fd = new FormData()
    fd.append('botId', botId)
    fd.append('file', file)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API}/api/training/pdf`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / e.total)),
      })
      showToast('PDF uploaded — training in progress…')
      load()
    } catch { showToast('Upload failed') }
    setUploading(false)
  }

  async function addURL() {
    if (!urlInput.trim()) return
    setUrlLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API}/api/training/url`, { botId, url: urlInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } })
      showToast('URL added — crawling in progress…')
      setUrlInput('')
      load()
    } catch { showToast('Failed to add URL') }
    setUrlLoading(false)
  }

  async function deleteDoc(docId) {
    if (!window.confirm('Remove this training document?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API}/api/training/${botId}/documents/${docId}`,
        { headers: { Authorization: `Bearer ${token}` } })
      setDocs(prev => prev.filter(d => d._id !== docId))
      showToast('Document removed')
    } catch { showToast('Delete failed') }
  }

  if (!bot) return <div style={styles.center}>Loading…</div>

  return (
    <div style={styles.page}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <button style={styles.back} onClick={() => navigate('/dashboard/bots')}>← Back</button>
      <div style={styles.hdr}>
        <div style={{ ...styles.avatar, background: bot.primaryColor || '#1a56db' }}>
          {(bot.name || 'B')[0]}
        </div>
        <div>
          <h2 style={styles.h2}>{bot.name}</h2>
          <span style={{ fontSize: 12, color: bot.status === 'ready' ? '#15803d' : '#92400e',
            background: bot.status === 'ready' ? '#dcfce7' : '#fef3c7',
            padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            {bot.status === 'ready' ? '● Live' : '⟳ Training'}
          </span>
        </div>
      </div>

      {/* PDF Upload */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📄 Upload PDF</h3>
        <div
          style={styles.dropzone}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); uploadPDF(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
          <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>Drop PDF here or click to upload</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Brochures, pricing sheets, floor plans, RERA docs</p>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => uploadPDF(e.target.files[0])} />
        {uploading && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4 }}>
              <div style={{ height: 6, background: '#1a56db', borderRadius: 4, width: `${progress}%`, transition: 'width .2s' }} />
            </div>
          </div>
        )}
      </div>

      {/* URL Ingest */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔗 Add Website URL</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ ...styles.input, flex: 1 }}
            placeholder="https://yourproject.com/details"
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addURL()} />
          <button style={styles.btnPrimary} onClick={addURL} disabled={urlLoading}>
            {urlLoading ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Docs list */}
      {docs.length > 0 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...styles.cardTitle, margin: 0 }}>Training Data ({docs.length} docs)</h3>
            <button style={styles.btnGhost} onClick={load}>↻ Refresh</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <div key={doc._id} style={styles.docRow}>
                <div style={{ fontSize: 20 }}>{doc.type === 'pdf' ? '📄' : '🔗'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                    {doc.chunkCount || 0} chunks · {doc.type.toUpperCase()}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: doc.status === 'ready' ? '#dcfce7' : doc.status === 'error' ? '#fee2e2' : '#fef3c7',
                  color:      doc.status === 'ready' ? '#15803d' : doc.status === 'error' ? '#dc2626' : '#92400e',
                }}>
                  {doc.status === 'processing' ? '⟳ Processing…' : doc.status}
                </span>
                <button style={styles.btnDelete} onClick={() => deleteDoc(doc._id)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length === 0 && (
        <div style={{ ...styles.card, textAlign: 'center', padding: '40px 24px', color: '#94a3b8' }}>
          <p style={{ fontSize: 14 }}>No training data yet. Upload a PDF or add a URL above.</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  page:    { padding: 32, maxWidth: 720, margin: '0 auto', position: 'relative' },
  center:  { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#64748b' },
  back:    { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 16 },
  hdr:     { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  avatar:  { width: 44, height: 44, borderRadius: 12, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 },
  h2:      { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  card:    { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' },
  dropzone: {
    border: '2px dashed #cbd5e1', borderRadius: 12, padding: '36px 24px',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s',
  },
  input:     { padding: '10px 13px', fontSize: 13.5, border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none', fontFamily: 'inherit' },
  btnPrimary:{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnGhost:  { background: 'none', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer' },
  btnDelete: { background: '#fef2f2', border: 'none', color: '#ef4444', borderRadius: 8, padding: '6px 10px', fontSize: 14, cursor: 'pointer' },
  docRow:    { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10 },
  toast:     { position: 'fixed', top: 20, right: 24, background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 9999 },
}