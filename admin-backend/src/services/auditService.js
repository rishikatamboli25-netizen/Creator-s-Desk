import { randomUUID } from 'node:crypto';
import AuditLog from '../models/AuditLog.js';

const inferOutcome = (action, outcome) => {
  if (outcome === 'SUCCESS' || outcome === 'FAILED') return outcome;
  return /\.failed$/i.test(String(action || '')) ? 'FAILED' : 'SUCCESS';
};

const safeSnapshot = (value) => {
  if (value === undefined || value === null) return null;
  return value;
};

export const recordAudit = async ({
  actorAdminUserId = null,
  actorRoleKey = null,
  action,
  entityType,
  entityId = null,
  requestId = null,
  outcome = null,
  reason = '',
  before = null,
  after = null,
  metadata = {},
  req = null,
}) => {
  try {
    const resolvedRequestId =
      String(
        requestId ||
          req?.requestId ||
          req?.get?.('x-request-id') ||
          randomUUID()
      ).trim();

    await AuditLog.create({
      actorAdminUserId,
      actorRoleKey: actorRoleKey || req?.adminRole?.key || null,
      action,
      entityType,
      entityId,
      requestId: resolvedRequestId,
      outcome: inferOutcome(action, outcome),
      reason,
      before: safeSnapshot(before),
      after: safeSnapshot(after),
      metadata,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch (error) {
    console.error('[Admin Audit] Failed to write audit log:', error.message);
  }
};
