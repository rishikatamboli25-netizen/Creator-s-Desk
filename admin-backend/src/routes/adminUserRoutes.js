import express from 'express';
import bcrypt from 'bcryptjs';
import { createSessionToken, hashSessionToken } from '../utils/sessionToken.js';
import AdminUser from '../models/AdminUser.js';
import AdminSession from '../models/AdminSession.js';
import AdminInvitation from '../models/AdminInvitation.js';
import Role from '../models/Role.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { recordAudit } from '../services/auditService.js';
import { SETTING_KEYS, getSettingNumber } from '../services/settingsService.js';

const router = express.Router();

const isActiveSuperAdmin = (user) =>
  user?.status === 'ACTIVE' && user?.roleKey === 'SUPER_ADMIN';

const serializeAdminUser = (user, activeSessionCount = 0) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  roleKey: user.roleKey,
  status: user.status,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  activeSessionCount,
  mfaEnabled: Boolean(user.mfaEnabled),
});

const assertValidObjectId = (value) => {
  if (!/^[a-f0-9]{24}$/i.test(String(value || ''))) {
    const error = new Error('Invalid admin user ID.');
    error.status = 400;
    throw error;
  }
};

const assertDifferentFromActor = (req, adminUserId) => {
  if (req.admin?._id?.toString() === String(adminUserId)) {
    const error = new Error('You cannot modify your own admin access from this screen.');
    error.status = 409;
    throw error;
  }
};

const assertRoleExists = async (roleKey) => {
  const role = await Role.findOne({ key: String(roleKey || '').trim().toUpperCase() }).lean();
  if (!role) {
    const error = new Error('Selected admin role does not exist.');
    error.status = 400;
    throw error;
  }
  return role;
};

const assertCanChangeSuperAdmin = async ({ target, nextRoleKey = target.roleKey, nextStatus = target.status }) => {
  const currentlyActiveSuperAdmin = isActiveSuperAdmin(target);
  const willRemainActiveSuperAdmin = nextRoleKey === 'SUPER_ADMIN' && nextStatus === 'ACTIVE';

  if (!currentlyActiveSuperAdmin || willRemainActiveSuperAdmin) return;

  const remaining = await AdminUser.countDocuments({
    _id: { $ne: target._id },
    roleKey: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });

  if (remaining === 0) {
    const error = new Error('At least one active SUPER_ADMIN must remain.');
    error.status = 409;
    throw error;
  }
};

const buildInvitation = async (adminUser, invitedByAdminUserId, roleKey) => {
  const token = createSessionToken();
  const invitationHours = await getSettingNumber(SETTING_KEYS.INVITATION_EXPIRY_HOURS);
  const expiresAt = new Date(Date.now() + invitationHours * 60 * 60 * 1000);

  return {
    token,
    document: {
      adminUserId: adminUser._id,
      invitedByAdminUserId,
      email: adminUser.email,
      tokenHash: hashSessionToken(token),
      roleKey,
      expiresAt,
      status: 'PENDING',
    },
  };
};

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_READ),
  async (_req, res) => {
    try {
      const users = await AdminUser.find({})
        .select('name email roleKey status lastLoginAt createdAt updatedAt mfaEnabled')
        .sort({ createdAt: -1 })
        .lean();

      const [sessionCounts, invitations] = await Promise.all([
        Promise.all(
          users.map(async (user) => [
            user._id.toString(),
            await AdminSession.countDocuments({
              adminUserId: user._id,
              expiresAt: { $gt: new Date() },
            }),
          ])
        ),
        AdminInvitation.find({ status: 'PENDING', expiresAt: { $gt: new Date() } })
          .select('adminUserId email roleKey expiresAt createdAt')
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      const sessionCountMap = Object.fromEntries(sessionCounts);
      const invitationItems = invitations.map((item) => ({
        id: item._id.toString(),
        adminUserId: item.adminUserId.toString(),
        email: item.email,
        roleKey: item.roleKey,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
      }));

      return res.status(200).json({
        users: users.map((user) =>
          serializeAdminUser(user, sessionCountMap[user._id.toString()] || 0)
        ),
        invitations: invitationItems,
      });
    } catch (error) {
      console.error('[CD_ADMIN] Admin user list error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to fetch admin users.',
      });
    }
  }
);

