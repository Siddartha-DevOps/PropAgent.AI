// frontend/src/constants/roles.js

export const ROLES = {
  SUPERADMIN: 'superadmin',
  BUILDER:    'builder',
  MANAGER:    'manager',
  AGENT:      'agent',
  VIEWER:     'viewer',
};

export const ROLE_LEVELS = {
  viewer:     10,
  agent:      20,
  manager:    30,
  builder:    40,
  superadmin: 100,
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  builder:    'Builder (Owner)',
  manager:    'Manager',
  agent:      'Sales Agent',
  viewer:     'Viewer',
};

export const PERMISSIONS = {
  VIEW_LEADS:      'view_leads',
  EXPORT_LEADS:    'export_leads',
  MANAGE_DOCS:     'manage_docs',
  MANAGE_TEAM:     'manage_team',
  MANAGE_BOTS:     'manage_bots',
  MANAGE_BILLING:  'manage_billing',
  VIEW_ANALYTICS:  'view_analytics',
  ADMIN_PANEL:     'admin_panel',
};

// Minimum role required per permission
export const PERMISSION_ROLE_MAP = {
  view_leads:     'agent',
  export_leads:   'manager',
  manage_docs:    'manager',
  manage_team:    'builder',
  manage_bots:    'builder',
  manage_billing: 'builder',
  view_analytics: 'manager',
  admin_panel:    'superadmin',
};

export function hasMinRole(userRole, minRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[minRole] || 0);
}