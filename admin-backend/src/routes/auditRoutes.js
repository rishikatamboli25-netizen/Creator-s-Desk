import express from 'express';
import AuditLog from '../models/AuditLog.js';
import AdminUser from '../models/AdminUser.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = express.Router();
const MAX_LIMIT = 100;

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
};

const serializeActor = (actor) =>
  actor
    ? {
        id: actor._id.toString(),
        name: actor.name,
        email: actor.email,
        currentRoleKey: actor.roleKey,
        status: actor.status,
      }
    : null;

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.AUDIT_READ),
  async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 25)
      );

      const filter = {};
      const andConditions = [];

      const actorAdminUserId = String(req.query.actorAdminUserId || '').trim();
      if (actorAdminUserId) {
        if (!/^[a-f\d]{24}$/i.test(actorAdminUserId)) {
          return res.status(400).json({ error: 'Invalid actor admin user ID.' });
        }
        filter.actorAdminUserId = actorAdminUserId;
      }

      const action = String(req.query.action || '').trim();
      if (action) filter.action = action;

      const entityType = String(req.query.entityType || '').trim();
      if (entityType) filter.entityType = entityType;

      const entityId = String(req.query.entityId || '').trim();
      if (entityId) filter.entityId = entityId;

      const outcome = String(req.query.outcome || '').trim().toUpperCase();
      if (outcome) {
        if (!['SUCCESS', 'FAILED'].includes(outcome)) {
          return res.status(400).json({ error: 'Invalid audit outcome.' });
        }
        filter.outcome = outcome;
      }

      const search = String(req.query.search || '').trim();
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const expression = { $regex: escaped, $options: 'i' };
        andConditions.push({
          $or: [
            { action: expression },
            { entityType: expression },
            { entityId: expression },
            { requestId: expression },
            { reason: expression },
          ],
        });
      }

      const from = parseDate(req.query.from);
      const to = parseDate(req.query.to, true);
      if (req.query.from && !from) {
        return res.status(400).json({ error: 'Invalid from date. Use YYYY-MM-DD.' });
      }
      if (req.query.to && !to) {
        return res.status(400).json({ error: 'Invalid to date. Use YYYY-MM-DD.' });
      }
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = to;
      }

      if (andConditions.length) filter.$and = andConditions;

      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate({
            path: 'actorAdminUserId',
            select: 'name email roleKey status',
          })
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      const successFilter = { ...filter, outcome: 'SUCCESS' };
      const failedFilter = { ...filter, outcome: 'FAILED' };
      const [successCount, failedCount] = await Promise.all([
        AuditLog.countDocuments(successFilter),
        AuditLog.countDocuments(failedFilter),
      ]);

      return res.status(200).json({
        items: items.map((item) => ({
          id: item._id.toString(),
          actorAdminUserId: item.actorAdminUserId?._id?.toString() || null,
          actorRoleKey: item.actorRoleKey,
          actor: serializeActor(item.actorAdminUserId),
          action: item.action,
          entityType: item.entityType,
          entityId: item.entityId,
          requestId: item.requestId,
          outcome: item.outcome,
          reason: item.reason,
          before: item.before,
          after: item.after,
          metadata: item.metadata,
          ipAddress: item.ipAddress,
          userAgent: item.userAgent,
          createdAt: item.createdAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: {
          success: successCount,
          failed: failedCount,
        },
      });
    } catch (error) {
      console.error('[CD_ADMIN] Audit log list error:', error.message);
      return res.status(500).json({
        error: 'Unable to fetch audit logs.',
      });
    }
  }
);

router.get(
  '/actors',
  requireAdminAuth,
  requirePermission(PERMISSIONS.AUDIT_READ),
  async (_req, res) => {
    try {
      const actors = await AdminUser.find({})
        .select('name email roleKey status')
        .sort({ name: 1, email: 1 })
        .lean();

      return res.status(200).json({
        actors: actors.map((actor) => ({
          id: actor._id.toString(),
          name: actor.name,
          email: actor.email,
          roleKey: actor.roleKey,
          status: actor.status,
        })),
      });
    } catch (error) {
      console.error('[CD_ADMIN] Audit actor list error:', error.message);
      return res.status(500).json({ error: 'Unable to fetch audit actors.' });
    }
  }
);

export default router;
