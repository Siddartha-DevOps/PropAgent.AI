import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import GoogleCallback from './pages/auth/GoogleCallback';
import ForgotPasswordPage, { ResetPasswordPage } from './pages/auth/ForgotPasswordPage';

import { OnboardingGuard, ProtectedRoute } from './components/auth/protectedRoute';

const Dashboard = React.lazy(() => import('./components/dashboard/Dashboard'));
const LeadsPage = React.lazy(() => import('./components/dashboard/LeadsPage'));
const BotsPage = React.lazy(() => import('./components/dashboard/BotsPage'));
const AnalyticsPage = React.lazy(() => import('./components/dashboard/AnalyticsPage'));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={null}>
          <Routes>
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Dashboard />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <LeadsPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/bots"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <BotsPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <AnalyticsPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
