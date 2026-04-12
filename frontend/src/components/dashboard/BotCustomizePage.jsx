import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function BotCustomizePage({ botId, token, onBack }) {
  const [bot, setBot]       = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({
    name: '', description: '', primaryColor: '#1a56db',
    welcomeMessage: '', placeholder: '', systemPrompt: '',
    captureLeads: true, leadFormTitle: 'Get More Details', requirePhone: true,
  });

  useEffect(() => {
    if (!botId) return;
    axios.get(`${API}/bots/${botId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setBot(r.data); setForm(f => ({ ...f, ...r.data })); })
      .catch(() => setError('Failed to load bot'));
  }, [botId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true); setSaved(false); setError('');
    try {
      await axios.patch(`${API}/bots/${botId}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  }

  if (!bot) return (
    <div style={styles.center}>
      {error ? <p style={{ color: '#ef4444' }}>{error}</p> : <p style={{ color: '#64748b' }}>Loading...</p>}
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h2 style={styles.title}>Customize bot</h2>
        <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {error && <div style={styles.errBanner}>{error}</div>}

      <div style={styles.grid}>
        {/* Left column — settings */}
        <div style={styles.col}>
          <Section title="Basic info">
            <Field label="Bot name">
              <input style={styles.input} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="My Property Bot" />
            </Field>
            <Field label="Description">
              <input style={styles.input} value={form.description}
                onChange={e => set('description', e.target.value)} placeholder="What does this bot do?" />
            </Field>
            <Field label="Brand color">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={form.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)}
                  style={{ width: 44, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                <input style={{ ...styles.input, flex: 1 }} value={form.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)} />
              </div>
            </Field>
          </Section>

          <Section title="Chat messages">
            <Field label="Welcome message">
              <textarea style={styles.textarea} value={form.welcomeMessage}
                onChange={e => set('welcomeMessage', e.target.value)}
                placeholder="Hi! I'm your real estate assistant..." rows={3} />
            </Field>
            <Field label="Input placeholder">
              <input style={styles.input} value={form.placeholder}
                onChange={e => set('placeholder', e.target.value)}
                placeholder="Ask about pricing, availability..." />
            </Field>
            <Field label="System prompt (AI instructions)">
              <textarea style={styles.textarea} value={form.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                placeholder="You are a helpful real estate assistant for [Company]. Always be professional..." rows={5} />
            </Field>
          </Section>

          <Section title="Lead capture">
            <Field label="">
              <label style={styles.toggle}>
                <input type="checkbox" checked={form.captureLeads}
                  onChange={e => set('captureLeads', e.target.checked)} />
                <span>Capture visitor details before chatting</span>
              </label>
            </Field>
            {form.captureLeads && <>
              <Field label="Lead form title">
                <input style={styles.input} value={form.leadFormTitle}
                  onChange={e => set('leadFormTitle', e.target.value)} />
              </Field>
              <Field label="">
                <label style={styles.toggle}>
                  <input type="checkbox" checked={form.requirePhone}
                    onChange={e => set('requirePhone', e.target.checked)} />
                  <span>Require phone number</span>
                </label>
              </Field>
            </>}
          </Section>
        </div>

        {/* Right column — live preview */}
        <div style={styles.col}>
          <Section title="Live preview">
            <ChatPreview config={form} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function ChatPreview({ config }) {
  const c = config.primaryColor || '#1a56db';
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', maxWidth: 340 }}>
      <div style={{ background: c, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          {(config.name || 'B')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{config.name || 'My Bot'}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>● Typically replies instantly</div>
        </div>
      </div>
      <div style={{ background: '#f8fafc', padding: 14, minHeight: 120 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '9px 13px', fontSize: 13.5, color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,.07)', maxWidth: '85%' }}>
          {config.welcomeMessage || 'Hi! How can I help you today?'}
        </div>
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, border: `1.5px solid ${c}`, borderRadius: 22, padding: '8px 13px', fontSize: 13, color: '#94a3b8' }}>
          {config.placeholder || 'Ask me anything...'}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      {label && <label style={{ fontSize: 13, color: '#475569', display: 'block', marginBottom: 5 }}>{label}</label>}
      {children}
    </div>
  );
}

const styles = {
  page:    { padding: '24px', fontFamily: "'Outfit', sans-serif", maxWidth: 1100, margin: '0 auto' },
  header:  { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  title:   { fontSize: 20, fontWeight: 600, color: '#1e293b', flex: 1 },
  backBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#475569' },
  saveBtn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 },
  col:     { display: 'flex', flexDirection: 'column' },
  input:   { width: '100%', padding: '9px 13px', fontSize: 13.5, border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none', boxSizing: 'border-box', color: '#1e293b' },
  textarea:{ width: '100%', padding: '9px 13px', fontSize: 13.5, border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none', boxSizing: 'border-box', color: '#1e293b', resize: 'vertical', fontFamily: 'inherit' },
  toggle:  { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, color: '#1e293b' },
  errBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 },
  center:  { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 },
};