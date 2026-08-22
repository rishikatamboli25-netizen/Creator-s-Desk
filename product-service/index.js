import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from './models/Product.js'; 

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
    const { category } = req.query;
    const filter = category ? { category } : {};
    
    const products = await Product.find(filter);
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
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