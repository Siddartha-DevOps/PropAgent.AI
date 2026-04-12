/**
 * PropAgent.AI — Embeddable Chat Widget
 * File: backend/public/widget.js
 *
 * Usage (after your backend serves it):
 *   <script src="https://your-api.com/api/widget/BOT_MONGO_ID.js" async></script>
 *
 * Features added vs your original:
 *  ✅ Lead capture form (name + phone/email) before first answer
 *  ✅ Persists lead ID and session across page reloads
 *  ✅ Branded with bot's primary color from DB
 *  ✅ Sources widget config from /api/bots/public/:id/config
 */

;(function () {
  'use strict'

  const API_BASE = '__API_BASE__'   // injected server-side
  const BOT_ID   = '__BOT_ID__'    // injected server-side

  const SESSION_KEY = 'pa_sess_' + BOT_ID
  const LEAD_KEY    = 'pa_lead_' + BOT_ID

  let config       = null
  let sessionId    = localStorage.getItem(SESSION_KEY) || _id()
  let leadId       = localStorage.getItem(LEAD_KEY) || null
  let leadCaptured = !!leadId
  let chatHistory  = []
  let isOpen       = false

  localStorage.setItem(SESSION_KEY, sessionId)

  function _id() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  // ── 1. Load bot config then mount ──────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch(`${API_BASE}/api/bots/public/${BOT_ID}/config`)
      if (!res.ok) { console.warn('[PropAgent] bot not found'); return }
      config = await res.json()
      injectStyles(config.primaryColor || '#1a56db')
      mountToggleBtn()
    } catch (e) {
      console.warn('[PropAgent] init error', e)
    }
  }

  // ── 2. Styles ───────────────────────────────────────────────────────────────
  function injectStyles(c) {
    if (document.getElementById('pa-css')) return
    const s = document.createElement('style')
    s.id = 'pa-css'
    s.textContent = `
      #pa-root * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; padding:0; }
      #pa-btn {
        position:fixed; bottom:24px; right:24px; z-index:2147483640;
        width:56px; height:56px; border-radius:50%; border:none;
        background:${c}; color:#fff; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 20px rgba(0,0,0,.22); transition:transform .2s,box-shadow .2s;
      }
      #pa-btn:hover { transform:scale(1.08); box-shadow:0 6px 26px rgba(0,0,0,.28); }
      #pa-btn svg   { width:24px; height:24px; fill:none; stroke:#fff; stroke-width:2; }
      #pa-badge {
        position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff;
        font-size:10px; font-weight:700; width:18px; height:18px; border-radius:50%;
        display:flex; align-items:center; justify-content:center; border:2px solid #fff;
      }
      #pa-window {
        position:fixed; bottom:90px; right:24px; z-index:2147483641;
        width:370px; max-width:calc(100vw - 32px);
        height:580px; max-height:calc(100vh - 110px);
        border-radius:16px; background:#fff;
        box-shadow:0 20px 60px rgba(0,0,0,.18);
        display:flex; flex-direction:column; overflow:hidden;
        transform-origin:bottom right;
        animation:pa-pop .25s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes pa-pop { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }

      #pa-hdr {
        display:flex; align-items:center; gap:10px; padding:14px 16px;
        background:${c}; color:#fff; flex-shrink:0;
      }
      .pa-av {
        width:34px; height:34px; border-radius:50%;
        background:rgba(255,255,255,.25); display:flex;
        align-items:center; justify-content:center;
        font-weight:700; font-size:14px; flex-shrink:0;
      }
      #pa-hdr h4 { font-size:13.5px; font-weight:600; }
      #pa-hdr p  { font-size:11px; opacity:.8; margin-top:1px; }
      .pa-x {
        margin-left:auto; background:none; border:none; cursor:pointer;
        color:#fff; opacity:.75; padding:4px; display:flex;
      }
      .pa-x:hover { opacity:1; }

      #pa-msgs {
        flex:1; overflow-y:auto; padding:14px; display:flex;
        flex-direction:column; gap:10px; background:#f8fafc;
      }
      #pa-msgs::-webkit-scrollbar { width:4px; }
      #pa-msgs::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }

      .pa-row { display:flex; gap:8px; align-items:flex-end; max-width:90%; }
      .pa-row.u { margin-left:auto; flex-direction:row-reverse; }
      .pa-bubble {
        padding:9px 13px; border-radius:16px;
        font-size:13.5px; line-height:1.55; word-break:break-word;
      }
      .pa-row.b .pa-bubble {
        background:#fff; color:#1e293b;
        border-bottom-left-radius:4px;
        box-shadow:0 1px 3px rgba(0,0,0,.07);
      }
      .pa-row.u .pa-bubble {
        background:${c}; color:#fff;
        border-bottom-right-radius:4px;
      }
      .pa-ts { font-size:10px; color:#94a3b8; flex-shrink:0; margin-bottom:2px; }

      .pa-dots span {
        display:inline-block; width:7px; height:7px; border-radius:50%;
        background:#94a3b8; margin:0 2px;
        animation:pa-bounce 1.2s ease-in-out infinite;
      }
      .pa-dots span:nth-child(2){animation-delay:.2s}
      .pa-dots span:nth-child(3){animation-delay:.4s}
      @keyframes pa-bounce{0%,80%,100%{transform:scale(.7);opacity:.5}40%{transform:scale(1);opacity:1}}

      #pa-foot { padding:10px 12px; border-top:1px solid #e2e8f0; background:#fff; flex-shrink:0; }
      #pa-form { display:flex; gap:8px; align-items:flex-end; }
      #pa-inp {
        flex:1; padding:9px 13px; font-size:13.5px;
        border:1.5px solid #e2e8f0; border-radius:22px;
        outline:none; resize:none; max-height:80px; line-height:1.4;
        transition:border-color .15s;
      }
      #pa-inp:focus { border-color:${c}; }
      #pa-send {
        width:38px; height:38px; border-radius:50%; border:none;
        background:${c}; cursor:pointer; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        transition:transform .15s; flex-shrink:0;
      }
      #pa-send:hover  { transform:scale(1.1); }
      #pa-send:disabled { opacity:.45; cursor:default; }
      #pa-send svg { width:15px; height:15px; fill:#fff; }

      /* Lead capture form */
      #pa-lf {
        padding:18px 16px; display:flex; flex-direction:column; gap:10px;
        background:#fff;
      }
      #pa-lf h4 { font-size:14.5px; font-weight:600; color:#1e293b; }
      #pa-lf p  { font-size:12px; color:#64748b; line-height:1.4; }
      .pa-fi {
        width:100%; padding:10px 13px; font-size:13.5px;
        border:1.5px solid #e2e8f0; border-radius:10px;
        outline:none; transition:border-color .15s; color:#1e293b;
      }
      .pa-fi:focus { border-color:${c}; }
      #pa-lf-btn {
        width:100%; padding:11px; border-radius:10px; border:none;
        background:${c}; color:#fff; font-size:14px; font-weight:600;
        cursor:pointer; transition:opacity .15s;
      }
      #pa-lf-btn:hover { opacity:.9; }
      #pa-skip {
        text-align:center; font-size:12px; color:#94a3b8;
        cursor:pointer; margin-top:-4px;
      }
      #pa-skip:hover { color:#64748b; text-decoration:underline; }
      #pa-err { color:#ef4444; font-size:12px; min-height:14px; }
    `
    document.head.appendChild(s)
  }

  // ── 3. Toggle button ────────────────────────────────────────────────────────
  function mountToggleBtn() {
    const root = document.createElement('div')
    root.id = 'pa-root'
    root.innerHTML = `
      <button id="pa-btn" title="Chat with us">
        ${iconChat()}
        <span id="pa-badge" style="display:none">1</span>
      </button>`
    document.body.appendChild(root)
    document.getElementById('pa-btn').addEventListener('click', toggle)
    // Show unread badge after 5 s
    setTimeout(() => {
      const b = document.getElementById('pa-badge')
      if (b && !isOpen) b.style.display = 'flex'
    }, 5000)
  }

  function toggle() { isOpen ? close() : open() }

  // ── 4. Open chat window ─────────────────────────────────────────────────────
  function open() {
    isOpen = true
    const btn = document.getElementById('pa-badge')
    if (btn) btn.style.display = 'none'
    setBtnIcon(iconX())

    const win = document.createElement('div')
    win.id = 'pa-window'
    win.innerHTML = `
      <div id="pa-hdr">
        <div class="pa-av">${(config.name||'B')[0].toUpperCase()}</div>
        <div>
          <h4>${esc(config.name)}</h4>
          <p>● Typically replies instantly</p>
        </div>
        <button class="pa-x" id="pa-close">${iconX()}</button>
      </div>
      <div id="pa-msgs"></div>
      <div id="pa-foot">
        ${config.captureLeads && !leadCaptured ? buildLeadForm() : buildInputForm()}
      </div>`
    document.getElementById('pa-root').appendChild(win)
    document.getElementById('pa-close').addEventListener('click', close)

    // Render existing history or welcome message
    if (chatHistory.length === 0) {
      appendBot(config.welcomeMessage || 'Hi! How can I help you?')
    } else {
      chatHistory.forEach(m => m.role === 'user' ? appendUserUI(m.content) : appendBotUI(m.content))
    }

    if (config.captureLeads && !leadCaptured) wireLeadForm()
    else wireInputForm()
  }

  // ── 5. Close ────────────────────────────────────────────────────────────────
  function close() {
    isOpen = false
    setBtnIcon(iconChat())
    const w = document.getElementById('pa-window')
    if (w) w.remove()
  }

  // ── 6. Lead form ────────────────────────────────────────────────────────────
  function buildLeadForm() {
    const phoneReq = config.requirePhone
    return `
      <div id="pa-lf">
        <h4>${esc(config.leadFormTitle || 'Get More Details')}</h4>
        <p>Share your details to continue the conversation.</p>
        <input id="pa-fn" class="pa-fi" type="text"  placeholder="Your name *" autocomplete="name"/>
        <input id="pa-fp" class="pa-fi" type="tel"   placeholder="Phone number${phoneReq ? ' *' : ' (optional)'}"/>
        <input id="pa-fe" class="pa-fi" type="email" placeholder="Email (optional)"/>
        <p id="pa-err"></p>
        <button id="pa-lf-btn">Continue chatting →</button>
        <p id="pa-skip">Skip for now</p>
      </div>`
  }

  function wireLeadForm() {
    document.getElementById('pa-lf-btn').addEventListener('click', submitLead)
    document.getElementById('pa-skip').addEventListener('click', skipLead)
  }

  async function submitLead() {
    const name  = (document.getElementById('pa-fn')?.value || '').trim()
    const phone = (document.getElementById('pa-fp')?.value || '').trim()
    const email = (document.getElementById('pa-fe')?.value || '').trim()
    const errEl = document.getElementById('pa-err')

    if (!name)  { errEl.textContent = 'Please enter your name.'; return }
    if (config.requirePhone && !phone) { errEl.textContent = 'Phone number is required.'; return }
    errEl.textContent = ''

    document.getElementById('pa-lf-btn').disabled = true
    document.getElementById('pa-lf-btn').textContent = 'Saving...'

    try {
      const firstMsg = chatHistory.find(m => m.role === 'user')?.content || ''
      const res = await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: BOT_ID,
          name, phone, email,
          firstMessage: firstMsg,
          sourcePage:   window.location.href,
          sessionId,
        }),
      })
      const data = await res.json()
      if (data.leadId) {
        leadId = data.leadId
        localStorage.setItem(LEAD_KEY, leadId)
      }
    } catch (_) { /* proceed even on error */ }

    leadCaptured = true
    activateChat()
  }

  function skipLead() {
    leadCaptured = true
    activateChat()
  }

  function activateChat() {
    const foot = document.getElementById('pa-foot')
    if (foot) { foot.innerHTML = buildInputForm(); wireInputForm() }
  }

  // ── 7. Input form ───────────────────────────────────────────────────────────
  function buildInputForm() {
    return `
      <div id="pa-form">
        <textarea id="pa-inp" rows="1" placeholder="${esc(config.placeholder || 'Ask me anything...')}"></textarea>
        <button id="pa-send" title="Send">${iconSend()}</button>
      </div>`
  }

  function wireInputForm() {
    const inp  = document.getElementById('pa-inp')
    const send = document.getElementById('pa-send')
    if (!inp || !send) return

    inp.addEventListener('input', () => {
      inp.style.height = 'auto'
      inp.style.height = Math.min(inp.scrollHeight, 80) + 'px'
    })
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
    })
    send.addEventListener('click', sendMsg)
    inp.focus()
  }

  // ── 8. Send message ─────────────────────────────────────────────────────────
  async function sendMsg() {
    const inp  = document.getElementById('pa-inp')
    const send = document.getElementById('pa-send')
    if (!inp) return
    const text = inp.value.trim()
    if (!text) return

    inp.value = ''; inp.style.height = 'auto'
    send.disabled = true

    appendUserUI(text)
    chatHistory.push({ role: 'user', content: text })
    showTyping()

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId:     BOT_ID,
          sessionId,
          message:   text,
          history:   chatHistory.slice(-8),
          leadId:    leadId || undefined,
        }),
      })
      const data = await res.json()
      hideTyping()
      const answer = data.answer || data.response || data.message || "I couldn't get a response, please try again."
      appendBot(answer)
    } catch {
      hideTyping()
      appendBot("Sorry, I'm having trouble connecting. Please try again.")
    }

    if (send) send.disabled = false
    document.getElementById('pa-inp')?.focus()
  }

  // ── 9. UI helpers ───────────────────────────────────────────────────────────
  function appendBotUI(text) {
    const msgs = document.getElementById('pa-msgs')
    if (!msgs) return
    const d = document.createElement('div')
    d.className = 'pa-row b'
    d.innerHTML = `<div class="pa-bubble">${text.replace(/\n/g,'<br>')}</div><span class="pa-ts">${ts()}</span>`
    msgs.appendChild(d)
    msgs.scrollTop = msgs.scrollHeight
  }

  function appendBot(text) {
    appendBotUI(text)
    chatHistory.push({ role: 'assistant', content: text })
  }

  function appendUserUI(text) {
    const msgs = document.getElementById('pa-msgs')
    if (!msgs) return
    const d = document.createElement('div')
    d.className = 'pa-row u'
    d.innerHTML = `<div class="pa-bubble">${esc(text)}</div><span class="pa-ts">${ts()}</span>`
    msgs.appendChild(d)
    msgs.scrollTop = msgs.scrollHeight
  }

  function showTyping() {
    const msgs = document.getElementById('pa-msgs')
    if (!msgs) return
    const d = document.createElement('div')
    d.className = 'pa-row b'; d.id = 'pa-typing'
    d.innerHTML = `<div class="pa-bubble pa-dots"><span></span><span></span><span></span></div>`
    msgs.appendChild(d)
    msgs.scrollTop = msgs.scrollHeight
  }

  function hideTyping() {
    document.getElementById('pa-typing')?.remove()
  }

  function setBtnIcon(svg) {
    const btn = document.getElementById('pa-btn')
    if (btn) btn.innerHTML = svg + '<span id="pa-badge" style="display:none">1</span>'
  }

  function ts() {
    return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  // ── SVG icons ───────────────────────────────────────────────────────────────
  function iconChat() {
    return `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  }
  function iconX() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  }
  function iconSend() {
    return `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()