// backend/src/routes/oauth.js
// Google OAuth 2.0 — Passport.js strategy
// Flow:
//   1. Browser → GET /api/auth/oauth/google         → redirected to Google
//   2. Google → GET /api/auth/oauth/google/callback → issue tokens, redirect to FE
const express    = require('express');
const router     = express.Router();
const passport   = require('../config/passport');
const tokenService = require('../services/tokenService');
const authService  = require('../services/authService');

const FRONTEND_URL  = process.env.FRONTEND_URL  || 'http://localhost:3000';
const FRONTEND_AUTH = `${FRONTEND_URL}/auth/google/callback`;

// ── Initiate Google OAuth ──────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', {
    scope:  ['profile', 'email'],
    session: false,
    prompt: 'select_account',
  })
);

// ── Google callback ───────────────────────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', {
    session:      false,
    failureRedirect: `${FRONTEND_AUTH}?error=oauth_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      const accessToken = tokenService.signAccessToken(user);
      const { rawToken } = await tokenService.issueRefreshToken(user, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      tokenService.setRefreshCookie(res, rawToken);
      await authService.auditLog(user._id, 'OAUTH_LOGIN', req, { provider: 'google' });

      // Redirect to frontend with access token as query param
      // Frontend exchanges this for the in-memory token and discards the URL
      const nextStep = user.isOnboarded ? 'dashboard' : 'onboarding';
      res.redirect(`${FRONTEND_AUTH}?token=${accessToken}&step=${nextStep}`);
    } catch (err) {
      console.error('[OAuth callback]', err.message);
      res.redirect(`${FRONTEND_AUTH}?error=${encodeURIComponent(err.message)}`);
    }
  }
);

module.exports = router;