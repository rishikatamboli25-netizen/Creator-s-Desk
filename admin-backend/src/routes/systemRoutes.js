import express from 'express';
import Role from '../models/Role.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = express.Router();

router.get('/permissions', requireAdminAuth, (req, res) => {
  res.status(200).json({
    role: req.adminRole.key,
    permissions: req.adminRole.permissions,
  });
});

router.get(
  '/roles',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_USERS_READ),
  async (req, res) => {
    const roles = await Role.find({}).sort({ key: 1 }).lean();
    res.status(200).json({ roles });
  }
);

export default router;
