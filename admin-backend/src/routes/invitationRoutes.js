import express from 'express';
import bcrypt from 'bcryptjs';
import AdminInvitation from '../models/AdminInvitation.js';
import AdminUser from '../models/AdminUser.js';
import Role from '../models/Role.js';
import { hashSessionToken } from '../utils/sessionToken.js';
import { recordAudit } from '../services/auditService.js';
import { SETTING_KEYS, getSettingNumber } from '../services/settingsService.js';

const router = express.Router();

const getPendingInvitation = async (token) => {
  if (!token) return null;

  const invitation = await AdminInvitation.findOne({
    tokenHash: hashSessionToken(token),
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');

  if (!invitation) return null;

  return invitation;
};

router.get('/:token', async (req, res) => {
  try {
    const invitation = await getPendingInvitation(req.params.token);

    if (!invitation) {
      return res.status(410).json({
        error: 'This admin invitation is invalid or has expired.',
      });
    }

    const [adminUser, role] = await Promise.all([
      AdminUser.findById(invitation.adminUserId).select('name email status').lean(),
      Role.findOne({ key: invitation.roleKey }).select('name key').lean(),
    ]);

    if (!adminUser || adminUser.status !== 'INVITED' || !role) {
      return res.status(410).json({
        error: 'This admin invitation is no longer valid.',
      });
    }

    return res.status(200).json({
      invitation: {
        name: adminUser.name,
        email: adminUser.email,
        roleKey: role.key,
        roleName: role.name,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('[CD_ADMIN] Invitation lookup error:', error.message);
    return res.status(500).json({ error: 'Unable to validate admin invitation.' });
  }
});

router.post('/:token/activate', async (req, res) => {
  try {
    const invitation = await getPendingInvitation(req.params.token);
    if (!invitation) {
      return res.status(410).json({
        error: 'This admin invitation is invalid or has expired.',
      });
    }

    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const minimumPasswordLength = await getSettingNumber(SETTING_KEYS.PASSWORD_MIN_LENGTH);

    if (password.length < minimumPasswordLength) {
      return res.status(400).json({
        error: `Password must be at least ${minimumPasswordLength} characters.`,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const adminUser = await AdminUser.findById(invitation.adminUserId).select('+passwordHash');
    if (!adminUser || adminUser.status !== 'INVITED') {
      return res.status(410).json({ error: 'This admin invitation is no longer valid.' });
    }

    adminUser.passwordHash = await bcrypt.hash(password, 12);
    adminUser.status = 'ACTIVE';
    await adminUser.save();

    invitation.status = 'ACCEPTED';
    invitation.acceptedAt = new Date();
    await invitation.save();

    await AdminInvitation.updateMany(
      { adminUserId: adminUser._id, _id: { $ne: invitation._id }, status: 'PENDING' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } }
    );

    await recordAudit({
      actorAdminUserId: adminUser._id,
      action: 'admin.user.invitation.accepted',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      metadata: { roleKey: adminUser.roleKey },
      req,
    });

    return res.status(200).json({
      message: 'Admin account activated successfully. You can now sign in.',
    });
  } catch (error) {
    console.error('[CD_ADMIN] Admin activation error:', error.message);
    return res.status(500).json({ error: 'Unable to activate admin account.' });
  }
});

export default router;
