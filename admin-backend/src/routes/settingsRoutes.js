import express from 'express';
import AdminSetting from '../models/AdminSetting.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { recordAudit } from '../services/auditService.js';
import {
  SETTING_DEFINITIONS,
  getSettingsSnapshot,
  validateSettingsPayload,
} from '../services/settingsService.js';

const router = express.Router();

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (_req, res) => {
    try {
      return res.status(200).json({
        settings: await getSettingsSnapshot(),
      });
    } catch (error) {
      console.error('[CD_ADMIN] Settings list error:', error.message);
      return res.status(500).json({ error: 'Unable to fetch admin settings.' });
    }
  }
);

router.patch(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 3 || reason.length > 500) {
        return res.status(400).json({
          error: 'A reason between 3 and 500 characters is required for settings changes.',
        });
      }

      const values = validateSettingsPayload(req.body?.settings);
      const keys = Object.keys(values);
      const beforeDocuments = await AdminSetting.find({ key: { $in: keys } }).lean();
      const beforeMap = new Map(beforeDocuments.map((item) => [item.key, Number(item.value)]));

      const changed = [];

      for (const [key, value] of Object.entries(values)) {
        const beforeValue = beforeMap.has(key)
          ? beforeMap.get(key)
          : SETTING_DEFINITIONS[key].defaultValue;

        if (beforeValue === value) continue;

        await AdminSetting.findOneAndUpdate(
          { key },
          {
            $set: {
              value,
              updatedByAdminUserId: req.admin._id,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        changed.push({
          key,
          before: beforeValue,
          after: value,
        });

        await recordAudit({
          actorAdminUserId: req.admin._id,
          actorRoleKey: req.adminRole.key,
          action: 'admin.settings.updated',
          entityType: 'AdminSetting',
          entityId: key,
          outcome: 'SUCCESS',
          reason,
          before: { key, value: beforeValue },
          after: { key, value },
          metadata: { settingLabel: SETTING_DEFINITIONS[key].label },
          req,
        });
      }

      return res.status(200).json({
        message: changed.length
          ? 'Admin settings updated successfully.'
          : 'No settings changed.',
        changed,
        settings: await getSettingsSnapshot(),
      });
    } catch (error) {
      console.error('[CD_ADMIN] Settings update error:', error.message);
      return res.status(error.status || 500).json({
        error: error.message || 'Unable to update admin settings.',
      });
    }
  }
);

export default router;
