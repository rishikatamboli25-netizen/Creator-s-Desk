import express from 'express';
import { config } from '../config/index.js';
import { requireAdminAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { recordAudit } from '../services/auditService.js';

const router = express.Router();
const PRODUCT_SERVICE_URL = config.productServiceUrl.replace(/\/$/, '');

const callProductService = async (path, options = {}) => {
  const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-admin-internal-secret': config.adminInternalSecret,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Product Service request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
};

router.put('/products/:productId/price', requireAdminAuth, requirePermission(PERMISSIONS.PRODUCTS_PRICE_WRITE), async (req, res) => {
  try {
    const { productId } = req.params;
    const price = Number(req.body?.price);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number with at most two decimal places.' });
    }
    const allowedReasons = new Set(['REGULAR_UPDATE', 'SALE', 'PROMOTION', 'CLEARANCE', 'FLASH_SALE', 'CORRECTION']);
    if (!allowedReasons.has(reason)) return res.status(400).json({ error: 'A valid price change reason is required.' });

    const result = await callProductService(`/internal/admin/products/${encodeURIComponent(productId)}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price, reason, adminId: req.admin._id.toString(), adminEmail: req.admin.email }),
    });

    await recordAudit({
      actorAdminUserId: req.admin._id,
      action: 'product.price.updated',
      entityType: 'Product',
      entityId: productId,
      metadata: {
        oldPrice: result.priceChange?.oldPrice ?? null,
        newPrice: result.priceChange?.newPrice ?? price,
        reason,
        effectiveAt: result.priceChange?.effectiveAt ?? null,
      },
      req,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[CD_ADMIN] Price update error:', error.message);
    if (error.status === 404 || error.status === 400) return res.status(error.status).json({ error: error.message });
    return res.status(502).json({ error: 'Unable to update product price through Product Service.' });
  }
});

router.get('/products/:productId/history', requireAdminAuth, requirePermission(PERMISSIONS.PRODUCTS_PRICE_READ), async (req, res) => {
  try {
    const data = await callProductService(`/internal/admin/products/${encodeURIComponent(req.params.productId)}/price-history`);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[CD_ADMIN] Price history error:', error.message);
    if (error.status === 404) return res.status(404).json({ error: error.message });
    return res.status(502).json({ error: 'Unable to load product price history.' });
  }
});

export default router;
