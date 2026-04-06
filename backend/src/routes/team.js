/**
 * team.js (Routes)
 * -----------------
 * Team Access Management for PropAgent.AI.
 * Builders on Pro/Enterprise plans can invite sales agents to access
 * their CRM dashboard with role-based permissions.
 *
 * FILE: backend/src/routes/team.js
 * STATUS: NEW
 *
 * Endpoints:
 *   POST   /api/team/invite             Invite an agent via email
 *   GET    /api/team/members            List all team members
 *   PATCH  /api/team/members/:id        Update role/permissions
 *   DELETE /api/team/members/:id        Remove a team member
 *   POST   /api/team/accept/:token      Agent accepts invite (public)
 *   GET    /api/team/invite/:token      Validate invite token (public)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');
const emailService = require('../services/emailService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// All management routes require auth
router.use(authMiddleware);

// ─── POST /api/team/invite ────────────────────────────────────────────────────
/**
 * Send an invitation email to a new sales agent.
 * The agent clicks the link in the email to set up their account.
 *
 * Body: { email, name, role, permissions }
 * Role options: 'agent' | 'manager' | 'viewer'
 */
router.post('/invite', requirePlan('pro'), async (req, res) => {
  const { email, name, role = 'agent', permissions } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const validRoles = ['agent', 'manager', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Use: agent | manager | viewer' });
  }

  try {
    // Resolve MongoDB builderId → PostgreSQL builder UUID
    const builderRow = await pool.query(
      'SELECT id, brand_name FROM builders WHERE mongo_id = $1',
      [req.user._id.toString()]
    );

    if (!builderRow.rows.length) {
      return res.status(404).json({ error: 'Builder not found in analytics DB.' });
    }

    const { id: builderId, brand_name: brandName } = builderRow.rows[0];

    // Check if already a member
    const existing = await pool.query(
      'SELECT id, status FROM team_members WHERE builder_id = $1 AND email = $2',
      [builderId, email.toLowerCase()]
    );

    if (existing.rows.length && existing.rows[0].status === 'active') {
      return res.status(409).json({ error: 'This email is already an active team member.' });
    }

    // Generate a secure invite token (expires in 72 hours)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Default permissions based on role
    const defaultPerms = {
      agent:   { view_leads: true,  export_leads: false, manage_docs: false, manage_team: false },
      manager: { view_leads: true,  export_leads: true,  manage_docs: true,  manage_team: false },
      viewer:  { view_leads: true,  export_leads: false, manage_docs: false, manage_team: false },
    };

    const finalPerms = permissions || defaultPerms[role];

    // Upsert (re-invite if previously invited but not accepted)
    await pool.query(`
      INSERT INTO team_members (builder_id, email, name, role, status, invite_token, invite_expires, permissions)
      VALUES ($1, $2, $3, $4, 'invited', $5, $6, $7)
      ON CONFLICT (builder_id, email) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'invited',
        invite_token = EXCLUDED.invite_token,
        invite_expires = EXCLUDED.invite_expires,
        permissions = EXCLUDED.permissions
    `, [builderId, email.toLowerCase(), name, role, inviteToken, inviteExpires, JSON.stringify(finalPerms)]);

    // Send the invitation email
    const inviteUrl = `${process.env.FRONTEND_URL}/team/accept/${inviteToken}`;
    await emailService.sendTeamInvite({
      to: email,
      name: name || email,
      inviterBrand: brandName || 'a real estate developer',
      role,
      inviteUrl,
    });

    return res.status(201).json({
      message: `Invitation sent to ${email}.`,
      inviteExpires,
    });
  } catch (err) {
    console.error('[Team] Invite error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/team/members ────────────────────────────────────────────────────
/**
 * List all team members for the authenticated builder.
 */
router.get('/members', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        tm.id, tm.email, tm.name, tm.role, tm.status,
        tm.permissions, tm.last_login, tm.created_at,
        tm.invite_expires
      FROM team_members tm
      JOIN builders b ON b.id = tm.builder_id
      WHERE b.mongo_id = $1
      ORDER BY tm.created_at DESC
    `, [req.user._id.toString()]);

    return res.json({ members: rows, total: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/team/members/:id ─────────────────────────────────────────────
/**
 * Update a team member's role or permissions.
 * Body: { role?, permissions?, status? }
 */
router.patch('/members/:id', async (req, res) => {
  const { role, permissions, status } = req.body;

  try {
    const { rowCount } = await pool.query(`
      UPDATE team_members
      SET
        role        = COALESCE($1, role),
        permissions = COALESCE($2, permissions),
        status      = COALESCE($3, status)
      WHERE id = $4
        AND builder_id = (SELECT id FROM builders WHERE mongo_id = $5)
    `, [
      role,
      permissions ? JSON.stringify(permissions) : null,
      status,
      req.params.id,
      req.user._id.toString(),
    ]);

    if (!rowCount) return res.status(404).json({ error: 'Member not found.' });
    return res.json({ message: 'Team member updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/team/members/:id ────────────────────────────────────────────
/**
 * Remove a team member. They immediately lose dashboard access.
 */
router.delete('/members/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM team_members
      WHERE id = $1
        AND builder_id = (SELECT id FROM builders WHERE mongo_id = $2)
    `, [req.params.id, req.user._id.toString()]);

    if (!rowCount) return res.status(404).json({ error: 'Member not found.' });
    return res.json({ message: 'Team member removed.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/team/invite/:token (PUBLIC — no auth needed) ───────────────────
/**
 * Validate an invite token before showing the acceptance form.
 * Returns: { valid, email, builderName, role, expired }
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tm.email, tm.name, tm.role, tm.invite_expires, b.brand_name
      FROM team_members tm
      JOIN builders b ON b.id = tm.builder_id
      WHERE tm.invite_token = $1
    `, [req.params.token]);

    if (!rows.length) {
      return res.status(404).json({ valid: false, error: 'Invalid invite link.' });
    }

    const invite = rows[0];
    const expired = new Date(invite.invite_expires) < new Date();

    return res.json({
      valid: !expired,
      expired,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      builderName: invite.brand_name,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/team/accept/:token (PUBLIC) ────────────────────────────────────
/**
 * Agent accepts the invite, sets their password, and activates their account.
 * Body: { name, password, mongoUserId (set after they register in MongoDB auth) }
 */
router.post('/accept/:token', async (req, res) => {
  const { name, mongoUserId } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT id, invite_expires FROM team_members WHERE invite_token = $1 AND status = $2',
      [req.params.token, 'invited']
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invalid or already used invite token.' });
    }

    if (new Date(rows[0].invite_expires) < new Date()) {
      return res.status(410).json({ error: 'This invite link has expired. Ask your admin to re-invite you.' });
    }

    await pool.query(`
      UPDATE team_members
      SET status = 'active', name = COALESCE($1, name),
          mongo_user_id = $2, invite_token = NULL
      WHERE id = $3
    `, [name, mongoUserId, rows[0].id]);

    return res.json({ message: 'Welcome to the team! You can now log in.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;