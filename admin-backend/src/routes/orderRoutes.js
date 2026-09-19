import express from 'express';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { recordAudit } from '../services/auditService.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { config } from '../config/index.js';

const router = express.Router();

const buildQuery = (params = {}) => {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(50, Math.max(1, Number(params.limit || 20)));
  const search = String(params.search || '').trim();
  const status = String(params.status || '').trim();
  const paymentMethod = String(params.paymentMethod || '').trim();

  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (paymentMethod) query.set('paymentMethod', paymentMethod);

  return query;
};

const callOrderService = async (path, options = {}) => {
  if (!config.orderServiceUrl) {
    throw new Error('ORDER_SERVICE_URL is not configured.');
  }

  if (!config.adminInternalSecret) {
    throw new Error('ADMIN_INTERNAL_SECRET is not configured.');
  }

  const response = await fetch(`${config.orderServiceUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'x-admin-internal-secret': config.adminInternalSecret,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid response from Order Service.' };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || `Order Service request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ORDERS_READ),
  async (req, res) => {
    try {
      const query = buildQuery(req.query);
      const data = await callOrderService(`/admin/orders?${query.toString()}`);
      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Order list error:', error.message);
      return res.status(error.status || 502).json({
        error: error.message || 'Unable to fetch orders.',
      });
    }
  }
);

router.get(
  '/:orderId',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ORDERS_READ),
  async (req, res) => {
    try {
      const data = await callOrderService(
        `/admin/orders/${encodeURIComponent(req.params.orderId)}`
      );
      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Order detail error:', error.message);
      return res.status(error.status || 502).json({
        error: error.message || 'Unable to fetch order.',
      });
    }
  }
);

router.patch(
  '/:orderId/status',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ORDERS_WRITE),
  async (req, res) => {
    try {
      const status = String(req.body?.status || '').trim();
      const allowedStatuses = [
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid order status.' });
      }

      const data = await callOrderService(
        `/admin/orders/${encodeURIComponent(req.params.orderId)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      await recordAudit({
        actorAdminUserId: req.admin._id,
        action: 'order.status.updated',
        entityType: 'Order',
        entityId: req.params.orderId,
        metadata: {
          previousStatus: data.previousStatus || null,
          status,
        },
        req,
      });

      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Order status update error:', error.message);
      return res.status(error.status || 502).json({
        error: error.message || 'Unable to update order status.',
      });
    }
  }
);

export default router;
