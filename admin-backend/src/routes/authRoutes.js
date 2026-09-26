import express from 'express';
import bcrypt from 'bcryptjs';
import AdminUser from '../models/AdminUser.js';
import AdminSession from '../models/AdminSession.js';
import Role from '../models/Role.js';
import { config } from '../config/index.js';
import { requireAdminAuth, loadSession } from '../middleware/authMiddleware.js';
import { recordAudit } from '../services/auditService.js';
import { createSessionToken, hashSessionToken } from '../utils/sessionToken.js';
import { SETTING_KEYS, getSettingNumber } from '../services/settingsService.js';
import {
  createMfaSetup,
  decryptMfaSecret,
  generateMfaBackupCodes,
  hashMfaBackupCodes,
  verifyMfaCredential,
  verifyTotp,
} from '../services/mfaService.js';

const router = express.Router();

router.get('/csrf', (req, res) => {
  return res.status(200).json({
    message: 'CSRF token issued.',
  });
});

const publicAdmin = (adminUser, role) => ({
  id: adminUser._id,
  name: adminUser.name,
  email: adminUser.email,
  role: adminUser.roleKey,
  permissions: role?.permissions || [],
  lastLoginAt: adminUser.lastLoginAt || null,
  mfaEnabled: Boolean(adminUser.mfaEnabled),
});

const setSessionCookie = (res, token, sessionHours) => {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: sessionHours * 60 * 60 * 1000,
    path: '/',
  });
};

const assertValidName = (name) => {
  if (name.length < 2 || name.length > 100) {
    const error = new Error('Admin name must be between 2 and 100 characters.');
    error.status = 400;
    throw error;
  }
};

const assertValidEmail = (email) => {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = new Error('A valid admin email is required.');
    error.status = 400;
    throw error;
  }
};

const assertCurrentPassword = async (adminUser, currentPassword) => {
  if (!currentPassword) {
    const error = new Error('Current password is required.');
    error.status = 400;
    throw error;
  }

  const validPassword = await bcrypt.compare(currentPassword, adminUser.passwordHash);
  if (!validPassword) {
    const error = new Error('Current password is incorrect.');
    error.status = 401;
    throw error;
  }
};

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const adminUser = await AdminUser.findOne({ email }).select('+passwordHash +mfaSecretEncrypted +mfaBackupCodeHashes');

    if (!adminUser || adminUser.status !== 'ACTIVE') {
      await recordAudit({
        action: 'admin.login.failed',
        entityType: 'AdminUser',
        outcome: 'FAILED',
        reason: 'Invalid administrator credentials.',
        metadata: { email, failure: 'invalid_credentials' },
        req,
      });
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
    if (!validPassword) {
      await recordAudit({
        actorAdminUserId: adminUser._id,
        action: 'admin.login.failed',
        entityType: 'AdminUser',
        entityId: adminUser._id.toString(),
        actorRoleKey: adminUser.roleKey,
        outcome: 'FAILED',
        reason: 'Invalid administrator credentials.',
        metadata: { failure: 'invalid_credentials' },
        req,
      });
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const role = await Role.findOne({ key: adminUser.roleKey }).lean();
    if (!role) {
      return res.status(500).json({ error: 'Admin role configuration is invalid.' });
    }

    if (adminUser.mfaEnabled) {
      const credential = String(req.body?.otp || '').trim();

      if (!credential) {
        await recordAudit({
          actorAdminUserId: adminUser._id,
          action: 'admin.login.mfa_required',
          entityType: 'AdminUser',
          entityId: adminUser._id.toString(),
          actorRoleKey: adminUser.roleKey,
          outcome: 'FAILED',
          reason: 'MFA verification is required before an admin session can be created.',
          metadata: { failure: 'mfa_required' },
          req,
        });
        return res.status(401).json({
          error: 'MFA verification required.',
          mfaRequired: true,
        });
      }

      let verification;
      try {
        verification = await verifyMfaCredential(adminUser, credential);
      } catch (mfaError) {
        console.error('[CD_ADMIN] MFA verification error:', mfaError.message);
        return res.status(503).json({ error: 'MFA verification is temporarily unavailable.' });
      }

      if (!verification.valid) {
        await recordAudit({
          actorAdminUserId: adminUser._id,
          action: 'admin.login.mfa_failed',
          entityType: 'AdminUser',
          entityId: adminUser._id.toString(),
          actorRoleKey: adminUser.roleKey,
          outcome: 'FAILED',
          reason: 'Administrator supplied an invalid MFA credential.',
          metadata: { failure: 'invalid_mfa_credential' },
          req,
        });
        return res.status(401).json({
          error: 'Invalid MFA code or recovery code.',
          mfaRequired: true,
        });
      }

      if (verification.type === 'RECOVERY_CODE') {
        await adminUser.save();
      }

      await recordAudit({
        actorAdminUserId: adminUser._id,
        action: 'admin.login.mfa_verified',
        entityType: 'AdminUser',
        entityId: adminUser._id.toString(),
        actorRoleKey: adminUser.roleKey,
        outcome: 'SUCCESS',
        reason: 'Administrator MFA verification succeeded.',
        metadata: { method: verification.type },
        req,
      });
    }

    const token = createSessionToken();
    const sessionHours = await getSettingNumber(SETTING_KEYS.ADMIN_SESSION_HOURS);
    const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);

    await AdminSession.create({
      adminUserId: adminUser._id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    adminUser.lastLoginAt = new Date();
    await adminUser.save();

    setSessionCookie(res, token, sessionHours);

    await recordAudit({
      actorAdminUserId: adminUser._id,
      action: 'admin.login.succeeded',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      actorRoleKey: adminUser.roleKey,
      outcome: 'SUCCESS',
      reason: 'Administrator authenticated successfully.',
      metadata: { sessionHours },
      req,
    });

    return res.status(200).json({
      message: 'Admin login successful.',
      admin: publicAdmin(adminUser, role),
    });
  } catch (error) {
    console.error('[CD_ADMIN] Login error:', error.message);
    return res.status(500).json({ error: 'Unable to complete admin login.' });
  }
});

