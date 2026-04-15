// frontend/src/pages/auth/RegisterPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setLoading(true);
    try {
      const data = await register(form);
      navigate(data.nextStep === 'onboarding' ? '/onboarding' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoDot} />
          <span style={styles.logoText}>PropAgent.AI</span>
        </div>

        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.sub}>Start free — no credit card required</p>

        <button onClick={loginWithGoogle} style={styles.googleBtn}>
          <GoogleIcon />Continue with Google
        </button>

        <div style={styles.dividerRow}>
          <div style={styles.line} />
          <span style={styles.orText}>or</span>
          <div style={styles.line} />
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          {[
            { label: 'Full name',     key: 'name',     type: 'text',     placeholder: 'Ravi Kumar', required: true },
            { label: 'Email',         key: 'email',    type: 'email',    placeholder: 'ravi@prestige.com', required: true },
            { label: 'Company / Project', key: 'company', type: 'text', placeholder: 'Prestige Group', required: false },
            { label: 'Password',      key: 'password', type: 'password', placeholder: 'Min 8 characters', required: true },
          ].map(({ label, key, type, placeholder, required }) => (
            <React.Fragment key={key}>
              <label style={styles.label}>{label}{required && <span style={{ color: '#e03131' }}> *</span>}</label>
              <input
                type={type} required={required} autoComplete="off"
                value={form[key]} onChange={set(key)} placeholder={placeholder}
                style={styles.input}
              />
            </React.Fragment>
          ))}

          <button
            type="submit" disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/auth/login" style={styles.link}>Sign in</Link>
        </p>

        <p style={{ ...styles.footer, fontSize: 11, marginTop: 8, color: 'var(--color-text-tertiary)' }}>
          By signing up you agree to our Terms of Service and Privacy Policy.
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
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary)', padding: '24px 16px' },
  card: { background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 },
  logoDot: { width: 28, height: 28, borderRadius: 8, background: '#1a56db' },
  logoText: { fontWeight: 500, fontSize: 18, color: 'var(--color-text-primary)' },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' },
  sub: { margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)' },
  googleBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', border: '1.5px solid var(--color-border-primary)', borderRadius: 10, background: 'var(--color-background-secondary)', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500 },
  dividerRow: { display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' },
  line: { flex: 1, height: 1, background: 'var(--color-border-tertiary)' },
  orText: { fontSize: 12, color: 'var(--color-text-tertiary)', flexShrink: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 10 },
  input: { padding: '10px 13px', border: '1.5px solid var(--color-border-tertiary)', borderRadius: 10, fontSize: 14, color: 'var(--color-text-primary)', background: 'var(--color-background-secondary)', outline: 'none' },
  submitBtn: { marginTop: 20, padding: '12px', borderRadius: 10, border: 'none', background: '#1a56db', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  errorBanner: { padding: '10px 13px', borderRadius: 8, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', fontSize: 13, border: '1px solid var(--color-border-danger)' },
  link: { color: '#1a56db', fontSize: 13, textDecoration: 'none' },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-secondary)' },
};