router.post(
  '/invitations',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const roleKey = String(req.body?.roleKey || '').trim().toUpperCase();

      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Admin name must be between 2 and 100 characters.' });
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'A valid admin email is required.' });
      }

      await assertRoleExists(roleKey);

      let adminUser = await AdminUser.findOne({ email });

      if (adminUser && adminUser.status !== 'INVITED') {
        return res.status(409).json({ error: 'An admin account already exists for this email.' });
      }

      if (!adminUser) {
        adminUser = await AdminUser.create({
          name,
          email,
          roleKey,
          status: 'INVITED',
        });
      } else {
        adminUser.name = name;
        adminUser.roleKey = roleKey;
        await adminUser.save();
      }

      await AdminInvitation.updateMany(
        { adminUserId: adminUser._id, status: 'PENDING' },
        { $set: { status: 'REVOKED', revokedAt: new Date() } }
      );

      const { token, document } = await buildInvitation(
        adminUser,
        req.admin._id,
        roleKey
      );

      await AdminInvitation.create(document);

      await recordAudit({
        actorAdminUserId: req.admin._id,
        action: 'admin.user.invited',
        entityType: 'AdminUser',
        entityId: adminUser._id.toString(),
        metadata: {
          email,
          roleKey,
          expiresAt: document.expiresAt,
          reissued: Boolean(adminUser.createdAt && adminUser.createdAt < new Date(Date.now() - 1000)),
        },
        req,
      });

      return res.status(201).json({
        message: 'Admin invitation created.',
        invitation: {
          adminUser: serializeAdminUser(adminUser),
          expiresAt: document.expiresAt,
          invitationUrl: `/activate-admin?token=${encodeURIComponent(token)}`,
        },
      });
    } catch (error) {
      console.error('[CD_ADMIN] Admin invitation error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to create admin invitation.',
      });
    }
  }
);

router.patch(
  '/:adminUserId/role',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  async (req, res) => {
    try {
      assertValidObjectId(req.params.adminUserId);
      assertDifferentFromActor(req, req.params.adminUserId);

      const target = await AdminUser.findById(req.params.adminUserId);
      if (!target) return res.status(404).json({ error: 'Admin user not found.' });
      if (target.status === 'INVITED') {
        return res.status(409).json({ error: 'Use a new invitation to change the role of an invited admin.' });
      }

      const nextRoleKey = String(req.body?.roleKey || '').trim().toUpperCase();
      await assertRoleExists(nextRoleKey);
      await assertCanChangeSuperAdmin({ target, nextRoleKey });

      const previousRoleKey = target.roleKey;
      target.roleKey = nextRoleKey;
      await target.save();

      await recordAudit({
        actorAdminUserId: req.admin._id,
        action: 'admin.user.role.changed',
        entityType: 'AdminUser',
        entityId: target._id.toString(),
        before: { roleKey: previousRoleKey },
        after: { roleKey: nextRoleKey },
        reason: `Administrator role changed from ${previousRoleKey} to ${nextRoleKey}.`,
        req,
      });

      return res.status(200).json({
        admin: serializeAdminUser(target),
      });
    } catch (error) {
      console.error('[CD_ADMIN] Admin role change error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to change admin role.',
      });
    }
  }
);

router.patch(
  '/:adminUserId/status',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  async (req, res) => {
    try {
      assertValidObjectId(req.params.adminUserId);
      assertDifferentFromActor(req, req.params.adminUserId);

      const target = await AdminUser.findById(req.params.adminUserId);
      if (!target) return res.status(404).json({ error: 'Admin user not found.' });
      if (!['ACTIVE', 'SUSPENDED'].includes(req.body?.status)) {
        return res.status(400).json({ error: 'Status must be ACTIVE or SUSPENDED.' });
      }

      const nextStatus = req.body.status;
      await assertCanChangeSuperAdmin({ target, nextStatus });

      const previousStatus = target.status;
      target.status = nextStatus;
      await target.save();

      let revokedSessionCount = 0;
      if (nextStatus === 'SUSPENDED') {
        const result = await AdminSession.deleteMany({ adminUserId: target._id });
        revokedSessionCount = result.deletedCount || 0;
      }

      await recordAudit({
        actorAdminUserId: req.admin._id,
        action: nextStatus === 'ACTIVE' ? 'admin.user.enabled' : 'admin.user.disabled',
        entityType: 'AdminUser',
        entityId: target._id.toString(),
        before: { status: previousStatus },
        after: { status: nextStatus },
        reason: `Administrator account status changed from ${previousStatus} to ${nextStatus}.`,
        metadata: { revokedSessionCount },
        req,
      });

      return res.status(200).json({
        admin: serializeAdminUser(target, nextStatus === 'ACTIVE' ? await AdminSession.countDocuments({ adminUserId: target._id, expiresAt: { $gt: new Date() } }) : 0),
      });
    } catch (error) {
      console.error('[CD_ADMIN] Admin status change error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to change admin status.',
      });
    }
  }
);

router.post(
  '/:adminUserId/revoke-sessions',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_WRITE),
  async (req, res) => {
    try {
      assertValidObjectId(req.params.adminUserId);
      assertDifferentFromActor(req, req.params.adminUserId);

      const target = await AdminUser.findById(req.params.adminUserId).lean();
      if (!target) return res.status(404).json({ error: 'Admin user not found.' });

      const result = await AdminSession.deleteMany({ adminUserId: target._id });

      await recordAudit({
        actorAdminUserId: req.admin._id,
        action: 'admin.user.sessions.revoked',
        entityType: 'AdminUser',
        entityId: target._id.toString(),
        reason: 'All active administrator sessions were revoked by an authorized administrator.',
        metadata: { revokedSessionCount: result.deletedCount || 0 },
        req,
      });

      return res.status(200).json({
        message: 'Admin sessions revoked.',
        revokedSessionCount: result.deletedCount || 0,
      });
    } catch (error) {
      console.error('[CD_ADMIN] Session revoke error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to revoke admin sessions.',
      });
    }
  }
);

export default router;
