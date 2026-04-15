import React, { useState, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './components/homepage/HomePage';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import {
  ProtectedRoute,
  OnboardingGuard,
} from './components/auth/ProtectedRoute';

// Auth pages
import LoginPage               from './pages/auth/LoginPage';
import RegisterPage            from './pages/auth/RegisterPage';
import GoogleCallback          from './pages/auth/GoogleCallback';
import ForgotPasswordPage,
       { ResetPasswordPage }   from './pages/auth/ForgotPasswordPage';

import Dashboard      from './pages/Dashboard';
 import Onboarding     from './pages/Onboarding';
 import LeadsPage      from './pages/Leads';
import BotsPage       from './pages/Bots';
import AnalyticsPage  from './pages/Analytics';
 import TeamPage       from './pages/Team';
 import SettingsPage   from './pages/Settings';
 import AdminPage      from './pages/admin/AdminPage';       

const ChatWidget     = React.lazy(() => import('./components/chat/ChatWidget'));
const Dashboard      = React.lazy(() => import('./components/dashboard/Dashboard'));
const AuthPage       = React.lazy(() => import('./pages/AuthPage'));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));
const PaymentPage    = React.lazy(() => import('./pages/PaymentPage'));

const Dashboard     = React.lazy(() => import('./pages/Dashboard').catch(() => ({ default: () => <div style={{padding:40}}>Dashboard</div> })));
const Onboarding    = React.lazy(() => import('./pages/Onboarding').catch(() => ({ default: () => <div style={{padding:40}}>Onboarding</div> })));
 
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={null}>
          <Routes>
            {/* ── Public auth routes ──────────────────────────────────── */}
            <Route path="/auth/login"           element={<LoginPage />} />
            <Route path="/auth/register"        element={<RegisterPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password"  element={<ResetPasswordPage />} />
 
            {/* ── Onboarding (protected but not requiring onboarded) ── */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
 
            {/* ── Protected app routes ─────────────────────────────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <Dashboard />
                </OnboardingGuard>
              </ProtectedRoute>
            } />
 
            {
            /* Add your other protected routes here: */}
            {
            <Route path="/leads" element={
              <ProtectedRoute><OnboardingGuard><LeadsPage /></OnboardingGuard></ProtectedRoute>
            } />
            <Route path="/bots" element={
              <ProtectedRoute><OnboardingGuard><BotsPage /></OnboardingGuard></ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute><OnboardingGuard><AnalyticsPage /></OnboardingGuard></ProtectedRoute>
            } />
            <Route path="/team" element={
              <ProtectedRoute><OnboardingGuard><TeamPage /></OnboardingGuard></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><OnboardingGuard><SettingsPage /></OnboardingGuard></ProtectedRoute>
            } />
            <Route path="/admin/*" element={
              <ProtectedRoute>
                <RoleGuard minRole="superadmin" fallback={<Navigate to="/dashboard" replace />}>
                  <AdminPage />
                </RoleGuard>
              </ProtectedRoute>
            } />
            */}
 
            {/* ── Root redirect ────────────────────────────────────── */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

function Loading() {
  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAF8F3', fontFamily:"'Outfit',sans-serif", flexDirection:'column', gap:12 }}>
      <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, color:'#fff' }}>P</div>
      <div style={{ color:'#7A7A8A', fontSize:14 }}>Loading PropAgent.AI...</div>
    </div>
  );
}

function AppRouter() {
  const { isAuthenticated, isOnboarded, hasDashboard, loading, initialized } = useAuth();
  const [view, setView] = useState('home');

  if (!initialized || loading) return <Loading />;

  function handleGetStarted() {
    if (!isAuthenticated) { setView('auth'); return; }
    if (!isOnboarded)     { setView('onboarding'); return; }
    setView('chat');
  }

  function handleOpenDashboard() {
    if (!isAuthenticated) { setView('auth'); return; }
    if (!isOnboarded)     { setView('onboarding'); return; }
    if (!hasDashboard)    { setView('payment'); return; }
    setView('dashboard');
  }

  function handleAuthSuccess(nextStep) {
    if (nextStep === 'onboarding') { setView('onboarding'); return; }
    if (nextStep === 'dashboard')  { setView('dashboard');  return; }
    setView('home');
  }

  function handleOnboardingComplete(choosePlan) {
    if (choosePlan) { setView('payment'); return; }
    setView('chat');
  }

  return (
    <Suspense fallback={<Loading />}>
      {view === 'home'       && <HomePage onTryDemo={handleGetStarted} onOpenDashboard={handleOpenDashboard} />}
      {view === 'auth'       && <AuthPage onSuccess={handleAuthSuccess} onBack={() => setView('home')} />}
      {view === 'onboarding' && <OnboardingPage onComplete={handleOnboardingComplete} onBack={() => setView('home')} />}
      {view === 'payment'    && <PaymentPage onSuccess={() => setView('dashboard')} onBack={() => setView('home')} />}
      {view === 'chat'       && <ChatWidget onBack={() => setView('home')} />}
      {view === 'dashboard'  && <Dashboard  onBack={() => setView('home')} />}
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}