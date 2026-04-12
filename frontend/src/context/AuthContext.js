import React, { createContext, useContext, useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [token, setToken]         = useState(localStorage.getItem('pa_token'));
  const [loading, setLoading]     = useState(true);
  const [initialized, setInit]    = useState(false);

  // Load user on mount
  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
      setInit(true);
    }
  }, []);

  async function fetchMe(t) {
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token invalid
        logout();
      }
    } catch {
      // Backend down — keep user logged in with cached data
    } finally {
      setLoading(false);
      setInit(true);
    }
  }

  async function login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('pa_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data; // contains nextStep
  }

  async function register(formData) {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    localStorage.setItem('pa_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  function logout() {
    localStorage.removeItem('pa_token');
    setToken(null);
    setUser(null);
  }

  function updateUser(updates) {
    setUser(prev => ({ ...prev, ...updates }));
  }

  const isAuthenticated = !!token && !!user;
  const isOnboarded = user?.isOnboarded === true;
  const plan = user?.plan || 'starter';
  const hasDashboard = ['growth', 'enterprise'].includes(plan);

  return (
    <AuthContext.Provider value={{
      user, token, loading, initialized,
      isAuthenticated, isOnboarded, plan, hasDashboard,
      login, register, logout, updateUser, fetchMe: () => fetchMe(token)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
