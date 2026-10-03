import express from 'express';
import {
  requireAdminAuth,
  requirePermission,
} from '../middleware/authMiddleware.js';
import { config } from '../config/index.js';
import { recordAudit } from '../services/auditService.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = express.Router();

const callPaymentService = async (
  path,
  options = {}
) => {
  if (!config.adminInternalSecret) {
    throw new Error(
      'ADMIN_INTERNAL_SECRET is not configured.'
    );
  }

  const response = await fetch(
    `${config.paymentServiceUrl}${path}`,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),
        ...(options.headers || {}),
        'x-admin-internal-secret':
          config.adminInternalSecret,
      },
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      error:
        text ||
        'Invalid response from Payment Service.',
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        `Payment Service request failed (${response.status}).`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
};

const callOrderService = async (
  path
) => {
  if (!config.adminInternalSecret) {
    throw new Error(
      'ADMIN_INTERNAL_SECRET is not configured.'
    );
  }

  const response = await fetch(
    `${config.orderServiceUrl}${path}`,
    {
      headers: {
        Accept: 'application/json',
        'x-admin-internal-secret':
          config.adminInternalSecret,
      },
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      error:
        text ||
        'Invalid response from Order Service.',
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        `Order Service request failed (${response.status}).`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
};

/*
 * Canonical admin refund-history contract.
 *
 * Frontend:
 * adminApi.refundHistory(orderId)
 *
 * CD_ADMIN:
 * GET /api/admin/payments/refunds/:orderId
 *
 * Payment Service:
 * GET /admin/payments/refunds/:orderId
 */
router.get(
  '/refunds/:orderId',
  requireAdminAuth,
  requirePermission(
    PERMISSIONS.REFUNDS_READ
  ),
  async (req, res) => {
    try {
      const result =
        await callPaymentService(
          `/admin/payments/refunds/${encodeURIComponent(
            req.params.orderId
          )}`
        );

      return res
        .status(200)
        .json(result);
    } catch (error) {
      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to fetch refund history.',
        });
    }
  }
);

router.post(
  '/refunds',
  requireAdminAuth,
  requirePermission(
    PERMISSIONS.REFUNDS_CREATE
  ),
  async (req, res) => {
    try {
      const {
        orderId,
        orderItemId,
        amount,
        reasonCode,
        reasonNote,
        refundMethod,
        idempotencyKey,
        payoutProfileId,
      } = req.body || {};

      if (!orderId) {
        return res
          .status(400)
          .json({
            error: 'Order ID is required.',
          });
      }

      const numericAmount = Number(
        amount
      );

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              'Refund amount must be greater than zero.',
          });
      }

      if (
        Math.round(
          numericAmount * 100
        ) /
          100 !==
        numericAmount
      ) {
        return res
          .status(400)
          .json({
            error:
              'Refund amount can have at most two decimal places.',
          });
      }

      const cleanReasonCode =
        String(
          reasonCode || ''
        )
          .trim()
          .toUpperCase();

      if (!cleanReasonCode) {
        return res
          .status(400)
          .json({
            error:
              'A refund reason is required.',
          });
      }

      const cleanReasonNote =
        String(
          reasonNote || ''
        )
          .trim()
          .slice(0, 250);

      const orderData =
        await callOrderService(
          `/admin/orders/${encodeURIComponent(
            orderId
          )}`
        );

      const order =
        orderData.order;

      if (!order) {
        return res
          .status(404)
          .json({
            error: 'Order not found.',
          });
      }

      if (
        !['ONLINE', 'COD'].includes(
          order.paymentMethod
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'This order has an unsupported payment method.',
          });
      }

      const resolvedRefundMethod =
        refundMethod ||
        (order.paymentMethod ===
        'ONLINE'
          ? 'ORIGINAL_PAYMENT'
          : 'COD_PAYOUT');

      if (
        order.paymentMethod ===
          'ONLINE' &&
        resolvedRefundMethod !==
          'ORIGINAL_PAYMENT'
      ) {
        return res
          .status(400)
          .json({
            error:
              'Online payments can only be refunded to the original payment method.',
          });
      }

      const result =
        await callPaymentService(
          '/admin/refunds',
          {
            method: 'POST',
            body: JSON.stringify({
              orderId,
              orderItemId:
                orderItemId || null,
              userId:
                order.userId?.toString() ||
                null,
              paymentId:
                order.paymentId ||
                null,
              customerName:
                order.customerName ||
                null,
              paymentMethod:
                order.paymentMethod,
              refundMethod:
                resolvedRefundMethod,
              amount: numericAmount,
              orderTotal:
                Number(
                  order.totalAmount
                ),
              reasonCode:
                cleanReasonCode,
              reasonNote:
                cleanReasonNote,
              source:
                'ADMIN_MANUAL',
              adminUserId:
                req.admin._id.toString(),
              adminEmail:
                req.admin.email,
              idempotencyKey:
                idempotencyKey ||
                null,
              payoutProfileId:
                payoutProfileId ||
                null,
            }),
          }
        );

      try {
        await recordAudit({
          actorAdminUserId:
            req.admin._id,
          action:
            'refund.request.created',
          entityType: 'Refund',
          entityId:
            result?.refund?._id ||
            orderId,
          metadata: {
            orderId,
            orderItemId:
              orderItemId || null,
            paymentMethod:
              order.paymentMethod,
            refundMethod:
              resolvedRefundMethod,
            amount: numericAmount,
            reasonCode:
              cleanReasonCode,
            hasReasonNote:
              Boolean(
                cleanReasonNote
              ),
            refund:
              result?.refund ||
              null,
          },
          req,
        });
      } catch (auditError) {
        console.error(
          '[CD_ADMIN] Refund audit error:',
          auditError.message
        );
      }

      return res
        .status(
          result?.refund?.status ===
            'PROCESSING'
            ? 202
            : result?.idempotent
              ? 200
              : 201
        )
        .json(result);
    } catch (error) {
      console.error(
        '[CD_ADMIN] Refund creation error:',
        error.message
      );

      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to create refund request.',
          refund:
            error.data?.refund ||
            error.refund ||
            null,
        });
    }
  }
);

