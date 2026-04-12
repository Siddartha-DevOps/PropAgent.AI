import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export default function TrainPage() {
  const { botId }  = useParams()
  const navigate   = useNavigate()
  const fileRef    = useRef()
  const [bot, setBot]             = useState(null)
  const [docs, setDocs]           = useState([])
  const [urlInput, setUrlInput]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [urlLoading, setUrlLoading] = useState(false)
  const [toast, setToast]         = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const token = localStorage.getItem('token')
    const hdrs  = { Authorization: `Bearer ${token}` }
    try {
      const [b, d] = await Promise.all([
        axios.get(`${API}/api/bots/${botId}`,               { headers: hdrs }),
        axios.get(`${API}/api/training/${botId}/documents`, { headers: hdrs }),
      ])
      setBot(b.data); setDocs(d.data)
    } catch (e) { console.error(e) }
  }, [botId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!docs.some(d => d.status === 'processing')) return
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
      setUrlInput(''); load()
    } catch { showToast('Failed to add URL') }
    setUrlLoading(false)
  }

  async function deleteDoc(docId) {
    if (!window.confirm('Remove this document?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API}/api/training/${botId}/documents/${docId}`,
        { headers: { Authorization: `Bearer ${token}` } })
      setDocs(prev => prev.filter(d => d._id !== docId))
    } catch { showToast('Delete failed') }
  }

  if (!bot) return <div style={S.center}>Loading…</div>

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.hdr}>
        <div style={{ ...S.avatar, background: bot.primaryColor||'#1a56db' }}>
          {(bot.name||'B')[0]}
        </div>
        <div>
          <h2 style={S.h2}>{bot.name}</h2>
          <span style={{ fontSize:12, padding:'2px 8px', borderRadius:20, fontWeight:600,
            color: bot.status==='ready' ? '#15803d':'#92400e',
            background: bot.status==='ready' ? '#dcfce7':'#fef3c7' }}>
            {bot.status==='ready' ? '● Live':'⟳ Training'}
          </span>
        </div>
        <button style={{ marginLeft:'auto', ...S.btnGhost }}
          onClick={() => navigate(`/dashboard/bots/${botId}/embed`)}>⟨/⟩ Embed →</button>
      </div>

      {/* PDF Upload */}
      <div style={S.card}>
        <h3 style={S.ct}>📄 Upload PDF</h3>
        <div style={S.dropzone}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); uploadPDF(e.dataTransfer.files[0]) }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📥</div>
          <p style={{ fontWeight:600, color:'#334155', margin:0 }}>Drop PDF here or click to upload</p>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Brochures, pricing sheets, floor plans, RERA docs</p>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }}
          onChange={e => uploadPDF(e.target.files[0])} />
        {uploading && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginBottom:4 }}>
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div style={{ height:6, background:'#e2e8f0', borderRadius:4 }}>
              <div style={{ height:6, background:'#1a56db', borderRadius:4, width:`${progress}%`, transition:'width .2s' }} />
            </div>
          </div>
        )}
      </div>

      {/* URL */}
      <div style={S.card}>
        <h3 style={S.ct}>🔗 Add Website URL</h3>
        <div style={{ display:'flex', gap:10 }}>
          <input style={{ ...S.input, flex:1 }} placeholder="https://yourproject.com"
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addURL()} />
          <button style={S.btnPrimary} onClick={addURL} disabled={urlLoading}>
            {urlLoading ? '…':'Add'}
          </button>
        </div>
      </div>

      {/* Docs list */}
      {docs.length > 0 && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ ...S.ct, margin:0 }}>Training Data ({docs.length})</h3>
            <button style={S.btnGhost} onClick={load}>↻ Refresh</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {docs.map(doc => (
              <div key={doc._id} style={S.docRow}>
                <div style={{ fontSize:20 }}>{doc.type==='pdf' ? '📄':'🔗'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:13, color:'#0f172a', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</p>
                  <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>{doc.chunkCount||0} chunks · {doc.type.toUpperCase()}</p>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                  background: doc.status==='ready' ? '#dcfce7': doc.status==='error' ? '#fee2e2':'#fef3c7',
                  color:      doc.status==='ready' ? '#15803d': doc.status==='error' ? '#dc2626':'#92400e' }}>
                  {doc.status==='processing' ? '⟳ Processing…':doc.status}
                </span>
                <button style={{ background:'#fef2f2', border:'none', color:'#ef4444', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}
                  onClick={() => deleteDoc(doc._id)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page:    { padding:32, maxWidth:720, margin:'0 auto', position:'relative' },
  center:  { display:'flex', justifyContent:'center', alignItems:'center', height:300 },
  hdr:     { display:'flex', alignItems:'center', gap:14, marginBottom:24 },
  avatar:  { width:44, height:44, borderRadius:12, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, flexShrink:0 },
  h2:      { fontSize:20, fontWeight:700, color:'#0f172a', margin:'0 0 4px' },
  card:    { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:24, marginBottom:16 },
  ct:      { fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 16px' },
  dropzone:{ border:'2px dashed #cbd5e1', borderRadius:12, padding:'36px 24px', textAlign:'center', cursor:'pointer', transition:'border-color .15s' },
  input:   { padding:'10px 13px', fontSize:13.5, border:'1.5px solid #e2e8f0', borderRadius:10, outline:'none', fontFamily:'inherit' },
  btnPrimary: { background:'#1a56db', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
  btnGhost:{ background:'none', border:'1px solid #e2e8f0', color:'#64748b', borderRadius:8, padding:'5px 12px', fontSize:13, cursor:'pointer' },
  docRow:  { display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f8fafc', borderRadius:10 },
  toast:   { position:'fixed', top:20, right:24, background:'#0f172a', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:13, fontWeight:500, zIndex:9999 },
}