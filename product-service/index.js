import 'dotenv/config';

import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import PriceChange from './models/PriceChange.js';
import InventoryReservation from './models/InventoryReservation.js';
import InventoryMovement from './models/InventoryMovement.js';
import {
  adjustStock,
  attachReservationOrder,
  commitReservation,
  expireReservations,
  getReservation,
  releaseReservation,
  reservationResponse,
  reserveInventory,
  setManualAvailability,
} from './services/inventoryService.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 5002;
const LEGACY_DEFAULT_INVENTORY_QUANTITY = Math.max(
  1,
  Number(process.env.LEGACY_DEFAULT_INVENTORY_QUANTITY || 10)
);

const ADMIN_INTERNAL_SECRET = String(
  process.env.ADMIN_INTERNAL_SECRET || ''
);

const timingSafeSecretEqual = (provided, expected) => {
  const providedBuffer = Buffer.from(String(provided || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');

  if (
    providedBuffer.length === 0 ||
    expectedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const requireAdminInternal = (req, res, next) => {
  if (
    !ADMIN_INTERNAL_SECRET ||
    !timingSafeSecretEqual(
      req.get('x-admin-internal-secret'),
      ADMIN_INTERNAL_SECRET
    )
  ) {
    return res.status(403).json({
      error: 'Admin internal access denied.',
    });
  }

  next();
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

const normalizeFeatures = (features) => {
  if (Array.isArray(features)) {
    return features
      .map((feature) => String(feature || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  return String(features || '')
    .split(/\||,/) 
    .map((feature) => feature.trim())
    .filter(Boolean)
    .slice(0, 30);
};

const generateSku = async (name) => {
  const prefix = slugify(name)
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, 8) || 'ITEM';

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `CD-${prefix}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    if (!(await Product.exists({ sku: candidate }))) return candidate;
  }

  throw new Error('Unable to generate a unique SKU.');
};

const validateProductInput = ({
  name,
  category,
  image,
  description,
  price,
  quantity,
}) => {
  if (!String(name || '').trim()) return 'Product name is required.';
  if (!String(category || '').trim()) return 'Category is required.';
  if (!String(image || '').trim()) return 'Product image URL is required.';
  if (!String(description || '').trim()) return 'Product description is required.';

  const numericPrice = Number(price);
  if (
    !Number.isFinite(numericPrice) ||
    numericPrice < 0 ||
    Math.round(numericPrice * 100) !== numericPrice * 100
  ) {
    return 'Price must be a valid non-negative number with at most two decimal places.';
  }

  const numericQuantity = Number(quantity);
  if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
    return 'Quantity must be a non-negative whole number.';
  }

  return null;
};

const migrateLegacyProducts = async () => {
  const legacyProducts = await Product.find({
    $or: [
      { sku: { $exists: false } },
      { sku: null },
      { quantity: { $exists: false } },
      { quantity: null },
      { manualOutOfStock: { $exists: false } },
    ],
  })
    .select('_id name inStock sku quantity manualOutOfStock')
    .lean();

  if (!legacyProducts.length) return 0;

  for (const product of legacyProducts) {
    const updates = {};

    if (!product.sku) {
      updates.sku = `CD-LEGACY-${product._id
        .toString()
        .slice(-10)
        .toUpperCase()}`;
    }

    if (
      product.quantity === undefined ||
      product.quantity === null
    ) {
      updates.quantity = product.inStock === false
        ? 0
        : LEGACY_DEFAULT_INVENTORY_QUANTITY;
    }

    if (product.manualOutOfStock === undefined) {
      updates.manualOutOfStock = false;
    }

    const effectiveQuantity =
      updates.quantity ?? Number(product.quantity || 0);
    const manualOutOfStock =
      updates.manualOutOfStock ?? Boolean(product.manualOutOfStock);

    updates.inStock =
      effectiveQuantity > 0 && !manualOutOfStock;

    await Product.updateOne(
      { _id: product._id },
      { $set: updates }
    );
  }

  return legacyProducts.length;
};

/* -------------------------------------------------------------------------- */
/* Public product catalog                                                     */
/* -------------------------------------------------------------------------- */

app.get('/', async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      inStock,
    } = req.query;

    const filter = {};

    if (category) filter.category = String(category);

    if (minPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $gte: Number(minPrice),
      };
    }

    if (maxPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $lte: Number(maxPrice),
      };
    }

    if (inStock !== undefined) {
      filter.inStock = inStock === 'true';
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error('[Product Service] Product list error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

app.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error('[Product Service] Product detail error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch product details' });
  }
});

/* -------------------------------------------------------------------------- */
/* Admin catalog management                                                   */
/* -------------------------------------------------------------------------- */

app.get(
  '/internal/admin/products',
  requireAdminInternal,
  async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(
        100,
        Math.max(1, Number(req.query.limit || 20))
      );
      const search = String(req.query.search || '').trim();
      const category = String(req.query.category || '').trim();
      const stockState = String(req.query.stockState || '')
        .trim()
        .toLowerCase();
      const filter = {};

      if (category) filter.category = category;

      if (stockState === 'available') {
        filter.$and = [
          { quantity: { $gt: 0 } },
          { manualOutOfStock: false },
        ];
      }

      if (stockState === 'out') {
        filter.$or = [
          { quantity: { $lte: 0 } },
          { manualOutOfStock: true },
          { inStock: false },
        ];
      }

      if (stockState === 'low') {
        filter.quantity = { $gt: 0, $lte: 5 };
      }

      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              { name: regex },
              { sku: regex },
              { slug: regex },
              { category: regex },
            ],
          },
        ];
      }

      const [products, total, categories] = await Promise.all([
        Product.find(filter)
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
        Product.distinct('category'),
      ]);

      return res.status(200).json({
        products,
        categories: categories.filter(Boolean).sort(),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error(
        '[Product Service] Admin catalog list error:',
        error
      );
      return res
        .status(500)
        .json({ error: 'Failed to load catalog.' });
    }
  }
);

app.post(
  '/internal/admin/products',
  requireAdminInternal,
  async (req, res) => {
    try {
      const body = req.body || {};
      const validationError = validateProductInput(body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const slug = slugify(body.slug || body.name);
      if (!slug) {
        return res
          .status(400)
          .json({ error: 'A valid product slug is required.' });
      }

      if (await Product.exists({ slug })) {
        return res.status(409).json({
          error: 'A product with this slug already exists.',
        });
      }

      const sku =
        String(body.sku || '').trim().toUpperCase() ||
        (await generateSku(body.name));

      if (await Product.exists({ sku })) {
        return res.status(409).json({
          error: 'A product with this SKU already exists.',
        });
      }

      const product = await Product.create({
        sku,
        name: String(body.name).trim(),
        slug,
        price: Number(body.price),
        category: String(body.category).trim(),
        image: String(body.image).trim(),
        description: String(body.description).trim(),
        features: normalizeFeatures(body.features),
        quantity: Number(body.quantity),
        manualOutOfStock: false,
        inStock: Number(body.quantity) > 0,
      });

      await InventoryMovement.create({
        productId: product._id,
        movementType: 'PRODUCT_CREATED',
        quantityDelta: product.quantity,
        beforeQuantity: 0,
        afterQuantity: product.quantity,
        reason: String(
          body.reason || 'Catalog product created.'
        )
          .trim()
          .slice(0, 500),
        source: 'ADMIN',
        actorAdminId: String(body.adminId || '') || null,
        actorAdminEmail: String(body.adminEmail || '') || null,
        requestId: String(body.requestId || '') || null,
      });

      return res.status(201).json({ product });
    } catch (error) {
      console.error(
        '[Product Service] Admin product creation error:',
        error
      );
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'A product with this SKU or slug already exists.',
        });
      }
      return res
        .status(500)
        .json({ error: 'Failed to create product.' });
    }
  }
);

app.post(
  '/internal/admin/products/bulk',
  requireAdminInternal,
  async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows)
        ? req.body.rows
        : [];
      const reason = String(req.body?.reason || '').trim();

      if (!rows.length) {
        return res
          .status(400)
          .json({ error: 'At least one product row is required.' });
      }
      if (rows.length > 500) {
        return res.status(400).json({
          error: 'Bulk import is limited to 500 rows per operation.',
        });
      }
      if (!reason) {
        return res.status(400).json({
          error: 'A reason is required for bulk import.',
        });
      }

      const prepared = [];
      const skuSet = new Set();
      const slugSet = new Set();

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const validationError = validateProductInput(row);
        if (validationError) {
          return res.status(400).json({
            error: `Row ${index + 2}: ${validationError}`,
          });
        }

        const sku = String(row.sku || '').trim().toUpperCase();
        if (!sku) {
          return res.status(400).json({
            error: `Row ${index + 2}: SKU is required for bulk import.`,
          });
        }

        const slug = slugify(row.slug || row.name);
        if (!slug) {
          return res.status(400).json({
            error: `Row ${index + 2}: valid slug is required.`,
          });
        }

        if (skuSet.has(sku)) {
          return res.status(409).json({
            error: `Row ${index + 2}: duplicate SKU in this import.`,
          });
        }
        if (slugSet.has(slug)) {
          return res.status(409).json({
            error: `Row ${index + 2}: duplicate slug in this import.`,
          });
        }

        skuSet.add(sku);
        slugSet.add(slug);

        prepared.push({
          sku,
          name: String(row.name).trim(),
          slug,
          price: Number(row.price),
          category: String(row.category).trim(),
          image: String(row.image).trim(),
          description: String(row.description).trim(),
          features: normalizeFeatures(row.features),
          quantity: Number(row.quantity),
          manualOutOfStock: false,
          inStock: Number(row.quantity) > 0,
        });
      }

      const [duplicateSku, duplicateSlug] = await Promise.all([
        Product.exists({ sku: { $in: [...skuSet] } }),
        Product.exists({ slug: { $in: [...slugSet] } }),
      ]);

      if (duplicateSku) {
        return res.status(409).json({
          error: 'One or more SKUs already exist in the catalog.',
        });
      }
      if (duplicateSlug) {
        return res.status(409).json({
          error: 'One or more slugs already exist in the catalog.',
        });
      }

      const session = await mongoose.startSession();
      let created = [];
      try {
        await session.withTransaction(async () => {
          created = await Product.insertMany(prepared, {
            session,
            ordered: true,
          });

          const movements = created.map((product) => ({
            productId: product._id,
            movementType: 'PRODUCT_CREATED',
            quantityDelta: product.quantity,
            beforeQuantity: 0,
            afterQuantity: product.quantity,
            reason: reason.slice(0, 500),
            source: 'ADMIN',
            actorAdminId:
              String(req.body?.adminId || '') || null,
            actorAdminEmail:
              String(req.body?.adminEmail || '') || null,
            requestId:
              String(req.body?.requestId || '') || null,
          }));

          await InventoryMovement.insertMany(movements, {
            session,
            ordered: true,
          });
        });
      } finally {
        await session.endSession();
      }

      return res.status(201).json({
        createdCount: created.length,
        products: created,
      });
    } catch (error) {
      console.error(
        '[Product Service] Bulk catalog import error:',
        error
      );
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'Bulk import conflicted with an existing SKU or slug.',
        });
      }
      return res.status(500).json({
        error: 'Bulk catalog import failed.',
      });
    }
  }
);

app.put(
  '/internal/admin/products/:productId',
  requireAdminInternal,
  async (req, res) => {
    try {
      const { productId } = req.params;
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const nextName = String(
        req.body?.name ?? product.name
      ).trim();
      const nextCategory = String(
        req.body?.category ?? product.category
      ).trim();
      const nextImage = String(
        req.body?.image ?? product.image
      ).trim();
      const nextDescription = String(
        req.body?.description ?? product.description
      ).trim();
      const nextSlug = slugify(
        req.body?.slug ?? product.slug
      );

      if (
        !nextName ||
        !nextCategory ||
        !nextImage ||
        !nextDescription ||
        !nextSlug
      ) {
        return res.status(400).json({
          error:
            'Name, slug, category, image and description are required.',
        });
      }

      const existing = await Product.findOne({
        slug: nextSlug,
        _id: { $ne: product._id },
      }).lean();
      if (existing) {
        return res.status(409).json({
          error: 'A product with this slug already exists.',
        });
      }

      const before = {
        name: product.name,
        slug: product.slug,
        category: product.category,
        image: product.image,
        description: product.description,
        features: product.features,
      };

      product.name = nextName;
      product.slug = nextSlug;
      product.category = nextCategory;
      product.image = nextImage;
      product.description = nextDescription;
      product.features = normalizeFeatures(
        req.body?.features ?? product.features
      );
      await product.save();

      return res.status(200).json({
        product,
        before,
        after: {
          name: product.name,
          slug: product.slug,
          category: product.category,
          image: product.image,
          description: product.description,
          features: product.features,
        },
      });
    } catch (error) {
      console.error(
        '[Product Service] Admin product update error:',
        error
      );
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'A product with this slug or SKU already exists.',
        });
      }
      return res.status(500).json({
        error: 'Failed to update product.',
      });
    }
  }
);

app.post(
  '/internal/admin/products/:productId/stock-adjust',
  requireAdminInternal,
  async (req, res) => {
    try {
      const result = await adjustStock({
        productId: req.params.productId,
        delta: req.body?.delta,
        reason: req.body?.reason,
        actorAdminId: req.body?.adminId,
        actorAdminEmail: req.body?.adminEmail,
        requestId: req.body?.requestId,
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error(
        '[Product Service] Admin stock adjustment error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message || 'Failed to adjust stock.',
        });
    }
  }
);

app.patch(
  '/internal/admin/products/:productId/availability',
  requireAdminInternal,
  async (req, res) => {
    try {
      const result = await setManualAvailability({
        productId: req.params.productId,
        available: Boolean(req.body?.available),
        reason: req.body?.reason,
        actorAdminId: req.body?.adminId,
        actorAdminEmail: req.body?.adminEmail,
        requestId: req.body?.requestId,
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error(
        '[Product Service] Admin availability change error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message || 'Failed to change availability.',
        });
    }
  }
);

app.get(
  '/internal/admin/products/:productId/inventory-history',
  requireAdminInternal,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
      }

      const product = await Product.findById(req.params.productId)
        .select('_id sku name quantity manualOutOfStock inStock')
        .lean();
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const history = await InventoryMovement.find({
        productId: product._id,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      return res.status(200).json({ product, history });
    } catch (error) {
      console.error(
        '[Product Service] Inventory history error:',
        error
      );
      return res.status(500).json({
        error: 'Failed to load inventory history.',
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Internal inventory reservation API                                        */
/* -------------------------------------------------------------------------- */

app.post(
  '/internal/inventory/reservations',
  requireAdminInternal,
  async (req, res) => {
    try {
      const result = await reserveInventory(req.body || {});
      return res
        .status(result.idempotent ? 200 : 201)
        .json({
          reservation: reservationResponse(result.reservation),
          idempotent: result.idempotent,
        });
    } catch (error) {
      console.error(
        '[Product Service] Inventory reservation error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message || 'Unable to reserve inventory.',
        });
    }
  }
);

app.get(
  '/internal/inventory/reservations/:reservationId',
  requireAdminInternal,
  async (req, res) => {
    try {
      const reservation = await getReservation(
        req.params.reservationId,
        req.query.userId || null
      );
      return res.status(200).json({
        reservation: reservationResponse(reservation),
      });
    } catch (error) {
      console.error(
        '[Product Service] Inventory reservation read error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message || 'Unable to load reservation.',
        });
    }
  }
);

app.post(
  '/internal/inventory/reservations/:reservationId/attach-order',
  requireAdminInternal,
  async (req, res) => {
    try {
      const reservation = await attachReservationOrder(
        req.params.reservationId,
        {
          userId: req.body?.userId || null,
          orderId: req.body?.orderId,
        }
      );
      return res.status(200).json({
        reservation: reservationResponse(reservation),
      });
    } catch (error) {
      console.error(
        '[Product Service] Inventory reservation attach error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message || 'Unable to attach reservation to order.',
        });
    }
  }
);

app.post(
  '/internal/inventory/reservations/:reservationId/commit',
  requireAdminInternal,
  async (req, res) => {
    try {
      const reservation = await commitReservation(
        req.params.reservationId,
        {
          userId: req.body?.userId || null,
          orderId: req.body?.orderId || null,
        }
      );
      return res.status(200).json({
        reservation: reservationResponse(reservation),
      });
    } catch (error) {
      console.error(
        '[Product Service] Inventory reservation commit error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message ||
            'Unable to commit inventory reservation.',
        });
    }
  }
);

app.post(
  '/internal/inventory/reservations/:reservationId/release',
  requireAdminInternal,
  async (req, res) => {
    try {
      const reservation = await releaseReservation(
        req.params.reservationId,
        {
          userId: req.body?.userId || null,
          reason:
            req.body?.reason ||
            'Stock reservation released.',
          allowCommitted: Boolean(req.body?.allowCommitted),
        }
      );
      return res.status(200).json({
        reservation: reservationResponse(reservation),
      });
    } catch (error) {
      console.error(
        '[Product Service] Inventory reservation release error:',
        error.message
      );
      return res
        .status(error.status || 500)
        .json({
          error:
            error.message ||
            'Unable to release inventory reservation.',
        });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Existing pricing operations                                                */
/* -------------------------------------------------------------------------- */

app.put(
  '/internal/admin/products/:productId/price',
  requireAdminInternal,
  async (req, res) => {
    try {
      const { productId } = req.params;
      const price = Number(req.body?.price);
      const reason = String(req.body?.reason || '').trim();
      const adminId = String(req.body?.adminId || '').trim();
      const adminEmail = String(req.body?.adminEmail || '').trim();
      const allowedReasons = new Set([
        'REGULAR_UPDATE',
        'SALE',
        'PROMOTION',
        'CLEARANCE',
        'FLASH_SALE',
        'CORRECTION',
      ]);

      if (
        !Number.isFinite(price) ||
        price < 0 ||
        Math.round(price * 100) !== price * 100
      ) {
        return res.status(400).json({
          error:
            'Price must be a valid non-negative number with at most two decimal places.',
        });
      }

      if (!allowedReasons.has(reason) || !adminId || !adminEmail) {
        return res.status(400).json({
          error:
            'Price change reason and admin identity are required.',
        });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const oldPrice = product.price;
      if (oldPrice === price) {
        return res.status(400).json({
          error: 'New price is the same as the current price.',
        });
      }

      product.price = price;
      await product.save();

      const priceChange = await PriceChange.create({
        productId: product._id,
        oldPrice,
        newPrice: price,
        reason,
        changedByAdminId: adminId,
        changedByEmail: adminEmail,
        effectiveAt: new Date(),
      });

      return res.status(200).json({
        message: 'Product price updated successfully.',
        product,
        priceChange,
      });
    } catch (error) {
      console.error('Error updating product price:', error);
      return res
        .status(500)
        .json({ error: 'Failed to update product price.' });
    }
  }
);

app.get(
  '/internal/admin/products/:productId/price-history',
  requireAdminInternal,
  async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await Product.findById(productId)
        .select('_id name price sku')
        .lean();
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const history = await PriceChange.find({ productId })
        .sort({ effectiveAt: -1 })
        .limit(100)
        .lean();
      return res.status(200).json({ product, history });
    } catch (error) {
      console.error('Error fetching price history:', error);
      return res
        .status(500)
        .json({ error: 'Failed to fetch price history.' });
    }
  }
);

app.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'product-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const start = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI_PRODUCTS ||
        'mongodb://localhost:27017/creatorsdesk_products'
    );

    const migratedCount = await migrateLegacyProducts();
    if (migratedCount) {
      console.log(
        `[Product Service] Migrated ${migratedCount} legacy catalog records to inventory fields.`
      );
    }

    await Product.init();
    await InventoryReservation.init();
    await InventoryMovement.init();

    setInterval(() => {
      expireReservations().catch((error) =>
        console.error(
          '[Product Service] Reservation expiry loop error:',
          error.message
        )
      );
    }, 30_000).unref();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`📦 Product Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      '❌ Product Service startup error:',
      error
    );
    process.exit(1);
  }
};

start();
