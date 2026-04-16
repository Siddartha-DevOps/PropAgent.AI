// frontend/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AuthService from '../services/authService';
import { setAccessToken, clearAccessToken } from '../services/api';
import { hasMinRole } from '../constants/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const refreshTimer = useRef(null);

  // ─────────────────────────────────────────────────────────
  // Bootstrap authentication on app load
  // ─────────────────────────────────────────────────────────
  useEffect(() => {

    bootstrapAuth();

    window.addEventListener('auth:expired', handleExpiry);

    return () => {
      window.removeEventListener('auth:expired', handleExpiry);
      clearTimeout(refreshTimer.current);
    };

  }, []);

  // ─────────────────────────────────────────────────────────
  // Bootstrap session
  // ─────────────────────────────────────────────────────────
  async function bootstrapAuth() {

    try {

      const res = await AuthService.refreshToken();

      if (res && res.data && res.data.accessToken) {

        setAccessToken(res.data.accessToken);
        setUser(res.data.user);

        scheduleRefresh();

      } else {

        clearAccessToken();
        setUser(null);

      }

    } catch (err) {

      clearAccessToken();
      setUser(null);

    } finally {

      setLoading(false);
      setAuthReady(true);

    }
  }

  // ─────────────────────────────────────────────────────────
  // Handle expired session
  // ─────────────────────────────────────────────────────────
  function handleExpiry() {

    clearAccessToken();
    setUser(null);

  }

  // ─────────────────────────────────────────────────────────
  // Schedule token refresh (before expiry)
  // ─────────────────────────────────────────────────────────
  function scheduleRefresh() {

    clearTimeout(refreshTimer.current);

    refreshTimer.current = setTimeout(async () => {

      try {

        const res = await AuthService.refreshToken();

        if (res && res.data && res.data.accessToken) {

          setAccessToken(res.data.accessToken);
          setUser(res.data.user);

          scheduleRefresh();

        } else {

          clearAccessToken();
          setUser(null);

        }

      } catch (err) {

        clearAccessToken();
        setUser(null);

      }

    }, 14 * 60 * 1000);

  }

  // ─────────────────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {

    const res = await AuthService.login(email, password);

    if (res && res.data && res.data.accessToken) {

      setAccessToken(res.data.accessToken);
      setUser(res.data.user);

      scheduleRefresh();

    }

    return res.data;

  }, []);

  // ─────────────────────────────────────────────────────────
  // Register
  // ─────────────────────────────────────────────────────────
  const register = useCallback(async (data) => {

    const res = await AuthService.register(data);

    if (res && res.data && res.data.accessToken) {

      setAccessToken(res.data.accessToken);
      setUser(res.data.user);

      scheduleRefresh();

    }

    return res.data;

  }, []);

  // ─────────────────────────────────────────────────────────
  // Google login
  // ─────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {

    window.location.href = AuthService.googleAuthUrl();

  }, []);

  // ─────────────────────────────────────────────────────────
  // OAuth callback handler
  // ─────────────────────────────────────────────────────────
  const handleOAuthToken = useCallback(async (accessToken) => {

    if (!accessToken) return;

    setAccessToken(accessToken);

    const res = await AuthService.getMe();

    if (res && res.data && res.data.user) {

      setUser(res.data.user);
      scheduleRefresh();

      return res.data.user;

    }

  }, []);

  // ─────────────────────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────────────────────
  const logout = useCallback(async () => {

    try {

      await AuthService.logout();

    } catch (err) {}

    clearAccessToken();

    clearTimeout(refreshTimer.current);

    setUser(null);

  }, []);

  // ─────────────────────────────────────────────────────────
  // Update user locally
  // ─────────────────────────────────────────────────────────
  const updateUser = useCallback((updates) => {

    setUser((current) => {

      if (!current) return current;

      return {
        ...current,
        ...updates
      };

    });

  }, []);

  // ─────────────────────────────────────────────────────────
  // Permission helpers
  // ─────────────────────────────────────────────────────────
  const isRole = (role) => user?.role === role;

  const hasRole = (minRole) => {

    if (!user) return false;

    return hasMinRole(user.role, minRole);

  };

  const isLoggedIn = !!user;

  // ─────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────
  const value = {

    user,
    loading,
    authReady,
    isLoggedIn,

    login,
    register,
    logout,

    loginWithGoogle,
    handleOAuthToken,

    updateUser,

    isRole,
    hasRole

  };

  return (

    <AuthContext.Provider value={value}>

      {children}

    </AuthContext.Provider>

  );

}

// ─────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────
export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) {

    throw new Error('useAuth must be used inside <AuthProvider>');

  }

  return ctx;

}

export default AuthContext;