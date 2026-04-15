// backend/src/middleware/rbac.js
// Role-based access control for PropAgent.AI
//
// Role hierarchy (higher index = more access):
//   viewer → agent → manager → builder → superadmin
//
// Usage examples:
//   router.get('/leads', authMiddleware, requireRole('agent'), handler)
//   router.delete('/bots/:id', authMiddleware, requireRole('builder'), handler)
//   router.get('/admin', authMiddleware, requireRole('superadmin'), handler)
//   router.get('/crm', authMiddleware, requirePermission('view_leads'), handler)

const ROLE_LEVELS = {
  viewer:     10,
  agent:      20,
  manager:    30,
  builder:    40,
  superadmin: 100,
};

// ── Default permission matrix per role ────────────────────────────────────────
const DEFAULT_PERMISSIONS = {
  superadmin: {
    view_leads: true, export_leads: true, manage_docs: true,
    manage_team: true, manage_bots: true, manage_billing: true,
    view_analytics: true, admin_panel: true, impersonate: true,
  },
  builder: {
    view_leads: true, export_leads: true, manage_docs: true,
    manage_team: true, manage_bots: true, manage_billing: true,
    view_analytics: true, admin_panel: false, impersonate: false,
  },
  manager: {
    view_leads: true, export_leads: true, manage_docs: true,
    manage_team: false, manage_bots: false, manage_billing: false,
    view_analytics: true, admin_panel: false, impersonate: false,
  },
  agent: {
    view_leads: true, export_leads: false, manage_docs: false,
    manage_team: false, manage_bots: false, manage_billing: false,
    view_analytics: false, admin_panel: false, impersonate: false,
  },
  viewer: {
    view_leads: true, export_leads: false, manage_docs: false,
    manage_team: false, manage_bots: false, manage_billing: false,
    view_analytics: false, admin_panel: false, impersonate: false,
  },
};

// ── Require minimum role level ─────────────────────────────────────────────────
function requireRole(minRole) {
  return (req, res, next) => {
    const userRole  = req.userRole || 'viewer';
    const userLevel = ROLE_LEVELS[userRole]  || 0;
    const minLevel  = ROLE_LEVELS[minRole]   || 0;

    if (userLevel >= minLevel) return next();

    return res.status(403).json({
      error:        `This action requires the '${minRole}' role or higher.`,
      currentRole:  userRole,
      requiredRole: minRole,
    });
  };
}

// ── Require specific permission (with per-user override support) ───────────────
function requirePermission(permission) {
  return async (req, res, next) => {
    const userRole = req.userRole || 'viewer';

    // Fetch user to get permission overrides
    let userPermissions = {};
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const User = require('../models/User');
        const user = await User.findById(req.userId).select('permissions role');
        userPermissions = user?.permissions || {};
      }
    } catch (_) {}

    // Permission override takes precedence over role default
    const roleDefault    = DEFAULT_PERMISSIONS[userRole]?.[permission] ?? false;
    const hasPermission  = userPermissions.hasOwnProperty(permission)
      ? !!userPermissions[permission]
      : roleDefault;

    if (hasPermission) return next();

    return res.status(403).json({
      error:      `Permission denied: '${permission}' required.`,
      permission,
    });
  };
}

// ── Superadmin gate (convenience alias) ───────────────────────────────────────
const adminGate = requireRole('superadmin');

// ── Check if user can access resources for a given orgId ──────────────────────
// Superadmins bypass tenant restrictions
function requireOrgAccess(req, res, next) {
  const userRole = req.userRole || 'viewer';
  if (userRole === 'superadmin') return next();

  const userOrg    = req.orgId;
  const targetOrg  = req.params.orgId || req.body.orgId || req.query.orgId;

  if (targetOrg && userOrg !== targetOrg) {
    return res.status(403).json({ error: 'Access denied: cross-tenant operation.' });
  }
  next();
}

// ── Export permission check for use in route handlers (non-middleware) ─────────
function hasPermission(userRole, permission, permissionOverrides = {}) {
  const roleDefault = DEFAULT_PERMISSIONS[userRole]?.[permission] ?? false;
  return permissionOverrides.hasOwnProperty(permission)
    ? !!permissionOverrides[permission]
    : roleDefault;
}

module.exports = {
  requireRole,
  requirePermission,
  requireOrgAccess,
  adminGate,
  hasPermission,
  DEFAULT_PERMISSIONS,
  ROLE_LEVELS,
};