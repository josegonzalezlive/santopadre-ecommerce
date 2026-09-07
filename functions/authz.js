const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const ADMIN_ROLES = ['superadmin', 'admin', 'cashier', 'marketing'];
const HARDCODED_SUPERADMIN_EMAILS = [
  'josegonzalez.private@gmail.com',
  'santopadrevzla@gmail.com'
];

function roleFromToken(token = {}) {
  const tokenRoles = Array.isArray(token.roles) ? token.roles : [];
  if (token.role === 'superadmin' || tokenRoles.includes('superadmin')) return 'superadmin';
  if (token.role === 'admin' || tokenRoles.includes('admin')) return 'admin';
  if (token.role === 'cashier' || tokenRoles.includes('cashier')) return 'cashier';
  if (token.role === 'marketing' || tokenRoles.includes('marketing')) return 'marketing';
  return null;
}

async function getAdminRole(request) {
  const token = request.auth?.token || {};
  const tokenRole = roleFromToken(token);
  if (tokenRole) return tokenRole;

  const email = token.email;
  if (!email) return null;
  if (HARDCODED_SUPERADMIN_EMAILS.includes(email)) return 'superadmin';

  const snap = await getFirestore().doc(`admins/${email}`).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return ADMIN_ROLES.includes(role) ? role : 'admin';
}

async function isAdmin(request) {
  return Boolean(await getAdminRole(request));
}

async function hasAdminRole(request, allowedRoles = ['superadmin', 'admin']) {
  const role = await getAdminRole(request);
  return Boolean(role && allowedRoles.includes(role));
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return request.auth;
}

async function requireRole(request, allowedRoles = ['superadmin', 'admin']) {
  const auth = requireAuth(request);
  const role = await getAdminRole(request);
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Permisos insuficientes para esta operacion');
  }
  return { auth, role };
}

module.exports = {
  ADMIN_ROLES,
  HARDCODED_SUPERADMIN_EMAILS,
  roleFromToken,
  getAdminRole,
  isAdmin,
  hasAdminRole,
  requireAuth,
  requireRole
};
