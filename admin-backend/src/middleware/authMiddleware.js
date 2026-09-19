import AdminSession from '../models/AdminSession.js';
import AdminUser from '../models/AdminUser.js';
import Role from '../models/Role.js';
import { config } from '../config/index.js';
import { hashSessionToken } from '../utils/sessionToken.js';

const loadSession = async (token) => {
  if (!token) return null;

  const session = await AdminSession.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const adminUser = await AdminUser.findById(session.adminUserId).lean();
  if (!adminUser || adminUser.status !== 'ACTIVE') return null;

  const role = await Role.findOne({ key: adminUser.roleKey }).lean();
  if (!role) return null;

  return { session, adminUser, role };
};

export const requireAdminAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[config.cookieName];
    const context = await loadSession(token);

    if (!context) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }

    req.admin = context.adminUser;
    req.adminRole = context.role;
    req.adminSession = context.session;
    next();
  } catch (error) {
    console.error('[Admin Auth] Authentication error:', error.message);
    return res.status(500).json({ error: 'Unable to authenticate admin session.' });
  }
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.adminRole?.permissions?.includes(permission)) {
    return res.status(403).json({ error: 'You do not have permission for this action.' });
  }
  next();
};

export { loadSession };
