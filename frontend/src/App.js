import React, { useState, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './components/homepage/HomePage';

const ChatWidget     = React.lazy(() => import('./components/chat/ChatWidget'));
const Dashboard      = React.lazy(() => import('./components/dashboard/Dashboard'));
const AuthPage       = React.lazy(() => import('./pages/AuthPage'));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));
const PaymentPage    = React.lazy(() => import('./pages/PaymentPage'));

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