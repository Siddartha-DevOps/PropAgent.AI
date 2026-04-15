// frontend/src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const [form, setForm]   = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      navigate(data.nextStep === 'onboarding' ? '/onboarding' : redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    setGoogleLoading(true);
    loginWithGoogle(); // browser redirect — no need to reset state
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoDot} />
          <span style={styles.logoText}>PropAgent.AI</span>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to your dashboard</p>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{ ...styles.googleBtn, opacity: googleLoading ? 0.7 : 1 }}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div style={styles.divider}><span style={styles.dividerText}>or</span></div>

        {/* Email form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <label style={styles.label}>Email</label>
          <input
            type="email" required autoFocus
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@company.com"
            style={styles.input}
          />

          <label style={{ ...styles.label, marginTop: 16 }}>Password</label>
          <input
            type="password" required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            style={styles.input}
          />

          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <Link to="/auth/forgot-password" style={styles.link}>Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/auth/register" style={styles.link}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8, flexShrink: 0 }}>
      <path fill="#4285F4" d="M16.51 8H9v3h4.28c-.41 2.06-2.21 3.5-4.28 3.5A4.5 4.5 0 1 1 9 4.5c1.14 0 2.17.41 2.97 1.09L14.3 3.26A8 8 0 1 0 9 17a8 8 0 0 0 8-8c0-.55-.06-1.09-.16-1.6z"/>
    </svg>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-background-tertiary)', padding: '24px 16px',
  },
  card: {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 },
  logoDot: { width: 28, height: 28, borderRadius: 8, background: '#1a56db' },
  logoText: { fontWeight: 500, fontSize: 18, color: 'var(--color-text-primary)' },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' },
  sub: { margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)' },
  googleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 16px', border: '1.5px solid var(--color-border-primary)',
    borderRadius: 10, background: 'var(--color-background-secondary)',
    cursor: 'pointer', fontSize: 14, color: 'var(--color-text-primary)',
    fontWeight: 500, transition: 'border-color .15s',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '20px 0',
    borderTop: 'none',
  },
  dividerText: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    fontSize: 12, color: 'var(--color-text-tertiary)',
    '::before': { content: '""', flex: 1, height: 1, background: 'var(--color-border-tertiary)' },
  },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 },
  input: {
    padding: '10px 13px', border: '1.5px solid var(--color-border-tertiary)',
    borderRadius: 10, fontSize: 14, color: 'var(--color-text-primary)',
    background: 'var(--color-background-secondary)', outline: 'none',
  },
  submitBtn: {
    marginTop: 20, padding: '12px', borderRadius: 10, border: 'none',
    background: '#1a56db', color: '#fff', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', transition: 'opacity .15s',
  },
  errorBanner: {
    padding: '10px 13px', borderRadius: 8, marginBottom: 16,
    background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
    fontSize: 13, border: '1px solid var(--color-border-danger)',
  },
  link: { color: '#1a56db', fontSize: 13, textDecoration: 'none' },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-secondary)' },
};
