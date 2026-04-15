// frontend/src/pages/auth/GoogleCallback.jsx
// This page handles the redirect from the backend after Google OAuth.
// The backend redirects to: /auth/google/callback?token=<accessToken>&step=<dashboard|onboarding>
// On error: /auth/google/callback?error=<message>
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function GoogleCallback() {
  const { handleOAuthToken } = useAuth();
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const [status, setStatus] = useState('Completing sign-in…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    _process();
  }, []);

  async function _process() {
    const error = params.get('error');
    if (error) {
      setStatus('Sign-in failed: ' + decodeURIComponent(error));
      setTimeout(() => navigate('/auth/login'), 2500);
      return;
    }

    const token = params.get('token');
    const step  = params.get('step') || 'dashboard';

    if (!token) {
      setStatus('No token received. Redirecting…');
      setTimeout(() => navigate('/auth/login'), 1500);
      return;
    }

    try {
      await handleOAuthToken(token);
      // Clean token from URL immediately
      window.history.replaceState({}, '', step === 'onboarding' ? '/onboarding' : '/dashboard');
      navigate(step === 'onboarding' ? '/onboarding' : '/dashboard', { replace: true });
    } catch (err) {
      setStatus('Authentication failed. Redirecting to login…');
      setTimeout(() => navigate('/auth/login'), 2000);
    }
  }

  const isError = status.includes('failed') || status.includes('No token');

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoDot} />
          <span style={styles.logoText}>PropAgent.AI</span>
        </div>

        {!isError ? (
          <>
            <div style={styles.spinner} />
            <p style={styles.text}>{status}</p>
          </>
        ) : (
          <>
            <div style={styles.errorIcon}>✕</div>
            <p style={{ ...styles.text, color: 'var(--color-text-danger)' }}>{status}</p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary)' },
  card: { background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 16, padding: '48px 40px', textAlign: 'center', minWidth: 280 },
  logo: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32 },
  logoDot: { width: 28, height: 28, borderRadius: 8, background: '#1a56db' },
  logoText: { fontWeight: 500, fontSize: 18, color: 'var(--color-text-primary)' },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--color-border-tertiary)', borderTopColor: '#1a56db', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' },
  errorIcon: { fontSize: 32, color: 'var(--color-text-danger)', marginBottom: 12 },
  text: { fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 },
};