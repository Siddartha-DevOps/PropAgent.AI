import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const PLANS = [
  { id:'growth', name:'Growth', priceINR:'₹4,999', priceUSD:'$59', period:'/month', color:'#B8952A', featured:true, features:['5 website widgets','Unlimited leads','Full CRM dashboard','AI intent scoring','WhatsApp + email alerts','Analytics & reports','Priority support'], razorpayNote:'UPI · Cards · Net Banking · Wallets' },
  { id:'enterprise', name:'Enterprise', priceINR:'Custom', priceUSD:'Custom', period:'', color:'#2AAD6A', features:['Unlimited widgets','Unlimited leads','Custom AI training','White-label widget','HubSpot + Salesforce sync','Dedicated account manager','99.9% SLA'], razorpayNote:'Contact us for pricing' },
];

export default function PaymentPage({ onSuccess, onBack }) {
  const { token, user, fetchMe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // razorpay | stripe
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const S = {
    wrap: { minHeight:'100vh', background:'#FAF8F3', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Outfit',sans-serif" },
    card: { background:'#fff', borderRadius:20, padding:'36px', width:'100%', maxWidth:600, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 20px 60px rgba(0,0,0,0.08)' },
    btn: { width:'100%', padding:'14px', borderRadius:100, border:'none', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' },
    methodBtn: (sel) => ({ flex:1, padding:'12px', borderRadius:10, border:`2px solid ${sel?'#B8952A':'rgba(0,0,0,0.1)'}`, background:sel?'rgba(184,149,42,0.06)':'#fff', color:sel?'#B8952A':'#4A4A5A', fontWeight:sel?700:500, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }),
  };

  async function handleRazorpay() {
    setLoading(true); setError('');
    try {
      // Create order
      const res = await fetch(`${API}/payment/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: selectedPlan })
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error);

      if (order.demo) {
        // Demo mode — simulate payment
        await verifyRazorpay({ razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_demo', razorpay_signature: 'demo_sig' });
        return;
      }

      // Real Razorpay checkout
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'PropAgent.AI',
        description: `${selectedPlan.charAt(0).toUpperCase()+selectedPlan.slice(1)} Plan`,
        order_id: order.orderId,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#B8952A' },
        handler: async (response) => {
          await verifyRazorpay({ ...response, planId: selectedPlan });
        },
        modal: { ondismiss: () => setLoading(false) }
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => { const rzp = new window.Razorpay(options); rzp.open(); };
        document.body.appendChild(script);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function verifyRazorpay(paymentData) {
    const res = await fetch(`${API}/payment/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...paymentData, planId: selectedPlan })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await fetchMe();
    setSuccess(true);
    setLoading(false);
    setTimeout(onSuccess, 2000);
  }

  async function handleStripe() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/payment/stripe/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: selectedPlan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.demo) {
        setSuccess(true);
        setTimeout(onSuccess, 2000);
        return;
      }
      window.location.href = data.sessionUrl;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ ...S.wrap }}>
        <div style={{ ...S.card, textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:800, marginBottom:8 }}>Payment Successful!</div>
          <div style={{ fontSize:14, color:'#7A7A8A' }}>Your {selectedPlan} plan is now active. Redirecting to your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#7A7A8A', cursor:'pointer', fontSize:13, fontFamily:'inherit', marginBottom:20 }}>← Back</button>

        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:24 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:15, color:'#fff' }}>P</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>PropAgent<span style={{ color:'#B8952A' }}>.AI</span></div>
            <div style={{ fontSize:11, color:'#9A9A9A' }}>Upgrade your plan</div>
          </div>
        </div>

        {/* Plan selector */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:10 }}>Select Plan</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {PLANS.map(plan => (
              <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${selectedPlan===plan.id?plan.color:'rgba(0,0,0,0.09)'}`, background:selectedPlan===plan.id?`${plan.color}06`:'#fff', cursor:'pointer', transition:'all 0.15s' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${plan.color}`, background:selectedPlan===plan.id?plan.color:'transparent', transition:'all 0.15s', flexShrink:0 }} />
                    <span style={{ fontWeight:700, fontSize:15, color:'#0C0C0F' }}>{plan.name}</span>
                    {plan.featured && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:100, background:`${plan.color}15`, color:plan.color, fontWeight:700 }}>Most Popular</span>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontWeight:800, fontSize:18, color:plan.color }}>{plan.priceINR}</span>
                    <span style={{ fontSize:12, color:'#9A9A9A' }}>{plan.period}</span>
                  </div>
                </div>
                <div style={{ fontSize:12, color:'#7A7A8A', paddingLeft:26 }}>{plan.features.slice(0,4).join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>

        {selectedPlan === 'enterprise' ? (
          <div style={{ textAlign:'center', padding:24, background:'rgba(42,173,106,0.06)', borderRadius:12, border:'1px solid rgba(42,173,106,0.2)' }}>
            <div style={{ fontSize:14, color:'#4A4A5A', marginBottom:12 }}>Enterprise pricing is custom. Contact us and we'll set up a plan for your team.</div>
            <a href="mailto:sales@propagent.ai" style={{ display:'inline-block', padding:'11px 24px', borderRadius:100, background:'linear-gradient(135deg,#2AAD6A,#34D399)', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none' }}>
              Contact Sales →
            </a>
          </div>
        ) : (
          <>
            {/* Payment method */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:10 }}>Payment Method</div>
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.methodBtn(paymentMethod==='razorpay')} onClick={() => setPaymentMethod('razorpay')}>
                  🇮🇳 Razorpay<br/><span style={{ fontSize:11, fontWeight:400 }}>UPI · Cards · Netbanking</span>
                </button>
                <button style={S.methodBtn(paymentMethod==='stripe')} onClick={() => setPaymentMethod('stripe')}>
                  💳 Stripe<br/><span style={{ fontSize:11, fontWeight:400 }}>International Cards</span>
                </button>
              </div>
            </div>

            {error && <div style={{ background:'rgba(255,87,87,0.08)', border:'1px solid rgba(255,87,87,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#CC3333', marginBottom:14 }}>⚠️ {error}</div>}

            <button
              style={{ ...S.btn, background:'linear-gradient(135deg,#B8952A,#F0CC6A)', color:'#fff', opacity: loading?0.7:1 }}
              onClick={paymentMethod === 'razorpay' ? handleRazorpay : handleStripe}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay ₹4,999/month via ${paymentMethod === 'razorpay' ? 'Razorpay' : 'Stripe'} →`}
            </button>

            <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:'#9A9A9A' }}>
              🔒 Secure payment · Cancel anytime · No hidden fees
            </div>

            <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(184,149,42,0.06)', borderRadius:9, border:'1px solid rgba(184,149,42,0.15)', fontSize:12, color:'#7A7A8A' }}>
              <strong style={{ color:'#B8952A' }}>14-day free trial</strong> included. You won't be charged until the trial ends.
            </div>
          </>
        )}
      </div>
    </div>
  );
}