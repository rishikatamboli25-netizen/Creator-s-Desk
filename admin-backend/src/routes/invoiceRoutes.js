import express from 'express';
import { Readable } from 'node:stream';

import {
  requireAdminAuth,
  requirePermission,
} from '../middleware/authMiddleware.js';
import { config } from '../config/index.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = express.Router();

const assertInternalSecret = () => {
  if (!config.adminInternalSecret) {
    const error = new Error(
      'ADMIN_INTERNAL_SECRET is not configured.'
    );
    error.status = 503;
    throw error;
  }
};

const callOrderService = async (path, options = {}) => {
  assertInternalSecret();

  const response = await fetch(
    `${config.orderServiceUrl}${path}`,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body
          ? { 'Content-Type': 'application/json' }
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
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error:
        text || 'Invalid response from Order Service.',
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        `Order Service request failed (${response.status}).`
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
      const params = new URLSearchParams();

      for (const key of [
        'q',
        'status',
        'page',
        'limit',
        'sort',
      ]) {
        const value = req.query?.[key];
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }

      const suffix = params.toString()
        ? `?${params.toString()}`
        : '';

      const data = await callOrderService(
        `/admin/invoices${suffix}`
      );

      return res.status(200).json(data);
    } catch (error) {
      console.error(
        '[CD_ADMIN] Invoice list error:',
        error.message
      );

      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to fetch invoices.',
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
        `/admin/invoices/${encodeURIComponent(
          req.params.orderId
        )}`
      );

      return res.status(200).json(data);
    } catch (error) {
      console.error(
        '[CD_ADMIN] Invoice detail error:',
        error.message
      );

      return res
        .status(error.status || 502)
        .json({
          error:
            error.message ||
            'Unable to fetch invoice.',
        });
    }
  }
);

router.get(
  '/:orderId/download',
  requireAdminAuth,
  requirePermission(PERMISSIONS.ORDERS_READ),
  async (req, res) => {
    try {
      const invoice = await callOrderService(
        `/admin/invoices/${encodeURIComponent(
          req.params.orderId
        )}`
      );

      const invoiceUrl =
        invoice?.invoice?.sourceUrl;

      if (!invoiceUrl) {
        return res.status(404).json({
          error:
            'Invoice PDF is not available for this order.',
        });
      }

      const response = await fetch(invoiceUrl);

      if (!response.ok || !response.body) {
        return res.status(502).json({
          error:
            'Unable to retrieve the invoice PDF.',
        });
      }

      const invoiceNumber =
        invoice?.invoice?.invoiceNumber ||
        req.params.orderId;

      const safeFilename = String(
        invoiceNumber
      )
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .slice(0, 120);

      res.status(200);
      res.setHeader(
        'Content-Type',
        response.headers.get('content-type') ||
          'application/pdf'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${safeFilename}.pdf"`
      );
      res.setHeader('Cache-Control', 'private, no-store');

      const contentLength = response.headers.get(
        'content-length'
      );
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      console.error(
        '[CD_ADMIN] Invoice download error:',
        error.message
      );

      if (!res.headersSent) {
        return res
          .status(error.status || 502)
          .json({
            error:
              error.message ||
              'Unable to download invoice.',
          });
      }
    }
  }
);

export default router;
