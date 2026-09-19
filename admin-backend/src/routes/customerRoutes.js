import express from 'express';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { config } from '../config/index.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = express.Router();

const callAuthService = async (path, options = {}) => {
  if (!config.authServiceUrl) {
    throw new Error('AUTH_SERVICE_URL is not configured.');
  }

  if (!config.adminInternalSecret) {
    throw new Error('ADMIN_INTERNAL_SECRET is not configured.');
  }

  const response = await fetch(`${config.authServiceUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
      'x-admin-internal-secret': config.adminInternalSecret,
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid response from Auth Service.' };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || `Auth Service request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (req, res) => {
    try {
      const query = new URLSearchParams();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
      const search = String(req.query.search || '').trim();

      query.set('page', String(page));
      query.set('limit', String(limit));
      if (search) query.set('search', search);

      const data = await callAuthService(`/admin/customers?${query.toString()}`);
      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Customer list error:', error.message);
      return res.status(error.status || 502).json({
        error: error.message || 'Unable to fetch customers.',
      });
    }
  }
);

router.get(
  '/:customerId',
  requireAdminAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (req, res) => {
    try {
      const data = await callAuthService(
        `/admin/customers/${encodeURIComponent(req.params.customerId)}`
      );
      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Customer detail error:', error.message);
      return res.status(error.status || 502).json({
        error: error.message || 'Unable to fetch customer.',
      });
    }
  }
);

export default router;
