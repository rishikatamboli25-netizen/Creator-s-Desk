import express from 'express';
import { config } from '../config/index.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { recordAudit } from '../services/auditService.js';

const router = express.Router();
const PRODUCT_SERVICE_URL = config.productServiceUrl.replace(/\/$/, '');

const callProductService = async (path, options = {}) => {
  if (!config.adminInternalSecret) {
    const error = new Error('ADMIN_INTERNAL_SECRET is not configured.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, {
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
    data = { error: text || 'Invalid response from Product Service.' };
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Product Service request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return data;
};

const actorPayload = (req) => ({
  adminId: req.admin._id.toString(),
  adminEmail: req.admin.email,
  requestId: req.requestId || req.get('x-request-id') || '',
});

router.get(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  async (req, res) => {
    try {
      const query = new URLSearchParams();
      for (const key of ['page', 'limit', 'search', 'category', 'stockState']) {
        if (req.query[key]) query.set(key, String(req.query[key]));
      }
      const data = await callProductService(`/internal/admin/products?${query.toString()}`);
      return res.status(200).json(data);
    } catch (error) {
      console.error('[CD_ADMIN] Catalog list error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to load catalog.' });
    }
  }
);

router.post(
  '/',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'A reason is required when creating a catalog product.' });

      const result = await callProductService('/internal/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...req.body,
          reason,
          ...actorPayload(req),
        }),
      });

      await recordAudit({
        actorAdminUserId: req.admin._id,
        actorRoleKey: req.adminRole?.key || req.admin.roleKey,
        action: 'catalog.product.created',
        entityType: 'Product',
        entityId: result.product?._id?.toString() || null,
        outcome: 'SUCCESS',
        reason,
        after: {
          sku: result.product?.sku || null,
          name: result.product?.name || null,
          slug: result.product?.slug || null,
          category: result.product?.category || null,
          quantity: result.product?.quantity ?? null,
        },
        metadata: { source: 'catalog.single-create' },
        req,
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error('[CD_ADMIN] Catalog product create error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to create catalog product.' });
    }
  }
);

router.post(
  '/bulk-import',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_BULK_CREATE),
  async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const reason = String(req.body?.reason || '').trim();
      if (!rows.length) return res.status(400).json({ error: 'No catalog rows were supplied.' });
      if (!reason) return res.status(400).json({ error: 'A reason is required for bulk import.' });

      const result = await callProductService('/internal/admin/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          rows,
          reason,
          ...actorPayload(req),
        }),
      });

      await recordAudit({
        actorAdminUserId: req.admin._id,
        actorRoleKey: req.adminRole?.key || req.admin.roleKey,
        action: 'catalog.bulk_import.completed',
        entityType: 'CatalogImport',
        entityId: req.requestId || null,
        outcome: 'SUCCESS',
        reason,
        after: { createdCount: result.createdCount || 0 },
        metadata: { rowCount: rows.length, source: 'catalog.bulk-import' },
        req,
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error('[CD_ADMIN] Catalog bulk import error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to import catalog.' });
    }
  }
);

router.put(
  '/:productId',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'A reason is required for catalog changes.' });

      const result = await callProductService(`/internal/admin/products/${encodeURIComponent(req.params.productId)}`, {
        method: 'PUT',
        body: JSON.stringify(req.body),
      });

      await recordAudit({
        actorAdminUserId: req.admin._id,
        actorRoleKey: req.adminRole?.key || req.admin.roleKey,
        action: 'catalog.product.updated',
        entityType: 'Product',
        entityId: req.params.productId,
        outcome: 'SUCCESS',
        reason,
        before: result.before || null,
        after: result.after || null,
        metadata: { source: 'catalog.edit' },
        req,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[CD_ADMIN] Catalog product update error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to update catalog product.' });
    }
  }
);

router.post(
  '/:productId/stock-adjust',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_STOCK_WRITE),
  async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'A reason is required for stock adjustments.' });

      const result = await callProductService(`/internal/admin/products/${encodeURIComponent(req.params.productId)}/stock-adjust`, {
        method: 'POST',
        body: JSON.stringify({ ...req.body, reason, ...actorPayload(req) }),
      });

      const delta = Number(req.body?.delta || 0);
      await recordAudit({
        actorAdminUserId: req.admin._id,
        actorRoleKey: req.adminRole?.key || req.admin.roleKey,
        action: 'catalog.stock.adjusted',
        entityType: 'Product',
        entityId: req.params.productId,
        outcome: 'SUCCESS',
        reason,
        before: { quantity: result.beforeQuantity ?? null },
        after: { quantity: result.afterQuantity ?? result.product?.quantity ?? null },
        metadata: { delta, source: 'catalog.stock-adjust' },
        req,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[CD_ADMIN] Stock adjustment error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to adjust product stock.' });
    }
  }
);

router.patch(
  '/:productId/availability',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_AVAILABILITY_WRITE),
  async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'A reason is required for availability changes.' });

      const result = await callProductService(`/internal/admin/products/${encodeURIComponent(req.params.productId)}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ ...req.body, reason, ...actorPayload(req) }),
      });

      await recordAudit({
        actorAdminUserId: req.admin._id,
        actorRoleKey: req.adminRole?.key || req.admin.roleKey,
        action: req.body?.available ? 'catalog.availability.enabled' : 'catalog.availability.disabled',
        entityType: 'Product',
        entityId: req.params.productId,
        outcome: 'SUCCESS',
        reason,
        before: result.before || null,
        after: result.after || null,
        metadata: { source: 'catalog.availability' },
        req,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[CD_ADMIN] Availability change error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to change product availability.' });
    }
  }
);

router.get(
  '/:productId/inventory-history',
  requireAdminAuth,
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  async (req, res) => {
    try {
      return res.status(200).json(await callProductService(`/internal/admin/products/${encodeURIComponent(req.params.productId)}/inventory-history`));
    } catch (error) {
      console.error('[CD_ADMIN] Inventory history error:', error.message);
      return res.status(error.status || 502).json({ error: error.message || 'Unable to load inventory history.' });
    }
  }
);

export default router;
