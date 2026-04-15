// frontend/src/services/api.js
// Axios instance with:
//   - Authorization header injected from memory
//   - Silent token refresh on 401 TOKEN_EXPIRED
//   - Logout on irrecoverable auth failures

import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// In-memory token store — never localStorage for access tokens
let _accessToken = null;

export function setAccessToken(token) { _accessToken = token; }
export function getAccessToken()      { return _accessToken; }
export function clearAccessToken()    { _accessToken = null; }

const api = axios.create({
  baseURL:        BASE_URL,
  withCredentials: true,    // send refresh cookie on every request
  timeout:        15000,
});

// ── Request interceptor — attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Response interceptor — silent token refresh ───────────────────────────────
let _refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status   = error.response?.status;
    const code     = error.response?.data?.code;

    // Only attempt refresh for expired tokens (not invalid, not other 401s)
    if (status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;

      // Deduplicate concurrent refresh attempts
      if (!_refreshPromise) {
        _refreshPromise = api.post('/auth/refresh')
          .then((r) => {
            setAccessToken(r.data.accessToken);
            return r.data.accessToken;
          })
          .catch((e) => {
            // Refresh failed — clear everything and let app handle redirect
            clearAccessToken();
            _refreshPromise = null;
            throw e;
          })
          .finally(() => { _refreshPromise = null; });
      }

      try {
        const newToken = await _refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (_) {
        // Emit a custom event so AuthContext can redirect to login
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;