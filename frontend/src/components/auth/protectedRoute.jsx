// frontend/src/components/auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasMinRole } from '../../constants/roles';

// ── ProtectedRoute — redirects to login if not authenticated ──────────────────
export function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!isLoggedIn) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  return children;
}

// ── RoleGuard — renders children only if user has minimum role ────────────────
// Usage:
//   <RoleGuard minRole="manager">  → visible to manager, builder, superadmin
//   <RoleGuard minRole="builder">  → visible to builder, superadmin only
//   <RoleGuard minRole="superadmin" fallback={<p>Admins only</p>}> → custom fallback
export function RoleGuard({ minRole, fallback = null, children }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!hasMinRole(user.role, minRole)) return fallback;
  return children;
}

// ── PermissionGuard — renders children only if user has a specific permission ─
// Usage:
//   <PermissionGuard permission="export_leads">
export function PermissionGuard({ permission, fallback = null, children }) {
  const { user } = useAuth();
  if (!user) return null;

  const DEFAULT_PERMISSIONS = {
    superadmin: { export_leads: true, manage_docs: true, manage_team: true, manage_billing: true, admin_panel: true },
    builder:    { export_leads: true, manage_docs: true, manage_team: true, manage_billing: true, admin_panel: false },
    manager:    { export_leads: true, manage_docs: true, manage_team: false, manage_billing: false, admin_panel: false },
    agent:      { export_leads: false, manage_docs: false, manage_team: false, manage_billing: false, admin_panel: false },
    viewer:     { export_leads: false, manage_docs: false, manage_team: false, manage_billing: false, admin_panel: false },
  };

  const roleDefault = DEFAULT_PERMISSIONS[user.role]?.[permission] ?? false;
  const hasPermission = user.permissions?.hasOwnProperty(permission)
    ? !!user.permissions[permission]
    : roleDefault;

  if (!hasPermission) return fallback;
  return children;
}

// ── OnboardingGuard — redirects un-onboarded builders to setup ────────────────
export function OnboardingGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (user && !user.isOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

// ── Simple spinner used during auth checks ────────────────────────────────────
function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-background-tertiary)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid var(--color-border-tertiary)',
        borderTopColor: '#1a56db',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}