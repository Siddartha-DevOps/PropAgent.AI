// backend/src/routes/roles.js
// Role management endpoints (builder + superadmin only)
//
// GET    /api/roles/members          — list all team members with roles
// PATCH  /api/roles/members/:id      — change a member's role
// PATCH  /api/roles/permissions/:id  — override individual permissions
// GET    /api/roles/audit            — auth audit log for this org
const express = require('express');
const router  = express.Router();
const { Pool }  = require('pg');
const User      = require('../models/User');
const { authMiddleware }  = require('../middleware/auth');
const { requireRole }     = require('../middleware/rbac');
const { tenantScope }     = require('../middleware/tenantIsolation');
const authService         = require('../services/authService');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

router.use(authMiddleware, tenantScope);

// ── GET /api/roles/members ────────────────────────────────────────────────────
router.get('/members', requireRole('manager'), async (req, res) => {
  try {
    const filter = req.userRole === 'superadmin'
      ? {}
      : { orgId: req.orgId };

    const members = await User.find(filter)
      .select('_id name email role orgId avatarUrl lastLoginAt createdAt isActive permissions')
      .sort({ createdAt: -1 });

    res.json({ members, total: members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/roles/members/:id — change role ────────────────────────────────
router.patch('/members/:id', requireRole('builder'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['viewer', 'agent', 'manager', 'builder'];

  // Only superadmin can assign superadmin role
  if (role === 'superadmin' && req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmins can assign the superadmin role.' });
  }

  if (!validRoles.includes(role) && role !== 'superadmin') {
    return res.status(400).json({ error: `Invalid role. Use: ${validRoles.join(' | ')}` });
  }

  try {
    // Builders can only change roles within their own org
    const filter = req.userRole === 'superadmin'
      ? { _id: req.params.id }
      : { _id: req.params.id, orgId: req.orgId };

    const user = await User.findOneAndUpdate(filter, { role }, { new: true }).select('_id name email role');
    if (!user) return res.status(404).json({ error: 'Member not found in your organisation.' });

    await authService.auditLog(req.userId, 'ROLE_CHANGE', req, {
      targetUserId: req.params.id,
      newRole: role,
    });

    res.json({ member: user, message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/roles/permissions/:id — fine-grained permission overrides ──────
router.patch('/permissions/:id', requireRole('builder'), async (req, res) => {
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'permissions must be an object' });
  }

  try {
    const filter = req.userRole === 'superadmin'
      ? { _id: req.params.id }
      : { _id: req.params.id, orgId: req.orgId };

    const user = await User.findOneAndUpdate(
      filter,
      { $set: { permissions } },
      { new: true }
    ).select('_id name email role permissions');

    if (!user) return res.status(404).json({ error: 'Member not found.' });

    await authService.auditLog(req.userId, 'PERMISSION_CHANGE', req, {
      targetUserId: req.params.id,
      permissions,
    });

    res.json({ member: user, message: 'Permissions updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/roles/audit — recent auth audit log for the org ──────────────────
router.get('/audit', requireRole('builder'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let condition = '';
    let params    = [parseInt(limit), offset];

    if (req.userRole !== 'superadmin') {
      // Get all user IDs in this org
      const orgUsers = await User.find({ orgId: req.orgId }).select('_id');
      const ids = orgUsers.map((u) => u._id.toString());
      condition = `WHERE mongo_user_id = ANY($3::text[])`;
      params.push(ids);
    }

    const { rows } = await pool.query(
      `SELECT mongo_user_id, action, ip_address, user_agent, metadata, created_at
       FROM auth_audit_logs
       ${condition}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    res.json({ logs: rows, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;