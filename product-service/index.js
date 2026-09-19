import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import PriceChange from './models/PriceChange.js'; 

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5002; 

mongoose.connect(process.env.MONGO_URI_PRODUCTS || 'mongodb://localhost:27017/creatorsdesk_products')
  .then(() => console.log('✅ Product Service DB Connected'))
  .catch((err) => console.error('❌ Product DB Connection Error:', err));

// --- CORRECTED ROUTES (Prefixes Dropped) ---

// 1. Get ALL Products
app.get('/', async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      inStock
    } = req.query;

    const filter = {};

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Minimum price
    if (minPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $gte: Number(minPrice)
      };
    }

    // Maximum price
    if (maxPrice !== undefined) {
      filter.price = {
        ...filter.price,
        $lte: Number(maxPrice)
      };
    }

    // Stock filter
    if (inStock !== undefined) {
      filter.inStock = inStock === 'true';
    }

    const products = await Product.find(filter);

    res.status(200).json(products);

  } catch (error) {
    console.error('Error fetching products:', error);

    res.status(500).json({
      error: 'Failed to fetch catalog'
    });
  }
});

// 2. Get a SINGLE Product by Slug
app.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

const requireAdminInternal = (req, res, next) => {
  const expected = process.env.ADMIN_INTERNAL_SECRET || '';
  const received = req.get('x-admin-internal-secret') || '';

  if (!expected || received !== expected) {
    return res.status(403).json({ error: 'Admin internal access denied.' });
  }

  next();
};

app.put('/internal/admin/products/:productId/price', requireAdminInternal, async (req, res) => {
  try {
    const { productId } = req.params;
    const price = Number(req.body?.price);
    const reason = String(req.body?.reason || '').trim();
    const adminId = String(req.body?.adminId || '').trim();
    const adminEmail = String(req.body?.adminEmail || '').trim();
    const allowedReasons = new Set(['REGULAR_UPDATE', 'SALE', 'PROMOTION', 'CLEARANCE', 'FLASH_SALE', 'CORRECTION']);

    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number with at most two decimal places.' });
    }
    if (!allowedReasons.has(reason) || !adminId || !adminEmail) {
      return res.status(400).json({ error: 'Price change reason and admin identity are required.' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const oldPrice = product.price;
    if (oldPrice === price) return res.status(400).json({ error: 'New price is the same as the current price.' });

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

    return res.status(200).json({ message: 'Product price updated successfully.', product, priceChange });
  } catch (error) {
    console.error('Error updating product price:', error);
    return res.status(500).json({ error: 'Failed to update product price.' });
  }
});

app.get('/internal/admin/products/:productId/price-history', requireAdminInternal, async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId).select('_id name price').lean();
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const history = await PriceChange.find({ productId }).sort({ effectiveAt: -1 }).limit(100).lean();
    return res.status(200).json({ product, history });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return res.status(500).json({ error: 'Failed to fetch price history.' });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'product-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📦 Product Service running on port ${PORT}`);
});