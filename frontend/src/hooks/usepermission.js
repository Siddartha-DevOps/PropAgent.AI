// frontend/src/hooks/usePermission.js
// Convenience hooks for role and permission checks in components
import { useAuth } from '../contexts/AuthContext';
import { hasMinRole, ROLE_LEVELS } from '../constants/roles';

const DEFAULT_PERMISSIONS = {
  superadmin: { export_leads: true, manage_docs: true, manage_team: true, manage_billing: true, admin_panel: true, view_analytics: true, manage_bots: true },
  builder:    { export_leads: true, manage_docs: true, manage_team: true, manage_billing: true, admin_panel: false, view_analytics: true, manage_bots: true },
  manager:    { export_leads: true, manage_docs: true, manage_team: false, manage_billing: false, admin_panel: false, view_analytics: true, manage_bots: false },
  agent:      { export_leads: false, manage_docs: false, manage_team: false, manage_billing: false, admin_panel: false, view_analytics: false, manage_bots: false },
  viewer:     { export_leads: false, manage_docs: false, manage_team: false, manage_billing: false, admin_panel: false, view_analytics: false, manage_bots: false },
};

// ── Check if current user has a specific permission ───────────────────────────
// Usage:  const canExport = usePermission('export_leads');
export function usePermission(permission) {
  const { user } = useAuth();
  if (!user) return false;
  const roleDefault = DEFAULT_PERMISSIONS[user.role]?.[permission] ?? false;
  return user.permissions?.hasOwnProperty(permission)
    ? !!user.permissions[permission]
    : roleDefault;
}

// ── Get all permissions for current user ──────────────────────────────────────
export function usePermissions() {
  const { user } = useAuth();
  if (!user) return {};
  const roleDefaults = DEFAULT_PERMISSIONS[user.role] || {};
  return { ...roleDefaults, ...(user.permissions || {}) };
}

// ── Check if current user has minimum role ────────────────────────────────────
// Usage:  const isManager = useHasRole('manager');  // true for manager, builder, superadmin
export function useHasRole(minRole) {
  const { user } = useAuth();
  if (!user) return false;
  return hasMinRole(user.role, minRole);
}

// ── Get current user's role info ──────────────────────────────────────────────
export function useRole() {
  const { user } = useAuth();
  return {
    role:    user?.role || null,
    level:   ROLE_LEVELS[user?.role] || 0,
    isOwner: user?.role === 'builder' || user?.role === 'superadmin',
    isAdmin: user?.role === 'superadmin',
    isAgent: user?.role === 'agent',
  };
}

// Re-export useAuth for convenience — one import path for all auth hooks
export { useAuth } from '../contexts/AuthContext';