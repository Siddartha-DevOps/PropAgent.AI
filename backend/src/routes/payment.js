const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// ── Plan definitions ──────────────────────────────────────────
const PLANS = {
  starter: {
    id: 'starter', name: 'Starter', priceINR: 0, priceUSD: 0,
    razorpayPlanId: null, stripePriceId: null,
    features: ['1 widget', '50 leads/month', 'Basic scoring'],
  },
  growth: {
    id: 'growth', name: 'Growth', priceINR: 4999, priceUSD: 59,
    razorpayPlanId: process.env.RAZORPAY_PLAN_GROWTH || null,
    stripePriceId: process.env.STRIPE_PRICE_GROWTH || null,
    features: ['5 widgets', 'Unlimited leads', 'CRM dashboard', 'Analytics'],
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', priceINR: null, priceUSD: null,
    razorpayPlanId: null, stripePriceId: null,
    features: ['Unlimited', 'Custom AI', 'White-label', 'CRM sync'],
  },
};

// ── GET /api/payment/plans ────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

// ── GET /api/payment/status ───────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(req.userId)
        .select('plan planStatus subscriptionEndsAt trialEndsAt maxWidgets maxLeadsPerMonth lastPaymentAt');
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({
        subscription: {
          plan: user.plan,
          planStatus: user.planStatus,
          subscriptionEndsAt: user.subscriptionEndsAt,
          maxWidgets: user.maxWidgets,
          maxLeadsPerMonth: user.maxLeadsPerMonth,
          lastPaymentAt: user.lastPaymentAt,
          isActive: isPlanActive(user),
        }
      });
    }
  } catch (err) {
    console.error('Payment status error:', err.message);
  }
  res.json({ subscription: { plan: req.userPlan || 'starter', planStatus: 'active', isActive: true } });
});

// ── POST /api/payment/razorpay/create-order ───────────────────
router.post('/razorpay/create-order', authMiddleware, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan) return res.status(400).json({ error: 'Invalid plan ID' });
  if (plan.priceINR === 0) return res.status(400).json({ error: 'Starter plan is free — no payment needed.' });
  if (plan.priceINR === null) return res.status(400).json({ error: 'Contact sales for Enterprise pricing.' });

  // ── DEMO MODE (no real keys configured) ──
  const isDemoMode = !process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID === 'rzp_test_your_key_id' ||
    process.env.RAZORPAY_KEY_ID.trim() === '';

  if (isDemoMode) {
    console.log('⚠️  Razorpay demo mode — no real key configured');
    return res.json({
      demo: true,
      orderId: 'order_demo_' + Date.now(),
      amount: plan.priceINR * 100,
      currency: 'INR',
      keyId: 'rzp_test_demo',
      plan: planId,
      message: 'DEMO MODE: Add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to backend/.env for live payments',
    });
  }

  try {
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await rzp.orders.create({
      amount: plan.priceINR * 100,
      currency: 'INR',
      receipt: `pa_rcpt_${req.userId.toString().slice(-6)}_${Date.now()}`,
      notes: { userId: req.userId.toString(), planId, productName: 'PropAgent.AI' },
    });

    console.log(`✅ Razorpay order created: ${order.id} for plan: ${planId}`);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: planId,
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err.message);
    res.status(500).json({ error: 'Failed to create payment order', details: err.message });
  }
});

// ── POST /api/payment/razorpay/verify ────────────────────────
router.post('/razorpay/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !planId) {
    return res.status(400).json({ error: 'Missing required payment fields' });
  }

  // ── DEMO MODE ──
  if (razorpay_order_id.startsWith('order_demo_')) {
    console.log(`✅ Demo payment verified for plan: ${planId}, user: ${req.userId}`);
    await activatePlan(req.userId, planId, 'demo_payment_' + Date.now());
    return res.json({ success: true, message: 'Demo payment verified. Plan activated!', plan: planId });
  }

  // ── REAL VERIFICATION ──
  try {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error('RAZORPAY_KEY_SECRET not configured');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Razorpay signature mismatch');
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    await activatePlan(req.userId, planId, razorpay_payment_id);
    console.log(`✅ Razorpay payment verified: ${razorpay_payment_id}, plan: ${planId}`);
    res.json({ success: true, message: 'Payment verified! Plan activated successfully.', plan: planId });
  } catch (err) {
    console.error('Razorpay verify error:', err.message);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
});

