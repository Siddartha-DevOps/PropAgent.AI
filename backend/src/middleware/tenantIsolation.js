// backend/src/middleware/tenantIsolation.js
// Automatically scopes MongoDB queries to the authenticated user's orgId.
// Prevents cross-tenant data leakage without requiring every route to
// manually filter by builderId.
//
// Usage:
//   app.use('/api/leads',  authMiddleware, tenantScope, leadsRouter)
//   app.use('/api/bots',   authMiddleware, tenantScope, botsRouter)
//
// After this middleware, req.tenantFilter = { builderId: req.userId }
// and req.orgFilter = { orgId: req.orgId }

function tenantScope(req, res, next) {
  const role   = req.userRole || 'viewer';
  const userId = req.userId;
  const orgId  = req.orgId;

  // Superadmins can see everything — no filter
  if (role === 'superadmin') {
    req.tenantFilter = {};
    req.orgFilter    = {};
    return next();
  }

  // All other roles are scoped to their own builderId/orgId
  req.tenantFilter = { builderId: userId };
  req.orgFilter    = orgId ? { orgId } : { builderId: userId };

  next();
}

// ── Strict version — also validates that a resource belongs to the current tenant
async function assertOwnership(Model, resourceId, req) {
  const role   = req.userRole || 'viewer';
  if (role === 'superadmin') return true; // bypass for superadmin

  const resource = await Model.findById(resourceId);
  if (!resource) return false;

  const builderId = resource.builderId?.toString();
  return builderId === req.userId;
}

// ── Middleware factory — rejects if resource doesn't belong to tenant ──────────
function ownedBy(Model, idParam = 'id') {
  return async (req, res, next) => {
    try {
      const owned = await assertOwnership(Model, req.params[idParam], req);
      if (!owned) return res.status(403).json({ error: 'Access denied: resource belongs to another tenant.' });
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { tenantScope, assertOwnership, ownedBy };