import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PropAgentLogo from '../components/PropAgentLogo';

export default function AuthPage({ onSuccess, onBack }) {
  const { login, register } = useAuth();
  const [mode, setMode]     = useState('login'); // login | signup
  const [form, setForm]     = useState({ name:'', email:'', password:'', company:'', phone:'' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const S = {
    wrap: { minHeight:'100vh', background:'#FAF8F3', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Outfit',sans-serif" },
    card: { background:'#fff', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:440, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 20px 60px rgba(0,0,0,0.1)' },
    logoWrap: { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
    logoIco: { width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:17, color:'#fff' },
    title: { fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:800, color:'#0C0C0F', marginBottom:6 },
    sub: { fontSize:14, color:'#7A7A8A', marginBottom:28 },
    label: { fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:5, display:'block' },
    input: { width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.12)', fontSize:14, fontFamily:'inherit', color:'#1A1A22', outline:'none', background:'#fff', marginBottom:14, boxSizing:'border-box' },
    btn: { width:'100%', padding:'13px', borderRadius:100, border:'none', background:'linear-gradient(135deg,#B8952A,#F0CC6A)', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', marginTop:6 },
    err: { background:'rgba(255,87,87,0.08)', border:'1px solid rgba(255,87,87,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#CC3333', marginBottom:14 },
    toggle: { textAlign:'center', marginTop:20, fontSize:13, color:'#7A7A8A' },
    toggleBtn: { background:'none', border:'none', color:'#B8952A', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' },
    back: { background:'none', border:'none', color:'#7A7A8A', cursor:'pointer', fontSize:13, fontFamily:'inherit', marginBottom:20, display:'flex', alignItems:'center', gap:5 },
    divider: { display:'flex', alignItems:'center', gap:12, margin:'20px 0' },
    divLine: { flex:1, height:1, background:'rgba(0,0,0,0.08)' },
    divText: { fontSize:12, color:'#9A9A9A' },
  };

  function update(field) { return e => { setForm(p=>({...p,[field]:e.target.value})); setError(''); }; }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await login(form.email, form.password);
      } else {
        if (!form.name.trim())    throw new Error('Name is required');
        if (!form.company.trim()) throw new Error('Company name is required');
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters');
        result = await register(form);
      }
      onSuccess(result.nextStep);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <button style={S.back} onClick={onBack}>← Back to home</button>
        <div style={S.logoWrap}>
          <div style={S.logoIco}>P</div>
          <span style={{ fontSize:17, fontWeight:700 }}>PropAgent<span style={{ color:'#B8952A' }}>.AI</span></span>
        </div>

        <div style={S.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>
        <div style={S.sub}>{mode === 'login' ? 'Sign in to your PropAgent.AI dashboard.' : 'Start your free trial — no credit card required.'}</div>

        {error && <div style={S.err}>⚠️ {error}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label style={S.label}>Full Name</label>
              <input style={S.input} value={form.name} onChange={update('name')} placeholder="Ravi Kumar" required
                onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} />
              <label style={S.label}>Company / Builder Name</label>
              <input style={S.input} value={form.company} onChange={update('company')} placeholder="Prestige Group" required
                onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} />
              <label style={S.label}>Phone (optional)</label>
              <input style={S.input} value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210"
                onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} />
            </>
          )}

          <label style={S.label}>Email Address</label>
          <input style={S.input} type="email" value={form.email} onChange={update('email')} placeholder="ravi@prestige.com" required
            onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} />

          <label style={S.label}>Password {mode === 'signup' && <span style={{ color:'#9A9A9A', fontWeight:400 }}>(min 8 characters)</span>}</label>
          <input style={S.input} type="password" value={form.password} onChange={update('password')} placeholder="••••••••" required
            onFocus={e=>e.target.style.borderColor='#B8952A'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} />

          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        {mode === 'signup' && (
          <div style={{ fontSize:11, color:'#9A9A9A', textAlign:'center', marginTop:12 }}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </div>
        )}

        <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>or</span><div style={S.divLine}/></div>

        <div style={S.toggle}>
          {mode === 'login' ? (
            <>Don't have an account? <button style={S.toggleBtn} onClick={() => { setMode('signup'); setError(''); }}>Sign up free →</button></>
          ) : (
            <>Already have an account? <button style={S.toggleBtn} onClick={() => { setMode('login'); setError(''); }}>Sign in →</button></>
          )}
        </div>
      </div>
    </div>
  );
}