// ── POST /api/payment/stripe/create-session ──────────────────
router.post('/stripe/create-session', authMiddleware, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan || !plan.priceUSD) {
    return res.status(400).json({ error: 'Invalid plan for Stripe payment' });
  }

  // ── DEMO MODE ──
  const isDemoMode = !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key' ||
    process.env.STRIPE_SECRET_KEY.trim() === '';

  if (isDemoMode) {
    console.log('⚠️  Stripe demo mode — no real key configured');
    return res.json({
      demo: true,
      sessionUrl: null,
      message: 'DEMO MODE: Add STRIPE_SECRET_KEY to backend/.env for live payments',
    });
  }

  if (!plan.stripePriceId) {
    return res.status(400).json({
      error: 'Stripe price ID not configured for this plan',
      hint: 'Add STRIPE_PRICE_GROWTH=price_xxx to backend/.env'
    });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Find or create Stripe customer
    let customerId;
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const User = require('../models/User');
        const user = await User.findById(req.userId);
        if (user?.stripeCustomerId) {
          customerId = user.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email: req.userEmail,
            name: user?.name,
            metadata: { userId: req.userId.toString(), platform: 'PropAgent.AI' }
          });
          customerId = customer.id;
          await User.findByIdAndUpdate(req.userId, { stripeCustomerId: customerId });
        }
      }
    } catch {}

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}?payment=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}?payment=cancelled`,
      metadata: { userId: req.userId.toString(), planId },
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: req.userId.toString(), planId }
      },
    });

    console.log(`✅ Stripe session created: ${session.id} for plan: ${planId}`);
    res.json({ sessionUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe session error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe session', details: err.message });
  }
});

// ── POST /api/payment/stripe/webhook ─────────────────────────
// NOTE: This route needs raw body — configured in server.js
router.post('/stripe/webhook', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({ received: true, note: 'Stripe not configured' });
  }

  let event;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    }
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, planId } = session.metadata || {};
        if (userId && planId) {
          await activatePlan(userId, planId, session.payment_intent || session.id);
          console.log(`✅ Stripe checkout completed: plan ${planId} for user ${userId}`);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const sub = invoice.subscription;
        if (sub && typeof sub === 'object' && sub.metadata?.userId) {
          // Extend subscription by 1 month
          await extendSubscription(sub.metadata.userId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await deactivatePlan(userId);
          console.log(`⚠️  Subscription cancelled for user ${userId}`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`⚠️  Payment failed for customer: ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

// ── POST /api/payment/activate-demo ──────────────────────────
// For testing payment flow without real payment gateways
router.post('/activate-demo', authMiddleware, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Demo activation not available in production' });
  }
  const { planId } = req.body;
  if (!PLANS[planId]) return res.status(400).json({ error: 'Invalid plan' });

  await activatePlan(req.userId, planId, 'demo_test_' + Date.now());
  res.json({ success: true, message: `Plan ${planId} activated in demo mode`, plan: planId });
});

// ── HELPERS ───────────────────────────────────────────────────
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
      if (!user) { console.error(`User ${userId} not found for plan activation`); return; }

      user.plan = planId;
      user.planStatus = 'active';
      user.subscriptionEndsAt = subscriptionEndsAt;
      user.lastPaymentAt = new Date();

      if (typeof user.applyPlanLimits === 'function') {
        user.applyPlanLimits();
      } else {
        // Fallback if method not available
        const limits = { starter: { maxWidgets: 1, maxLeadsPerMonth: 50 }, growth: { maxWidgets: 5, maxLeadsPerMonth: 99999 }, enterprise: { maxWidgets: 99999, maxLeadsPerMonth: 99999 } };
        const l = limits[planId] || limits.starter;
        user.maxWidgets = l.maxWidgets;
        user.maxLeadsPerMonth = l.maxLeadsPerMonth;
      }

      await user.save();
      console.log(`✅ Plan ${planId} activated for user ${userId} until ${subscriptionEndsAt.toDateString()}`);
    }
  } catch (err) {
    console.error('activatePlan DB error:', err.message);
  }
}

async function extendSubscription(userId) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) return;
      const newEnd = new Date(user.subscriptionEndsAt || new Date());
      newEnd.setMonth(newEnd.getMonth() + 1);
      user.subscriptionEndsAt = newEnd;
      user.planStatus = 'active';
      await user.save();
    }
  } catch (err) {
    console.error('extendSubscription error:', err.message);
  }
}

async function deactivatePlan(userId) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        plan: 'starter', planStatus: 'cancelled',
        maxWidgets: 1, maxLeadsPerMonth: 50,
      });
    }
  } catch (err) {
    console.error('deactivatePlan error:', err.message);
  }
}

function isPlanActive(user) {
  if (user.plan === 'starter') return true;
  if (!user.subscriptionEndsAt) return false;
  return new Date(user.subscriptionEndsAt) > new Date();
}

module.exports = router;