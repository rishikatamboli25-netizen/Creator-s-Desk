import { randomUUID } from 'node:crypto';
import AuditLog from '../models/AuditLog.js';

const inferOutcome = (action, outcome) => {
  if (outcome === 'SUCCESS' || outcome === 'FAILED') return outcome;
  return /(?:\.failed|_failed)$/i.test(String(action || ''))
    ? 'FAILED'
    : 'SUCCESS';
};

const safeSnapshot = (value) => {
  if (value === undefined || value === null) return null;
  return value;
};

const normalizeAuditPayload = ({ before, after, reason, metadata }) => {
  const normalizedMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  let normalizedBefore = before;
  let normalizedAfter = after;
  let normalizedReason = reason;

  if (normalizedBefore == null && normalizedMetadata.before !== undefined) {
    normalizedBefore = normalizedMetadata.before;
    delete normalizedMetadata.before;
  }

  if (normalizedAfter == null && normalizedMetadata.after !== undefined) {
    normalizedAfter = normalizedMetadata.after;
    delete normalizedMetadata.after;
  }

  if (!normalizedReason && normalizedMetadata.reason) {
    normalizedReason = String(normalizedMetadata.reason).trim();
    delete normalizedMetadata.reason;
  }

  if (normalizedBefore == null && normalizedMetadata.oldPrice !== undefined) {
    normalizedBefore = { price: normalizedMetadata.oldPrice };
    delete normalizedMetadata.oldPrice;
  }

  if (normalizedAfter == null && normalizedMetadata.newPrice !== undefined) {
    normalizedAfter = { price: normalizedMetadata.newPrice };
    delete normalizedMetadata.newPrice;
  }

  if (normalizedBefore == null && normalizedMetadata.previousStatus !== undefined) {
    normalizedBefore = { status: normalizedMetadata.previousStatus };
    delete normalizedMetadata.previousStatus;
  }

  if (normalizedAfter == null && normalizedMetadata.status !== undefined) {
    normalizedAfter = { status: normalizedMetadata.status };
    delete normalizedMetadata.status;
  }

  return {
    before: safeSnapshot(normalizedBefore),
    after: safeSnapshot(normalizedAfter),
    reason: String(normalizedReason || '').trim().slice(0, 500),
    metadata: normalizedMetadata,
  };
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
    const resolvedRequestId = String(
      requestId ||
        req?.requestId ||
        req?.get?.('x-request-id') ||
        randomUUID()
    ).trim();

    const normalized = normalizeAuditPayload({
      before,
      after,
      reason,
      metadata,
    });

    await AuditLog.create({
      actorAdminUserId:
        actorAdminUserId || req?.admin?._id || null,
      actorRoleKey:
        actorRoleKey || req?.adminRole?.key || req?.admin?.roleKey || null,
      action,
      entityType,
      entityId,
      requestId: resolvedRequestId,
      outcome: inferOutcome(action, outcome),
      reason: normalized.reason,
      before: normalized.before,
      after: normalized.after,
      metadata: normalized.metadata,
      ipAddress:
        req?.ip ||
        req?.headers?.['x-forwarded-for'] ||
        req?.socket?.remoteAddress ||
        '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch (error) {
    console.error('[Admin Audit] Failed to write audit log:', error.message);
  }
};
