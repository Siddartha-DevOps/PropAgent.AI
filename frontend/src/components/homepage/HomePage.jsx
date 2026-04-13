import React, { useState, useEffect } from 'react';
import './HomePage.css';
import PropAgentLogo from '../PropAgentLogo';

export default function HomePage({ onTryDemo, onOpenDashboard }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setScore(78), 1400);
    return () => clearTimeout(t);
  }, []);

  // FIX: Scroll helpers for nav links
  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div>

      {/* NAV */}
      <nav className="nav">
        <a href="/" className="nav-logo">
          <PropAgentLogo size="md" />
        </a>
        <div className="nav-links">
          {/* FIX: All nav links use scrollTo, not href="#" */}
          <button onClick={() => scrollTo('how-it-works')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A4A5A', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>How It Works</button>
          <button onClick={() => scrollTo('features')}     style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A4A5A', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Features</button>
          <button onClick={() => scrollTo('demo')}         style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A4A5A', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Demo</button>
          <button onClick={() => scrollTo('pricing')}      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A4A5A', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Pricing</button>
          {/* FIX: "Get Started Free" now opens the chat widget */}
          <button onClick={onTryDemo} className="nav-cta" style={{ background: '#0C0C0F', color: '#fff', padding: '9px 22px', borderRadius: 100, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-dot" />
            AI-Powered · Real Estate · Lead Qualification
          </div>
          <h1>Turn visitors into <em>qualified buyers</em> — automatically</h1>
          <p className="hero-sub">
            PropAgent.AI deploys an intelligent sales agent on your real estate website that converses naturally, qualifies buyers, scores their intent, and delivers hot leads to your sales team 24/7.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onTryDemo}>✦ Try Live Demo</button>
            <button className="btn-secondary" onClick={onOpenDashboard}>📊 View CRM Dashboard</button>
          </div>
          <div className="hero-trust">
            <span className="hero-trust-text">Trusted by builders across India</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Prestige', 'Lodha', 'Sobha', 'Brigade'].map(b => (
                <span key={b} className="trust-logo">{b}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <HeroVisual score={score} />
        </div>
      </section>

      {/* STATS */}
      <div className="stats-strip">
        {[
          { v: '3.2×', l: 'Higher Conversion' },
          { v: '68%',  l: 'Time Saved' },
          { v: '24/7', l: 'Always Active' },
          { v: '500+', l: 'Builders Using' },
          { v: '91%',  l: 'Score Accuracy' },
        ].map(s => (
          <div key={s.l} className="stat-item">
            <div className="stat-value">{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="section-tag">How It Works</div>
        <div className="section-title">Five steps from visitor to qualified buyer</div>
        <p className="section-sub">PropAgent.AI runs the entire qualification journey — no human needed until the lead is ready.</p>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-num">{i + 1}</div>
              <div className="step-icon">{s.icon}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="section-tag">Features</div>
        <div className="section-title">Everything your sales team needs, automated</div>
        <p className="section-sub">Built for Indian real estate developers who want more leads with less effort.</p>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-cell">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO SECTION */}
      <section className="demo-section" id="demo">
        <div>
          <div className="section-tag">Live Demo</div>
          <div className="section-title">See PropAgent.AI qualify a buyer in real time</div>
          <p className="section-sub" style={{ marginBottom: 32 }}>
            No forms. No friction. The AI extracts all qualification data silently through natural conversation and calculates an intent score as you chat.
          </p>
          {DEMO_FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(184,149,42,0.1)', border: '1px solid rgba(184,149,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A22', marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#4A4A5A', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            </div>
          ))}
          {/* FIX: "Try It Yourself" opens chat widget */}
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={onTryDemo}>
            Try It Yourself →
          </button>
        </div>
        <div>
          <div className="demo-phone">
            <div className="demo-screen">
              <div className="demo-header">
                <div className="demo-avatar">P</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>PropAgent.AI</div>
                  <div style={{ fontSize: 10, color: '#2AAD6A' }}>● Online</div>
                </div>
              </div>
              <div className="demo-msg ai">Hi! I'm PropAgent.AI, your property advisor. What kind of home are you looking for? 🏠</div>
              <div className="demo-msg user">3BHK somewhere in Hyderabad</div>
              <div className="demo-msg ai">Great choice! Which area — Banjara Hills, Gachibowli, or Jubilee Hills?</div>
              <div className="demo-msg user">Banjara Hills preferably</div>
              <div className="demo-msg ai">Perfect! What's your budget — around 80L–1Cr or 1Cr–1.5Cr?</div>
              <div className="demo-msg user">Around 1–1.2 Cr</div>
              <div className="score-pill">
                Intent Score: 72/100
                <div className="score-bar-wrap">
                  <div className="score-bar-fill" style={{ width: '72%' }} />
                </div>
              </div>
              <div className="demo-msg ai">You qualify for Prestige Skyline — 3BHK at ₹95L–₹1.2Cr, ready to move! Shall I arrange a site visit? 🏡</div>
              <div className="demo-msg user">Yes please!</div>
              <div style={{ padding: '8px 12px', background: 'rgba(42,173,106,0.1)', borderRadius: 10, border: '1px solid rgba(42,173,106,0.2)', fontSize: 11, color: '#059669', textAlign: 'center', fontWeight: 600 }}>
                ✓ Lead captured · Sales team notified
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="section-tag">Pricing</div>
        <div className="section-title">Simple pricing, serious results</div>
        <p className="section-sub">Start free. Scale as you grow. No surprise fees.</p>
        <div className="pricing-grid">
          {PLANS.map((plan, i) => (
            <div key={i} className={`price-card${plan.featured ? ' featured' : ''}`}>
              {plan.featured && <div className="price-badge">⭐ Most Popular</div>}
              <div className="price-name">{plan.name}</div>
              <div className="price-value">{plan.price}</div>
              <div className="price-period">{plan.period}</div>
              <div className="price-features">
                {plan.features.map((f, j) => (
                  <div key={j} className="price-feat">
                    <div className="pfc">✓</div>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {/* FIX: Use <button> with onClick instead of <a href="#"> */}
              <button
                className={`btn-price${plan.featured ? ' gold' : ''}`}
                onClick={onTryDemo}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials">
        <div className="section-tag">Testimonials</div>
        <div className="section-title">Builders love PropAgent.AI</div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="t-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-text">"{t.text}"</p>
              <div className="t-author">
                <div className="t-avatar" style={{ background: t.color }}>{t.initials}</div>
                <div>
                  <div className="t-name">{t.name}</div>
                  <div className="t-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA STRIP */}
      <div className="cta-section">
        <div className="cta-title">
          Ready to stop losing leads to <em>slow follow-ups?</em>
        </div>
        <div className="cta-right">
          {/* FIX: button with onClick */}
          <button className="btn-primary" onClick={onTryDemo}>Start Free Trial →</button>
          <span className="cta-note">No credit card · Setup in 5 minutes</span>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-top">
          <div>
            <a href="/" className="nav-logo" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              <PropAgentLogo size="sm" />
            </a>
            <p className="footer-desc">AI sales agent for real estate websites. Qualifies buyers 24/7, scores intent, and feeds your CRM with hot leads automatically.</p>
          </div>
          <div>
            <div className="footer-col-title">Product</div>
            <div className="footer-links">
              <button onClick={onTryDemo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>Chat Widget</button>
              <button onClick={onOpenDashboard} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>CRM Dashboard</button>
              <button onClick={() => scrollTo('features')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>Features</button>
              <button onClick={() => scrollTo('pricing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>Pricing</button>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Company</div>
            <div className="footer-links">
              {['About', 'Blog', 'Careers', 'Press'].map(l => (
                <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{l}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">Legal</div>
            <div className="footer-links">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(l => (
                <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 PropAgent.AI · All rights reserved</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Twitter', 'LinkedIn', 'GitHub'].map(s => (
              <span key={s} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{s}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// HERO VISUAL COMPONENT
function HeroVisual({ score }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#B8952A,#F0CC6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff' }}>P</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>PropAgent.AI</div>
            <div style={{ fontSize: 11, color: '#2AAD6A' }}>● Online</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9A9A9A' }}>Just now</div>
        </div>
        {[
          { ai: true,  msg: "Hi! I'm your AI property advisor. What kind of home are you looking for?" },
          { ai: false, msg: "3BHK in Banjara Hills, budget around 1.2 Cr" },
          { ai: true,  msg: "Excellent! Are you planning a home loan or self-funded?" },
          { ai: false, msg: "Home loan, already pre-approved" },
        ].map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.ai ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
            <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: m.ai ? '3px 12px 12px 12px' : '12px 12px 3px 12px', background: m.ai ? '#F5F4F0' : 'linear-gradient(135deg,#B8952A,#F0CC6A)', color: m.ai ? '#1A1A22' : '#fff', fontSize: 12, lineHeight: 1.55 }}>{m.msg}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(184,149,42,0.15)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `conic-gradient(#B8952A ${score * 3.6}deg, #EEE 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 1s ease' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#B8952A' }}>{score}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A22' }}>🔴 Hot Lead Detected</div>
          <div style={{ fontSize: 11, color: '#7A7A8A', marginTop: 2 }}>Budget · Location · Pre-approved · +3 signals</div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 100, background: 'rgba(255,87,87,0.08)', color: '#FF5757', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,87,87,0.2)', whiteSpace: 'nowrap' }}>Notify Team →</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '12px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 20, justifyContent: 'space-between' }}>
        {[{ l: 'Budget', v: '₹1.2 Cr' }, { l: 'Location', v: 'Banjara Hills' }, { l: 'Type', v: '3BHK' }, { l: 'Timeline', v: '3 months' }].map(d => (
          <div key={d.l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#9A9A9A', marginBottom: 2 }}>{d.l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A22' }}>{d.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// DATA
const STEPS = [
  { icon: '👋', title: 'Greet Visitor',    desc: 'AI instantly greets every visitor with a warm, personalized opening message.' },
  { icon: '🎯', title: 'Qualify Intent',   desc: 'Asks smart questions about budget, location, property type, and timeline.' },
  { icon: '🧮', title: 'Score Intent',     desc: 'Calculates a buyer intent score 0–100 using 6 weighted signals in real-time.' },
  { icon: '🏠', title: 'Recommend',        desc: 'Suggests matching properties from your inventory based on requirements.' },
  { icon: '📲', title: 'Capture & Notify', desc: 'Collects contact details and alerts your sales team about hot leads instantly.' },
];

const FEATURES = [
  { icon: '💬', title: 'Natural Conversations',   desc: 'Claude AI powers human-like dialogue. Buyers open up naturally without feeling sold to.' },
  { icon: '🧠', title: 'Smart Intent Scoring',    desc: '6-signal scoring engine evaluates budget, timeline, financing to rank every lead 0–100.' },
  { icon: '📊', title: 'Live CRM Dashboard',      desc: 'Real-time lead pipeline with conversation viewer, intent badges, and analytics charts.' },
  { icon: '🏗️', title: 'Property Matching',       desc: 'AI learns your inventory and recommends the right units to each buyer automatically.' },
  { icon: '🔌', title: 'Easy Embed',              desc: 'One line of JavaScript on any website. Works with WordPress, Next.js, or plain HTML.' },
  { icon: '📈', title: 'Conversion Analytics',    desc: 'Track visitor-to-lead conversion, intent distribution, and top locations.' },
  { icon: '🔔', title: 'Instant Notifications',   desc: 'Sales team gets alerts the moment a hot lead is identified — zero delay.' },
  { icon: '🔒', title: 'Enterprise Security',     desc: 'JWT auth, rate limiting, encrypted data, GDPR compliant from day one.' },
  { icon: '🌐', title: 'Multi-builder SaaS',      desc: 'Each developer gets an isolated workspace with their own widget and analytics.' },
];

const DEMO_FEATURES = [
  { icon: '🎙️', title: 'Natural conversation flow',    desc: 'No forms — buyers just chat while the AI extracts all qualification data silently.' },
  { icon: '⚡',  title: 'Real-time intent scoring',    desc: 'Watch the score update live in the panel as the conversation progresses.' },
  { icon: '🏷️', title: 'Automatic lead classification', desc: 'Hot (70+), Warm (40–69), Cold (below 40) — sorted automatically for your team.' },
];

const PLANS = [
  {
    name: 'Starter', price: '₹0', period: '/ month · Free forever',
    cta: 'Start Free',
    features: ['1 website widget', 'Up to 50 leads/month', 'Basic intent scoring', 'Email notifications', 'Community support'],
  },
  {
    name: 'Growth', price: '₹4,999', period: '/ month · Billed annually',
    featured: true, cta: 'Start 14-day Trial',
    features: ['5 website widgets', 'Unlimited leads', 'Advanced AI scoring', 'WhatsApp notifications', 'CRM dashboard', 'Analytics & reports', 'Priority support'],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '/ month · Custom billing',
    cta: 'Contact Sales',
    features: ['Unlimited widgets', 'Unlimited leads', 'Custom AI training', 'HubSpot / Salesforce sync', 'Dedicated manager', 'White-label option', 'SLA guarantee'],
  },
];

const TESTIMONIALS = [
  { text: "We deployed PropAgent.AI on our Banjara Hills project and within 2 weeks had 40 qualified leads — compared to 8 the previous month. The intent scoring is incredibly accurate.", name: 'Ravi Kumar', role: 'Sales Head · Prestige Group', initials: 'RK', color: '#B8952A' },
  { text: "The AI feels like a real sales executive. It asks exactly the right questions and never feels pushy. Our site visit bookings went up 3× after deployment.", name: 'Sunita Reddy', role: 'Marketing Director · Sobha Ltd', initials: 'SR', color: '#2A6DD4' },
  { text: "Finally a tool built for Indian real estate. It understands lakhs and crores, knows Hyderabad's localities, and handles loan vs self-funded questions perfectly.", name: 'Arjun Mehta', role: 'Founder · AVM Realtors', initials: 'AM', color: '#2AAD6A' },
];