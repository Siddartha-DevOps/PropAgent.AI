const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Plan definitions — single source of truth
const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceINR: 0,
    priceUSD: 0,
    period: 'month',
    maxWidgets: 1,
    maxLeads: 50,
    features: ['1 widget', '50 leads/month', 'Basic scoring', 'Email notifications'],
    razorpayPlanId: null,      // Free plan — no payment
    stripePriceId: null,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceINR: 4999,
    priceUSD: 59,
    period: 'month',
    maxWidgets: 5,
    maxLeads: 99999,
    features: ['5 widgets', 'Unlimited leads', 'AI scoring', 'CRM dashboard', 'WhatsApp alerts', 'Analytics'],
    razorpayPlanId: process.env.RAZORPAY_PLAN_GROWTH || 'plan_growth_id',
    stripePriceId: process.env.STRIPE_PRICE_GROWTH   || 'price_growth_id',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceINR: null,
    priceUSD: null,
    period: 'month',
    maxWidgets: 99999,
    maxLeads: 99999,
    features: ['Unlimited widgets', 'Unlimited leads', 'Custom AI', 'White-label', 'HubSpot sync', 'SLA'],
    razorpayPlanId: null,
    stripePriceId: null,
  }
};

// ── GET /api/payment/plans ──────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

// ─────────────────────────────────────────────────
// RAZORPAY — Create order (INR payments)
// ─────────────────────────────────────────────────
router.post('/razorpay/create-order', authMiddleware, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan) return res.status(400).json({ error: 'Invalid plan' });
  if (plan.priceINR === 0) return res.status(400).json({ error: 'Starter plan is free — no payment needed.' });
  if (!process.env.RAZORPAY_KEY_ID) {
    // Demo mode — return mock order
    return res.json({
      demo: true,
      orderId: 'order_demo_' + Date.now(),
      amount: plan.priceINR * 100,
      currency: 'INR',
      keyId: 'rzp_test_demo',
      plan: planId,
      message: 'Demo mode: Add RAZORPAY_KEY_ID to .env for real payments'
    });
  }

  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount: plan.priceINR * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: `receipt_${req.userId}_${Date.now()}`,
      notes: { userId: req.userId, planId }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: planId
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create Razorpay order', details: err.message });
  }
});

// ─────────────────────────────────────────────────
// RAZORPAY — Verify payment after checkout
// ─────────────────────────────────────────────────
router.post('/razorpay/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

  // Demo mode
  if (razorpay_order_id?.startsWith('order_demo_')) {
    await activatePlan(req.userId, planId, 'razorpay_demo');
    return res.json({ success: true, message: 'Demo payment verified', plan: planId });
  }

  try {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    await activatePlan(req.userId, planId, razorpay_payment_id);
    res.json({ success: true, message: 'Payment verified. Plan activated!', plan: planId });
  } catch (err) {
    res.status(500).json({ error: 'Verification error', details: err.message });
  }
});

// ─────────────────────────────────────────────────
// STRIPE — Create checkout session (USD payments)
// ─────────────────────────────────────────────────
router.post('/stripe/create-session', authMiddleware, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan || plan.priceUSD === 0) return res.status(400).json({ error: 'Invalid plan for Stripe' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({
      demo: true,
      sessionUrl: `/payment/success?demo=true&plan=${planId}`,
      message: 'Demo mode: Add STRIPE_SECRET_KEY to .env for real payments'
    });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: plan.stripePriceId,
        quantity: 1,
      }],
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url:  `${process.env.APP_URL || 'http://localhost:3000'}/payment/cancelled`,
      metadata: { userId: req.userId, planId },
    });

    res.json({ sessionUrl: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create Stripe session', details: err.message });
  }
});

// ─────────────────────────────────────────────────
// STRIPE — Webhook (Stripe calls this after payment)
// ─────────────────────────────────────────────────
router.post('/stripe/webhook', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.json({ received: true });

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, planId } = session.metadata;
      await activatePlan(userId, planId, session.payment_intent);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await deactivatePlan(sub.metadata?.userId);
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────
// GET /api/payment/status — Check current subscription
// ─────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId).select('plan planStatus subscriptionEndsAt trialEndsAt maxWidgets maxLeadsPerMonth');
      return res.json({ subscription: user });
    }
  } catch {}
  res.json({ subscription: { plan: req.userPlan || 'starter', planStatus: 'active' } });
});

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
async function activatePlan(userId, planId, paymentRef) {
  const plan = PLANS[planId];
  if (!plan) return;

  const subscriptionEndsAt = new Date();
  subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (user) {
        user.plan = planId;
        user.planStatus = 'active';
        user.subscriptionEndsAt = subscriptionEndsAt;
        user.lastPaymentAt = new Date();
        user.applyPlanLimits();
        await user.save();
        console.log(`✅ Plan ${planId} activated for user ${userId}`);
      }
    }
  } catch (err) {
    console.error('Failed to activate plan:', err.message);
  }
}

async function deactivatePlan(userId) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, { plan: 'starter', planStatus: 'cancelled' });
    }
  } catch {}
}

module.exports = router;