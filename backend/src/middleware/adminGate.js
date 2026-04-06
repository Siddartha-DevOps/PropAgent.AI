/**
 * adminGate.js
 * -------------
 * Middleware: Restricts access to super-admin routes only.
 * Checks req.user.role === 'superadmin' (set in MongoDB User.js).
 *
 * FILE: backend/src/middleware/adminGate.js
 * STATUS: NEW
 *
 * Usage: router.use(authMiddleware, adminGate);
 */

module.exports = function adminGate(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Access denied. Super-admin privileges required.',
    });
  }

  next();
};