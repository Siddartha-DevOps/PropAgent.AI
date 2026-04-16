import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAccessToken } from '../../services/api';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ConversationHistoryPage({ botId, token, onBack }) {
  const [sessions, setSessions]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError]         = useState('');
  

  useEffect(() => {
    fetchSessions();
  }, [botId]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/analytics/sessions?botId=${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(r.data.sessions || r.data || []);
    } catch {
      // Fallback: fetch from leads since sessions might not exist yet
      try {
        const r = await axios.get(`${API}/leads?botId=${botId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSessions((r.data.leads || r.data || []).map(l => ({
          _id: l._id, sessionId: l.sessionId,
          visitorName: l.name || 'Anonymous',
          messageCount: 1, createdAt: l.createdAt,
          sourcePage: l.sourcePage,
        })));
      } catch { setError('Could not load conversations'); }
    }
    setLoading(false);
  }

  async function fetchMessages(sessionId) {
    setLoadingMsgs(true); setMessages([]);
    try {
      const r = await axios.get(`${API}/analytics/messages?sessionId=${sessionId}&botId=${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(r.data.messages || r.data || []);
    } catch {
      setMessages([{ role: 'system', content: 'Message history not available yet for this session.' }]);
    }
    setLoadingMsgs(false);
  }

  function selectSession(s) {
    setSelected(s);
    fetchMessages(s.sessionId || s._id);
  }

  function fmt(d) {
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h2 style={styles.title}>Conversation history</h2>
        <span style={styles.count}>{sessions.length} sessions</span>
      </div>

      {error && <div style={styles.errBanner}>{error}</div>}

      <div style={styles.layout}>
        {/* Session list */}
        <div style={styles.sidebar}>
          {loading && <p style={styles.muted}>Loading sessions...</p>}
          {!loading && sessions.length === 0 && (
            <p style={styles.muted}>No conversations yet. Share your embed code to start getting chats.</p>
          )}
          {sessions.map(s => (
            <div key={s._id} onClick={() => selectSession(s)}
              style={{ ...styles.sessionCard, ...(selected?._id === s._id ? styles.sessionActive : {}) }}>
              <div style={styles.sessionName}>{s.visitorName || 'Anonymous visitor'}</div>
              <div style={styles.sessionMeta}>
                {s.messageCount || 0} messages · {fmt(s.createdAt)}
              </div>
              {s.sourcePage && (
                <div style={styles.sessionPage} title={s.sourcePage}>
                  {s.sourcePage.replace(/^https?:\/\//, '').slice(0, 40)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Message thread */}
        <div style={styles.thread}>
          {!selected && (
            <div style={styles.emptyThread}>
              <div style={styles.emptyIcon}>💬</div>
              <p style={styles.muted}>Select a conversation to view messages</p>
            </div>
          )}
          {selected && (
            <>
              <div style={styles.threadHeader}>
                <div style={styles.sessionName}>{selected.visitorName || 'Anonymous'}</div>
                <div style={styles.sessionMeta}>{fmt(selected.createdAt)}</div>
              </div>
              <div style={styles.messages}>
                {loadingMsgs && <p style={styles.muted}>Loading messages...</p>}
                {messages.map((m, i) => (
                  <div key={i} style={{ ...styles.msgRow, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      ...styles.bubble,
                      background: m.role === 'user' ? '#1a56db' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1e293b',
                      borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                      borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:        { padding: 24, fontFamily: "'Outfit', sans-serif", maxWidth: 1100, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  title:       { fontSize: 20, fontWeight: 600, color: '#1e293b', flex: 1 },
  count:       { fontSize: 13, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 20 },
  backBtn:     { background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#475569' },
  layout:      { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, flex: 1, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  sidebar:     { borderRight: '1px solid #e2e8f0', overflowY: 'auto', background: '#f8fafc' },
  sessionCard: { padding: '14px 16px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' },
  sessionActive:{ background: '#eff6ff', borderRight: '3px solid #1a56db' },
  sessionName: { fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 3 },
  sessionMeta: { fontSize: 12, color: '#94a3b8' },
  sessionPage: { fontSize: 11, color: '#cbd5e1', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  thread:      { display: 'flex', flexDirection: 'column', background: '#fff' },
  threadHeader:{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' },
  messages:    { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' },
  msgRow:      { display: 'flex' },
  bubble:      { maxWidth: '70%', padding: '9px 14px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.55, boxShadow: '0 1px 3px rgba(0,0,0,.06)' },
  emptyThread: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon:   { fontSize: 40 },
  muted:       { color: '#94a3b8', fontSize: 13, padding: '16px', textAlign: 'center' },
  errBanner:   { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 },
};