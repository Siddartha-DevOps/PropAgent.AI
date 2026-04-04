import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const CFG = {
  hot:  { color: '#FF5757', bg: 'rgba(255,87,87,0.09)',   label: '🔴 Hot Lead',  border: 'rgba(255,87,87,0.25)' },
  warm: { color: '#E07A00', bg: 'rgba(224,122,0,0.09)',  label: '🟡 Warm Lead', border: 'rgba(224,122,0,0.25)' },
  cold: { color: '#2A6DD4', bg: 'rgba(42,109,212,0.09)', label: '🔵 Cold Lead', border: 'rgba(42,109,212,0.25)' }
};

// FIX: Hardcoded greeting — shown instantly, no API call needed for first message
const GREETING = "Hi! I'm PropAgent.AI, your intelligent property advisor. 👋\n\nI'll help you find the perfect home by understanding your needs. What kind of property are you looking for today?";

export default function ChatWidget({ onBack }) {
  const [sessionId, setSessionId]         = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [intentScore, setIntentScore]     = useState(0);
  const [classification, setClassification] = useState('cold');
  const [signals, setSignals]             = useState([]);
  const [showPanel, setShowPanel]         = useState(true);
  const [apiError, setApiError]           = useState(null);
  const [sessionReady, setSessionReady]   = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // On mount: show greeting immediately, then start session in background
  useEffect(() => {
    // FIX: Show greeting right away without any API call
    addMsg('assistant', GREETING);
    // Start session in background
    startSession();
  }, []);

  async function startSession() {
    try {
      const res = await fetch(`${API_BASE}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessionId(data.sessionId);
      setSessionReady(true);
    } catch (err) {
      console.error('Session start failed:', err.message);
      setApiError('Cannot connect to backend. Make sure `cd backend && npm start` is running on port 3001.');
      setSessionReady(false);
    }
  }

  function addMsg(role, content) {
    // FIX: Guard against undefined/null content
    const safeContent = (content && typeof content === 'string' && content.trim())
      ? content.trim()
      : null;
    if (!safeContent) return;
    setMessages(prev => [...prev, { role, content: safeContent, time: new Date() }]);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // FIX: If session not ready, show error inline instead of silently failing
    if (!sessionId) {
      setApiError('Connecting to server... please wait a moment and try again.');
      return;
    }

    setInput('');
    setApiError(null);
    addMsg('user', text);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text })
      });

      const data = await res.json();

      // FIX: Handle both success and error responses — always show a message
      if (data.message && typeof data.message === 'string') {
        addMsg('assistant', data.message);
        if (typeof data.intentScore === 'number') setIntentScore(data.intentScore);
        if (data.classification) setClassification(data.classification);
        if (Array.isArray(data.signals)) setSignals(data.signals);
      } else if (data.error) {
        addMsg('assistant', data.message || 'Something went wrong. Please try again.');
        if (data.error === 'ANTHROPIC_API_KEY not configured') {
          setApiError('⚠️ API key missing. Add ANTHROPIC_API_KEY to backend/.env and restart the server.');
        }
      } else {
        addMsg('assistant', 'I had trouble understanding that. Could you rephrase?');
      }

    } catch (err) {
      console.error('Send failed:', err.message);
      addMsg('assistant', 'Connection lost. Please check the backend is running and try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const cfg = CFG[classification] || CFG.cold;

  const SIGNAL_META = [
    { key: 'budget_defined',   label: 'Budget defined',      icon: '💰', pts: 20 },
    { key: 'location_defined', label: 'Location specified',  icon: '📍', pts: 15 },
    { key: 'property_type',    label: 'Property type known', icon: '🏠', pts: 10 },
    { key: 'timeline_urgent',  label: 'Urgent timeline',     icon: '⏰', pts: 25 },
    { key: 'financing_ready',  label: 'Financing sorted',    icon: '🏦', pts: 20 },
    { key: 'contact_shared',   label: 'Contact shared',      icon: '📱', pts: 10 },
  ];

  return (
    <div style={{ height: '100vh', background: '#FAF8F3', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.12)', color: '#4A4A5A', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >← Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#B8952A,#F0CC6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>P</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>PropAgent.AI</div>
              <div style={{ fontSize: 11, color: '#2AAD6A', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2AAD6A', display: 'inline-block' }} />
                {sessionReady ? 'Connected' : 'Connecting...'}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowPanel(p => !p)}
          style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.10)', color: '#4A4A5A', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
        >{showPanel ? 'Hide' : 'Show'} Score Panel</button>
      </div>

      {/* DEMO BANNER */}
      <div style={{ flexShrink: 0, margin: '8px 16px 0', padding: '7px 16px', borderRadius: 9, background: 'rgba(184,149,42,0.08)', border: '1px solid rgba(184,149,42,0.2)', fontSize: 12, color: '#B8952A', textAlign: 'center' }}>
        🎯 Demo Mode — Chat as a buyer. Watch the intent score panel update live as you chat.
      </div>

      {/* API ERROR BANNER */}
      {apiError && (
        <div style={{ flexShrink: 0, margin: '6px 16px 0', padding: '8px 16px', borderRadius: 9, background: 'rgba(255,87,87,0.08)', border: '1px solid rgba(255,87,87,0.25)', fontSize: 12, color: '#CC3333' }}>
          ⚠️ {apiError}
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* MESSAGES */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#B8952A,#F0CC6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>P</div>
                )}
                <div style={{
                  maxWidth: '70%', padding: '11px 15px',
                  borderRadius: m.role === 'user' ? '16px 16px 3px 16px' : '3px 16px 16px 16px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#B8952A,#F0CC6A)' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1A1A22',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.content}
                  <div style={{ fontSize: 10, color: m.role === 'user' ? 'rgba(255,255,255,0.55)' : '#9A9A9A', marginTop: 4, textAlign: 'right' }}>
                    {m.time?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* TYPING INDICATOR */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#B8952A,#F0CC6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>P</div>
                <div style={{ padding: '12px 16px', borderRadius: '3px 16px 16px 16px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#B8952A', animation: `bounce 1.2s ease ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }`}</style>
            <div ref={endRef} />
          </div>

          {/* INPUT BAR */}
          <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={sessionReady ? 'Type your message and press Enter...' : 'Connecting to server...'}
              disabled={loading || !sessionReady}
              style={{ flex: 1, padding: '11px 16px', borderRadius: 24, background: '#F5F4F0', border: '1.5px solid rgba(0,0,0,0.10)', color: '#1A1A22', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#B8952A'}
              onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.10)'}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading || !sessionReady}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: (input.trim() && !loading && sessionReady) ? 'linear-gradient(135deg,#B8952A,#F0CC6A)' : '#ECEAE3',
                color: (input.trim() && !loading && sessionReady) ? '#fff' : '#9A9A9A',
                cursor: (input.trim() && !loading && sessionReady) ? 'pointer' : 'not-allowed',
                fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}
            >↑</button>
          </div>
        </div>

        {/* SCORE PANEL */}
        {showPanel && (
          <div style={{ width: 272, background: '#fff', borderLeft: '1px solid rgba(0,0,0,0.08)', padding: '18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>

            <div style={{ fontSize: 11, color: '#7A7A8A', letterSpacing: '0.8px', textTransform: 'uppercase' }}>🧠 Live Intent Score</div>

            {/* SCORE DIAL */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%', margin: '0 auto 14px',
                background: `conic-gradient(${cfg.color} ${intentScore * 3.6}deg, #ECEAE3 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.8s ease'
              }}>
                <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: cfg.color, lineHeight: 1, fontWeight: 800 }}>{intentScore}</span>
                  <span style={{ fontSize: 9, color: '#9A9A9A' }}>/100</span>
                </div>
              </div>
              <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: 12, fontWeight: 600 }}>{cfg.label}</div>
            </div>

            {/* SCORE BAR */}
            <div style={{ background: '#F0EEE8', borderRadius: 4, height: 5 }}>
              <div style={{ height: '100%', width: `${intentScore}%`, borderRadius: 4, background: `linear-gradient(90deg, #2A6DD4, ${cfg.color})`, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>

            {/* SIGNALS */}
            <div>
              <div style={{ fontSize: 11, color: '#7A7A8A', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Signals</div>
              {SIGNAL_META.map(sig => {
                const fired = signals.find(s => s.key === sig.key);
                return (
                  <div key={sig.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 9px', borderRadius: 8, marginBottom: 3,
                    background: fired?.fired ? 'rgba(42,173,106,0.07)' : '#F5F4F0',
                    border: `1px solid ${fired?.fired ? 'rgba(42,173,106,0.2)' : 'transparent'}`,
                    transition: 'all 0.35s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 13 }}>{sig.icon}</span>
                      <span style={{ fontSize: 11, color: fired?.fired ? '#1A1A22' : '#7A7A8A' }}>{sig.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: fired?.fired ? '#2AAD6A' : '#9A9A9A' }}>
                      {fired?.fired ? `+${fired.points}` : `+${sig.pts}`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 10, borderRadius: 9, background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.07)', fontSize: 11, color: '#4A4A5A', lineHeight: 1.7 }}>
              💡 Score <strong>70+</strong> = Hot lead. Your sales team gets notified instantly.
            </div>

            <div style={{ padding: 10, borderRadius: 9, background: 'rgba(184,149,42,0.06)', border: '1px solid rgba(184,149,42,0.15)', fontSize: 11, color: '#7A7A8A', lineHeight: 1.7 }}>
              <strong style={{ color: '#B8952A' }}>How it works:</strong> Each answer you give unlocks a signal. The AI extracts data silently — no forms needed.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}