router.patch('/me', requireAdminAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || '');

    assertValidName(name);
    assertValidEmail(email);

    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);

    const previous = {
      name: adminUser.name,
      email: adminUser.email,
    };

    const emailChanged = email !== adminUser.email;
    if (emailChanged) {
      const existing = await AdminUser.findOne({
        email,
        _id: { $ne: adminUser._id },
      }).lean();
      if (existing) {
        return res.status(409).json({ error: 'An admin account already exists for this email.' });
      }
    }

    adminUser.name = name;
    adminUser.email = email;
    await adminUser.save();

    const role = await Role.findOne({ key: adminUser.roleKey }).lean();

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.account.updated',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator updated own account credentials.',
      before: previous,
      after: { name: adminUser.name, email: adminUser.email },
      metadata: { emailChanged },
      req,
    });

    return res.status(200).json({
      message: 'Admin account updated successfully.',
      admin: publicAdmin(adminUser, role),
    });
  } catch (error) {
    console.error('[CD_ADMIN] Account update error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to update admin account.',
    });
  }
});

router.post('/change-password', requireAdminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    const minPasswordLength = await getSettingNumber(SETTING_KEYS.PASSWORD_MIN_LENGTH);

    if (newPassword.length < minPasswordLength || newPassword.length > 128) {
      return res.status(400).json({
        error: `New password must be between ${minPasswordLength} and 128 characters.`,
      });
    }

    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);

    if (await bcrypt.compare(newPassword, adminUser.passwordHash)) {
      return res.status(400).json({ error: 'New password must be different from the current password.' });
    }

    adminUser.passwordHash = await bcrypt.hash(newPassword, 12);
    await adminUser.save();

    const sessionResult = await AdminSession.deleteMany({
      adminUserId: adminUser._id,
      _id: { $ne: req.adminSession?._id },
    });

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.password.changed',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator changed own password.',
      metadata: {
        revokedOtherSessionCount: sessionResult.deletedCount || 0,
      },
      req,
    });

    return res.status(200).json({
      message: 'Password changed successfully. Other admin sessions were revoked.',
    });
  } catch (error) {
    console.error('[CD_ADMIN] Password change error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to change admin password.',
    });
  }
});


router.post('/mfa/setup', requireAdminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash +mfaPendingSecretEncrypted +mfaSecretEncrypted');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }

    if (adminUser.mfaEnabled) {
      return res.status(409).json({ error: 'MFA is already enabled for this account.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);

    const setup = createMfaSetup(adminUser.email);
    adminUser.mfaPendingSecretEncrypted = setup.encryptedSecret;
    await adminUser.save();

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.mfa.setup.started',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator started MFA enrollment.',
      metadata: { method: 'TOTP', issuer: "Creator's Desk" },
      req,
    });

    return res.status(200).json({
      message: 'MFA setup prepared. Verify the code to enable it.',
      secret: setup.secret,
      otpauthUri: setup.uri,
    });
  } catch (error) {
    console.error('[CD_ADMIN] MFA setup error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to prepare MFA setup.',
    });
  }
});

