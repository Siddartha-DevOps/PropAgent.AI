/**
 * widget.js — PropAgent.AI Embeddable Chat Widget
 * =================================================
 * FILE:  frontend/public/widget.js
 * EMBED: <script src="https://app.propagent.ai/widget.js" data-agent-id="BUILDER_ID"></script>
 *
 * Self-contained — zero dependencies, no React, no jQuery.
 * Works on ANY website with a single script tag.
 */

(function () {
  'use strict';

  // ── Read config from script tag ───────────────────────────────────────────
  const scriptTag = document.currentScript ||
    document.querySelector('script[data-agent-id]');

  const AGENT_ID   = scriptTag?.getAttribute('data-agent-id') || '';
  const API_BASE   = scriptTag?.getAttribute('data-api-url')  || 'https://app.propagent.ai';
  const THEME      = scriptTag?.getAttribute('data-theme')     || '#1a56db';
  const GREETING   = scriptTag?.getAttribute('data-greeting')  || 'Hi! Looking for your dream property? I can help 🏠';
  const BOT_NAME   = scriptTag?.getAttribute('data-bot-name')  || 'PropAgent';

  if (!AGENT_ID) {
    console.warn('[PropAgent] Missing data-agent-id on script tag. Widget not loaded.');
    return;
  }

  // ── Session management ────────────────────────────────────────────────────
  let SESSION_ID = sessionStorage.getItem('pa_session') || generateId();
  sessionStorage.setItem('pa_session', SESSION_ID);

  let conversationHistory = [];
  let leadCaptured = false;
  let isOpen = false;
  let isTyping = false;

  function generateId() {
    return 'pa_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const CSS = `
    #pa-widget-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #pa-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      width: 60px; height: 60px; border-radius: 50%;
      background: ${THEME}; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #pa-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,.3); }
    #pa-bubble svg { width: 28px; height: 28px; fill: #fff; }
    #pa-badge {
      position: absolute; top: -2px; right: -2px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #ef4444; color: #fff;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }
    #pa-window {
      position: fixed; bottom: 96px; right: 24px; z-index: 2147483646;
      width: 380px; max-width: calc(100vw - 32px);
      height: 580px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(20px) scale(.97); opacity: 0;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
      pointer-events: none;
    }
    #pa-window.pa-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }
    #pa-header {
      background: ${THEME}; color: #fff;
      padding: 16px 20px; display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    #pa-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    #pa-header-info { flex: 1; }
    #pa-header-name { font-weight: 700; font-size: 15px; }
    #pa-header-status { font-size: 12px; opacity: .85; margin-top: 2px; }
    #pa-close-btn {
      background: none; border: none; color: rgba(255,255,255,.8);
      cursor: pointer; padding: 4px; border-radius: 6px;
      display: flex; align-items: center; font-size: 20px; line-height: 1;
    }
    #pa-close-btn:hover { background: rgba(255,255,255,.15); color: #fff; }
    #pa-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #pa-messages::-webkit-scrollbar { width: 4px; }
    #pa-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
    .pa-msg { display: flex; gap: 8px; max-width: 88%; }
    .pa-msg.pa-user { align-self: flex-end; flex-direction: row-reverse; }
    .pa-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: ${THEME}; display: flex; align-items: center;
      justify-content: center; font-size: 14px; margin-top: 2px;
    }
    .pa-bubble-text {
      padding: 10px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.5; max-width: 100%;
    }
    .pa-msg.pa-bot .pa-bubble-text {
      background: #f3f4f6; color: #111827;
      border-bottom-left-radius: 4px;
    }
    .pa-msg.pa-user .pa-bubble-text {
      background: ${THEME}; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .pa-msg-time { font-size: 11px; color: #9ca3af; margin-top: 4px; align-self: flex-end; }
    .pa-typing { display: flex; gap: 4px; padding: 10px 14px; }
    .pa-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #9ca3af;
      animation: pa-bounce .9s infinite;
    }
    .pa-dot:nth-child(2) { animation-delay: .15s; }
    .pa-dot:nth-child(3) { animation-delay: .3s; }
    @keyframes pa-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    #pa-quick-replies {
      padding: 8px 16px 4px; display: flex; flex-wrap: wrap; gap: 8px;
    }
    .pa-qr {
      padding: 6px 14px; border-radius: 20px;
      border: 1.5px solid ${THEME}; background: #fff;
      color: ${THEME}; font-size: 13px; cursor: pointer;
      white-space: nowrap; transition: background .15s, color .15s;
    }
    .pa-qr:hover { background: ${THEME}; color: #fff; }
    #pa-input-row {
      padding: 12px 16px; border-top: 1px solid #e5e7eb;
      display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0;
    }
    #pa-input {
      flex: 1; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 14px; font-size: 14px; resize: none;
      max-height: 100px; outline: none; line-height: 1.4;
      transition: border-color .15s; font-family: inherit;
    }
    #pa-input:focus { border-color: ${THEME}; }
    #pa-input::placeholder { color: #9ca3af; }
    #pa-send {
      width: 40px; height: 40px; border-radius: 10px;
      background: ${THEME}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity .15s;
    }
    #pa-send:disabled { opacity: .5; cursor: not-allowed; }
    #pa-send svg { width: 18px; height: 18px; fill: #fff; }
    #pa-lead-form {
      padding: 16px; background: #fffbeb;
      border-top: 1px solid #fde68a;
    }
    #pa-lead-form p { margin: 0 0 10px; font-size: 13px; color: #92400e; font-weight: 600; }
    .pa-form-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
    .pa-form-input {
      border: 1.5px solid #d1d5db; border-radius: 8px;
      padding: 9px 12px; font-size: 13px; outline: none;
      transition: border-color .15s; width: 100%;
    }
    .pa-form-input:focus { border-color: ${THEME}; }
    #pa-form-submit {
      width: 100%; padding: 10px; background: ${THEME}; color: #fff;
      border: none; border-radius: 8px; font-size: 14px;
      font-weight: 700; cursor: pointer;
    }
    #pa-powered {
      text-align: center; font-size: 10px; color: #9ca3af;
      padding: 6px 0 8px; flex-shrink: 0;
    }
    #pa-powered a { color: #6b7280; text-decoration: none; }
    @media (max-width: 480px) {
      #pa-window { right: 0; bottom: 0; border-radius: 16px 16px 0 0; height: 100svh; max-height: 100svh; }
      #pa-bubble { bottom: 16px; right: 16px; }
    }
  `;

  // ── DOM builder ───────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildWidget() {
    const root = document.createElement('div');
    root.id = 'pa-widget-root';
    root.innerHTML = `
      <!-- Bubble button -->
      <button id="pa-bubble" aria-label="Open chat">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h8l-2.5-2.5C19.38 17.73 22 15 22 12 22 6.48 17.52 2 12 2zm-1 13H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V9h10v2z"/></svg>
        <span id="pa-badge" style="display:none">1</span>
      </button>

      <!-- Chat window -->
      <div id="pa-window" role="dialog" aria-label="Chat with ${BOT_NAME}">
        <div id="pa-header">
          <div id="pa-avatar">🏠</div>
          <div id="pa-header-info">
            <div id="pa-header-name">${BOT_NAME}</div>
            <div id="pa-header-status">● Online — replies instantly</div>
          </div>
          <button id="pa-close-btn" aria-label="Close chat">✕</button>
        </div>

        <div id="pa-messages" role="log" aria-live="polite"></div>

        <div id="pa-quick-replies"></div>

        <div id="pa-lead-form" style="display:none">
          <p>📋 Share your details to get personalised recommendations</p>
          <div class="pa-form-row">
            <input class="pa-form-input" id="pa-lead-name" placeholder="Your name" type="text">
            <input class="pa-form-input" id="pa-lead-phone" placeholder="Phone number" type="tel">
            <input class="pa-form-input" id="pa-lead-email" placeholder="Email (optional)" type="email">
          </div>
          <button id="pa-form-submit">Get Personalised Recommendations →</button>
        </div>

        <div id="pa-input-row">
          <textarea id="pa-input" rows="1" placeholder="Type your question..."></textarea>
          <button id="pa-send" disabled aria-label="Send">
            <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>

        <div id="pa-powered">Powered by <a href="https://propagent.ai" target="_blank">PropAgent.AI</a></div>
      </div>
    `;
    document.body.appendChild(root);
  }

  // ── Quick replies per intent stage ────────────────────────────────────────
  const QUICK_REPLIES = [
    ['2BHK options', '3BHK options', 'Price list', 'Location?'],
    ['Book site visit', 'EMI calculator', 'Talk to sales', 'More details'],
  ];

  function showQuickReplies(stage = 0) {
    const qr = document.getElementById('pa-quick-replies');
    qr.innerHTML = '';
    (QUICK_REPLIES[stage] || []).forEach((text) => {
      const btn = document.createElement('button');
      btn.className = 'pa-qr';
      btn.textContent = text;
      btn.onclick = () => sendMessage(text);
      qr.appendChild(btn);
    });
  }

  // ── Message renderer ──────────────────────────────────────────────────────
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(role, text, timestamp = new Date()) {
    const messages = document.getElementById('pa-messages');
    const wrap = document.createElement('div');
    wrap.className = `pa-msg ${role === 'user' ? 'pa-user' : 'pa-bot'}`;

    // Linkify URLs in bot messages
    const safeText = role === 'assistant'
      ? text.replace(/https?:\/\/[^\s]+/g, (url) => `<a href="${url}" target="_blank" style="color:${THEME}">${url}</a>`)
      : escapeHtml(text);

    wrap.innerHTML = `
      ${role !== 'user' ? `<div class="pa-msg-avatar">🤖</div>` : ''}
      <div>
        <div class="pa-bubble-text">${safeText}</div>
        <div class="pa-msg-time">${formatTime(timestamp)}</div>
      </div>
    `;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    return wrap;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showTyping() {
    const messages = document.getElementById('pa-messages');
    const wrap = document.createElement('div');
    wrap.className = 'pa-msg pa-bot';
    wrap.id = 'pa-typing-indicator';
    wrap.innerHTML = `<div class="pa-msg-avatar">🤖</div><div class="pa-bubble-text pa-typing"><span class="pa-dot"></span><span class="pa-dot"></span><span class="pa-dot"></span></div>`;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    isTyping = true;
  }

  function hideTyping() {
    const el = document.getElementById('pa-typing-indicator');
    if (el) el.remove();
    isTyping = false;
  }

  // ── Lead capture form ─────────────────────────────────────────────────────
  let msgCount = 0;

  function maybeShowLeadForm() {
    if (leadCaptured) return;
    if (msgCount >= 3) {
      document.getElementById('pa-lead-form').style.display = 'block';
    }
  }

  function submitLead(name, phone, email) {
    fetch(`${API_BASE}/api/chat/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        builderId: AGENT_ID,
        sessionId: SESSION_ID,
        name, phone, email,
        sourcePage: window.location.href,
      }),
    }).catch(() => {});

    leadCaptured = true;
    document.getElementById('pa-lead-form').style.display = 'none';
    appendMessage('assistant', `Thank you ${name}! 🙌 Our sales team will call you on ${phone} shortly. Meanwhile, feel free to ask me anything!`);
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function callChatAPI(userMessage) {
    const response = await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        builderId: AGENT_ID,
        sessionId: SESSION_ID,
        message: userMessage,
        conversationHistory,
        sourcePage: window.location.href,
        visitorMeta: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });

    if (!response.ok) throw new Error('API error ' + response.status);
    const data = await response.json();
    return data;
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const input = document.getElementById('pa-input');
    const sendBtn = document.getElementById('pa-send');
    const msg = (text || input.value).trim();
    if (!msg || isTyping) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    document.getElementById('pa-quick-replies').innerHTML = '';

    // Show user message
    appendMessage('user', msg);
    conversationHistory.push({ role: 'user', content: msg });
    msgCount++;

    // Show typing indicator
    showTyping();

    try {
      const data = await callChatAPI(msg);
      hideTyping();

      const reply = data.reply || "I'm sorry, I couldn't get a response. Please try again.";
      appendMessage('assistant', reply);
      conversationHistory.push({ role: 'assistant', content: reply });

      // Show stage-appropriate quick replies
      showQuickReplies(msgCount >= 3 ? 1 : 0);
      maybeShowLeadForm();

    } catch (err) {
      hideTyping();
      appendMessage('assistant', "Sorry, I'm having trouble connecting. Please try again in a moment.");
    }

    sendBtn.disabled = false;
    input.focus();
  }

  // ── Open / close ──────────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    document.getElementById('pa-window').classList.add('pa-open');
    document.getElementById('pa-badge').style.display = 'none';
    document.getElementById('pa-input').focus();

    // Send greeting on first open
    if (conversationHistory.length === 0) {
      setTimeout(() => {
        appendMessage('assistant', GREETING);
        conversationHistory.push({ role: 'assistant', content: GREETING });
        showQuickReplies(0);
      }, 400);
    }

    // Track open event
    fetch(`${API_BASE}/api/chat/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ builderId: AGENT_ID, sessionId: SESSION_ID, event: 'widget_opened', page: window.location.href }),
    }).catch(() => {});
  }

  function closeWidget() {
    isOpen = false;
    document.getElementById('pa-window').classList.remove('pa-open');
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('pa-bubble').onclick  = () => isOpen ? closeWidget() : openWidget();
    document.getElementById('pa-close-btn').onclick = closeWidget;
    document.getElementById('pa-send').onclick = () => sendMessage();

    const input = document.getElementById('pa-input');
    const sendBtn = document.getElementById('pa-send');

    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled = !this.value.trim();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.getElementById('pa-form-submit').onclick = () => {
      const name  = document.getElementById('pa-lead-name').value.trim();
      const phone = document.getElementById('pa-lead-phone').value.trim();
      const email = document.getElementById('pa-lead-email').value.trim();
      if (!name || !phone) {
        alert('Please enter your name and phone number.');
        return;
      }
      submitLead(name, phone, email);
    };

    // Auto-open after 15 seconds on page if not already opened
    setTimeout(() => {
      if (!isOpen && !sessionStorage.getItem('pa_auto_opened')) {
        document.getElementById('pa-badge').style.display = 'flex';
      }
    }, 15000);
  }

  // ── Public API (for builders who want to control programmatically) ─────────
  window.PropAgent = {
    open:  openWidget,
    close: closeWidget,
    send:  sendMessage,
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildWidget();
    bindEvents();
    console.log(`[PropAgent] Widget loaded for agent ${AGENT_ID}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