router.post(
  '/refunds/:refundId/payout',
  requireAdminAuth,
  requirePermission(
    PERMISSIONS.REFUNDS_CREATE
  ),
  async (req, res) => {
    try {
      const result =
        await callPaymentService(
          `/admin/refunds/${encodeURIComponent(
            req.params.refundId
          )}/payout`,
          {
            method: 'POST',
          }
        );

      try {
        await recordAudit({
          actorAdminUserId:
            req.admin._id,
          action:
            'refund.payout.requested',
          entityType: 'Refund',
          entityId:
            req.params.refundId,
          metadata: {
            refundId:
              req.params.refundId,
            status:
              result?.refund
                ?.status ||
              null,
            payoutId:
              result?.refund
                ?.payoutId ||
              null,
          },
          req,
        });
      } catch (auditError) {
        console.error(
          '[CD_ADMIN] COD payout audit error:',
          auditError.message
        );
      }

      return res
        .status(200)
        .json(result);
    } catch (error) {
      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to process COD payout.',
          refund:
            error.data?.refund ||
            null,
        });
    }
  }
);

router.post(
  '/refunds/:refundId/payout/reconcile',
  requireAdminAuth,
  requirePermission(
    PERMISSIONS.REFUNDS_READ
  ),
  async (req, res) => {
    try {
      const result =
        await callPaymentService(
          `/admin/refunds/${encodeURIComponent(
            req.params.refundId
          )}/payout/reconcile`,
          {
            method: 'POST',
          }
        );

      try {
        await recordAudit({
          actorAdminUserId:
            req.admin._id,
          action:
            'refund.payout.reconciled',
          entityType: 'Refund',
          entityId:
            req.params.refundId,
          metadata: {
            refundId:
              req.params.refundId,
            status:
              result?.refund
                ?.status ||
              null,
            payoutId:
              result?.refund
                ?.payoutId ||
              null,
          },
          req,
        });
      } catch (auditError) {
        console.error(
          '[CD_ADMIN] COD payout reconciliation audit error:',
          auditError.message
        );
      }

      return res
        .status(200)
        .json(result);
    } catch (error) {
      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to reconcile COD payout.',
        });
    }
  }
);

router.post(
  '/refunds/:refundId/reconcile',
  requireAdminAuth,
  requirePermission(
    PERMISSIONS.REFUNDS_READ
  ),
  async (req, res) => {
    try {
      return res
        .status(200)
        .json(
          await callPaymentService(
            `/admin/refunds/${encodeURIComponent(
              req.params.refundId
            )}/reconcile`,
            {
              method: 'POST',
            }
          )
        );
    } catch (error) {
      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to reconcile refund.',
        });
    }
  }
);

export default router;