router.post('/mfa/enable', requireAdminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const otp = String(req.body?.otp || '').trim();
    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash +mfaPendingSecretEncrypted +mfaSecretEncrypted +mfaBackupCodeHashes');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }

    if (adminUser.mfaEnabled) {
      return res.status(409).json({ error: 'MFA is already enabled for this account.' });
    }

    if (!adminUser.mfaPendingSecretEncrypted) {
      return res.status(409).json({ error: 'Start MFA setup before enabling MFA.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);

    const pendingSecret = decryptMfaSecret(adminUser.mfaPendingSecretEncrypted);
    if (!verifyTotp(pendingSecret, otp)) {
      await recordAudit({
        actorAdminUserId: adminUser._id,
        actorRoleKey: adminUser.roleKey,
        action: 'admin.mfa.enable_failed',
        entityType: 'AdminUser',
        entityId: adminUser._id.toString(),
        outcome: 'FAILED',
        reason: 'Administrator supplied an invalid MFA enrollment code.',
        req,
      });
      return res.status(401).json({ error: 'Invalid MFA verification code.' });
    }

    const recoveryCodes = generateMfaBackupCodes(10);
    adminUser.mfaSecretEncrypted = adminUser.mfaPendingSecretEncrypted;
    adminUser.mfaPendingSecretEncrypted = null;
    adminUser.mfaBackupCodeHashes = await hashMfaBackupCodes(recoveryCodes);
    adminUser.mfaBackupCodesGeneratedAt = new Date();
    adminUser.mfaEnabled = true;
    await adminUser.save();

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.mfa.enabled',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator enabled MFA on the account.',
      before: { mfaEnabled: false },
      after: { mfaEnabled: true },
      metadata: { method: 'TOTP', recoveryCodeCount: recoveryCodes.length },
      req,
    });

    return res.status(200).json({
      message: 'MFA enabled successfully. Save the recovery codes now.',
      recoveryCodes,
    });
  } catch (error) {
    console.error('[CD_ADMIN] MFA enable error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to enable MFA.',
    });
  }
});

router.post('/mfa/disable', requireAdminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const credential = String(req.body?.otp || '').trim();
    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash +mfaSecretEncrypted +mfaBackupCodeHashes');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }

    if (!adminUser.mfaEnabled) {
      return res.status(409).json({ error: 'MFA is already disabled for this account.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);
    const verification = await verifyMfaCredential(adminUser, credential);
    if (!verification.valid) {
      return res.status(401).json({ error: 'Invalid MFA code or recovery code.' });
    }

    adminUser.mfaEnabled = false;
    adminUser.mfaSecretEncrypted = null;
    adminUser.mfaPendingSecretEncrypted = null;
    adminUser.mfaBackupCodeHashes = [];
    adminUser.mfaBackupCodesGeneratedAt = null;
    await adminUser.save();

    const sessionResult = await AdminSession.deleteMany({
      adminUserId: adminUser._id,
      _id: { $ne: req.adminSession?._id },
    });

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.mfa.disabled',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator disabled MFA on the account.',
      before: { mfaEnabled: true },
      after: { mfaEnabled: false },
      metadata: { method: verification.type, revokedOtherSessionCount: sessionResult.deletedCount || 0 },
      req,
    });

    return res.status(200).json({
      message: 'MFA disabled. Other admin sessions were revoked.',
    });
  } catch (error) {
    console.error('[CD_ADMIN] MFA disable error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to disable MFA.',
    });
  }
});

router.post('/mfa/recovery-codes', requireAdminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const otp = String(req.body?.otp || '').trim();
    const adminUser = await AdminUser.findById(req.admin._id).select('+passwordHash +mfaSecretEncrypted +mfaBackupCodeHashes');
    if (!adminUser || adminUser.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Admin account is no longer active.' });
    }
    if (!adminUser.mfaEnabled) {
      return res.status(409).json({ error: 'Enable MFA before generating recovery codes.' });
    }

    await assertCurrentPassword(adminUser, currentPassword);
    if (!verifyTotp(decryptMfaSecret(adminUser.mfaSecretEncrypted), otp)) {
      return res.status(401).json({ error: 'Invalid MFA verification code.' });
    }

    const recoveryCodes = generateMfaBackupCodes(10);
    adminUser.mfaBackupCodeHashes = await hashMfaBackupCodes(recoveryCodes);
    adminUser.mfaBackupCodesGeneratedAt = new Date();
    await adminUser.save();

    await recordAudit({
      actorAdminUserId: adminUser._id,
      actorRoleKey: adminUser.roleKey,
      action: 'admin.mfa.recovery_codes.regenerated',
      entityType: 'AdminUser',
      entityId: adminUser._id.toString(),
      outcome: 'SUCCESS',
      reason: 'Administrator regenerated MFA recovery codes.',
      metadata: { recoveryCodeCount: recoveryCodes.length },
      req,
    });

    return res.status(200).json({
      message: 'Recovery codes regenerated. Save them securely.',
      recoveryCodes,
    });
  } catch (error) {
    console.error('[CD_ADMIN] MFA recovery code error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to regenerate recovery codes.',
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.[config.cookieName];
    const context = await loadSession(token);

    if (token) {
      await AdminSession.deleteOne({ tokenHash: hashSessionToken(token) });
    }

    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      path: '/',
    });

    if (context) {
      await recordAudit({
        actorAdminUserId: context.adminUser._id,
        action: 'admin.logout',
        entityType: 'AdminUser',
        entityId: context.adminUser._id.toString(),
        actorRoleKey: context.adminUser.roleKey,
        outcome: 'SUCCESS',
        reason: 'Administrator session ended.',
        req,
      });
    }

    return res.status(200).json({ message: 'Admin logout successful.' });
  } catch (error) {
    console.error('[CD_ADMIN] Logout error:', error.message);
    return res.status(500).json({ error: 'Unable to complete admin logout.' });
  }
});

router.get('/me', requireAdminAuth, async (req, res) => {
  return res.status(200).json({
    admin: publicAdmin(req.admin, req.adminRole),
  });
});

export default router;
