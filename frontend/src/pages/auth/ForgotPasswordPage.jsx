// frontend/src/pages/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthService from '../../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await AuthService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div style={pg.page}>
      <div style={pg.card}>
        <Link to="/auth/login" style={pg.back}>← Back to sign in</Link>
        <h1 style={pg.heading}>Reset your password</h1>

        {sent ? (
          <div style={pg.successBox}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📧</div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              If an account with <strong>{email}</strong> exists, a reset link has been sent. Check your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div style={pg.errorBanner}>{error}</div>}
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Enter your email and we'll send a reset link.
            </p>
            <label style={pg.label}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={pg.input} />
            <button type="submit" disabled={loading} style={{ ...pg.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Reset Password Page ────────────────────────────────────────────────────────
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function ResetPasswordPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const token = params.get('token') || '';

  const [form, setForm]   = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setLoading(true);
    try {
      await AuthService.resetPassword(token, form.password);
      navigate('/auth/login?reset=success', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  }

  return (
    <div style={pg.page}>
      <div style={pg.card}>
        <h1 style={pg.heading}>Set new password</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={pg.errorBanner}>{error}</div>}
          {!token && <div style={pg.errorBanner}>Invalid reset link. Please request a new one.</div>}

          <label style={pg.label}>New password</label>
          <input type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" style={pg.input} />

          <label style={{ ...pg.label, marginTop: 8 }}>Confirm password</label>
          <input type="password" required value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repeat password" style={pg.input} />

          <button type="submit" disabled={loading || !token} style={{ ...pg.btn, opacity: (loading || !token) ? 0.7 : 1, marginTop: 8 }}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

const pg = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary)', padding: '24px 16px' },
  card: { background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400 },
  heading: { margin: '0 0 20px', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' },
  back: { display: 'inline-block', marginBottom: 20, fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' },
  input: { padding: '10px 13px', border: '1.5px solid var(--color-border-tertiary)', borderRadius: 10, fontSize: 14, color: 'var(--color-text-primary)', background: 'var(--color-background-secondary)', outline: 'none' },
  btn: { padding: '12px', borderRadius: 10, border: 'none', background: '#1a56db', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  errorBanner: { padding: '10px 13px', borderRadius: 8, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', fontSize: 13, border: '1px solid var(--color-border-danger)' },
  successBox: { padding: '20px', borderRadius: 10, background: 'var(--color-background-success)', border: '1px solid var(--color-border-success)', textAlign: 'center' },
};