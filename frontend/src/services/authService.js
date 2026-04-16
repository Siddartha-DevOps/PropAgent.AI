// frontend/src/services/authService.js
import api from './api';

const AuthService = {
  register: (data) => api.post('/auth/register', data),

  login: (email, password) => api.post('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  logoutAll: () => api.post('/auth/logout-all'),

  getMe: () => api.get('/auth/me'),

  refreshToken: () => api.post('/auth/refresh'),

  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),

  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),

  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),

  // Returns the Google OAuth initiation URL
  googleAuthUrl: () =>
    `${process.env.REACT_APP_API_URL || ''}/api/auth/oauth/google`,
};

export default AuthService;