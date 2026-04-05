/**
 * PropAgent.AI — Payment Flow Tester
 * Run: node backend/scripts/test-payment.js
 * 
 * Tests the full payment flow without a real browser.
 * Use this to verify everything works before pitching builders.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE = `http://localhost:${process.env.PORT || 3001}/api`;

async function run() {
  console.log('\n🧪 PropAgent.AI Payment Flow Test\n');
  console.log('Base URL:', BASE);
  console.log('Mode:', process.env.NODE_ENV || 'development');
  console.log('Razorpay:', process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_your') ? '❌ Demo mode' : '✅ Real key');
  console.log('Stripe:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_your') ? '❌ Demo mode' : '✅ Real key');
  console.log('');

  let token = '';
  let userId = '';

  // ── Step 1: Register test user ──
  try {
    console.log('1. Registering test user...');
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Builder',
        email: `test_${Date.now()}@propagent.test`,
        password: 'Test1234!',
        company: 'Test Realty',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    token = data.token;
    userId = data.user?.id || data.user?._id;
    console.log('   ✅ Registered. User ID:', userId);
    console.log('   ✅ Plan:', data.user?.plan);
  } catch (err) {
    console.log('   ❌ Register failed:', err.message);
    return;
  }

  // ── Step 2: Check current plan ──
  try {
    console.log('\n2. Checking payment status...');
    const res = await fetch(`${BASE}/payment/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log('   ✅ Plan:', data.subscription?.plan);
    console.log('   ✅ Status:', data.subscription?.planStatus);
  } catch (err) {
    console.log('   ❌ Status check failed:', err.message);
  }

  // ── Step 3: Create Razorpay order ──
  try {
    console.log('\n3. Creating Razorpay order for Growth plan...');
    const res = await fetch(`${BASE}/payment/razorpay/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: 'growth' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.demo) {
      console.log('   ℹ️  Demo mode order created:', data.orderId);
      console.log('   ℹ️  To use real Razorpay: add rzp_test_ keys to .env');

      // Test demo verification
      console.log('\n4. Verifying demo payment...');
      const vRes = await fetch(`${BASE}/payment/razorpay/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          razorpay_order_id: data.orderId,
          razorpay_payment_id: 'pay_demo_' + Date.now(),
          razorpay_signature: 'demo_signature',
          planId: 'growth',
        }),
      });
      const vData = await vRes.json();
      if (!vRes.ok) throw new Error(vData.error);
      console.log('   ✅ Demo payment verified:', vData.message);
    } else {
      console.log('   ✅ Real Razorpay order created:', data.orderId);
      console.log('   ✅ Amount: ₹' + (data.amount / 100));
      console.log('   ℹ️  Open the order in Razorpay dashboard to verify');
    }
  } catch (err) {
    console.log('   ❌ Razorpay failed:', err.message);
  }

  // ── Step 4: Check plan after payment ──
  try {
    console.log('\n5. Verifying plan activation...');
    const res = await fetch(`${BASE}/payment/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const plan = data.subscription?.plan;
    console.log('   ' + (plan === 'growth' ? '✅' : '❌') + ' Plan:', plan);
    console.log('   ✅ Max widgets:', data.subscription?.maxWidgets);
    console.log('   ✅ Expires:', data.subscription?.subscriptionEndsAt
      ? new Date(data.subscription.subscriptionEndsAt).toDateString()
      : 'N/A');
  } catch (err) {
    console.log('   ❌ Status check failed:', err.message);
  }

  // ── Step 5: Check plans list ──
  try {
    console.log('\n6. Fetching plan catalog...');
    const res = await fetch(`${BASE}/payment/plans`);
    const data = await res.json();
    console.log('   ✅ Plans available:', data.plans?.map(p => p.name).join(', '));
  } catch (err) {
    console.log('   ❌ Plans fetch failed:', err.message);
  }

  console.log('\n✅ Payment flow test complete!\n');
  console.log('Next steps:');
  console.log('  1. Add real Razorpay test keys to backend/.env');
  console.log('  2. Add real Stripe test keys to backend/.env');
  console.log('  3. Run: node scripts/test-payment.js');
  console.log('  4. Deploy to Railway + Vercel\n');
}

run().catch(console.error);