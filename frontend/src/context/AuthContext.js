// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AuthService from '../services/authService';
import { setAccessToken, clearAccessToken } from '../services/api';
import { hasMinRole } from '../constants/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);  // initial check
  const [authReady,   setAuthReady]   = useState(false);
  const refreshTimer  = useRef(null);

  // ── Bootstrap: try silent refresh on app load ─────────────────────────────
  useEffect(() => {
    _bootstrap();
    // Listen for session expiry emitted by axios interceptor
    window.addEventListener('auth:expired', _handleExpiry);
    return () => {
      window.removeEventListener('auth:expired', _handleExpiry);
      clearTimeout(refreshTimer.current);
    };
  }, []);

  async function _bootstrap() {
    try {
      // Attempt silent refresh — uses the HttpOnly refresh cookie
      const res = await AuthService.refreshToken();
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      _scheduleRefresh();
    } catch (_) {
      // No valid session — user needs to log in
      clearAccessToken();
      setUser(null);
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }

  function _handleExpiry() {
    clearAccessToken();
    setUser(null);
  }

  // ── Schedule proactive refresh 1 min before access token expires (14 min) ──
  function _scheduleRefresh() {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await AuthService.refreshToken();
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        _scheduleRefresh();
      } catch (_) {
        clearAccessToken();
        setUser(null);
      }
    }, 14 * 60 * 1000); // 14 minutes
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await AuthService.login(email, password);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    _scheduleRefresh();
    return res.data;
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (data) => {
    const res = await AuthService.register(data);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    _scheduleRefresh();
    return res.data;
  }, []);

  // ── Google OAuth (redirect-based) ─────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {
    window.location.href = AuthService.googleAuthUrl();
  }, []);

  // ── Handle OAuth callback token (called from GoogleCallback page) ──────────
  const handleOAuthToken = useCallback(async (accessToken) => {
    setAccessToken(accessToken);
    const res = await AuthService.getMe();
    setUser(res.data.user);
    _scheduleRefresh();
    return res.data.user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await AuthService.logout(); } catch (_) {}
    clearAccessToken();
    clearTimeout(refreshTimer.current);
    setUser(null);
  }, []);

  // ── Update user in state (after profile edit etc.) ───────────────────────
  const updateUser = useCallback((updates) => {
    setUser((u) => u ? { ...u, ...updates } : u);
  }, []);

  // ── Permission helpers ────────────────────────────────────────────────────
  const isRole     = (role) => user?.role === role;
  const hasRole    = (minRole) => user ? hasMinRole(user.role, minRole) : false;
  const isLoggedIn = !!user;

  const value = {
    user, loading, authReady, isLoggedIn,
    login, register, logout, loginWithGoogle, handleOAuthToken, updateUser,
    isRole, hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;