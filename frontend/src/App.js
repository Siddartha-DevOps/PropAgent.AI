import React, { useState, Suspense } from 'react';
import HomePage from './components/homepage/HomePage';

const ChatWidget = React.lazy(() => import('./components/chat/ChatWidget'));
const Dashboard  = React.lazy(() => import('./components/dashboard/Dashboard'));

function Loading() {
  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAF8F3', fontFamily:'Outfit,sans-serif', color:'#7A7A8A', fontSize:14 }}>
      Loading PropAgent.AI...
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');

  return (
    <Suspense fallback={<Loading />}>
      {view === 'home'      && <HomePage onTryDemo={() => setView('chat')} onOpenDashboard={() => setView('dashboard')} />}
      {view === 'chat'      && <ChatWidget onBack={() => setView('home')} />}
      {view === 'dashboard' && <Dashboard  onBack={() => setView('home')} />}
    </Suspense>
  );
}