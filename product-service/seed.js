import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

// Here is a sample of your catalog matching the Schema we built
const catalogData = [
  // --- ACCESSORIES ---
  {
    name: "The Executive Desk Mat",
    slug: "executive-desk-mat",
    sku: "CD-ACC-001",
    quantity: 25,
    manualOutOfStock: false,
    price: 45.00,
    category: "Accessories",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/executive-desk-mat.jpg",
    description: "Premium vegan leather desk mat that protects your workspace while providing a smooth glide for your mouse.",
    features: ["Water-resistant", "Anti-slip base", "900mm x 400mm"],
    inStock: true
  },
  {
    name: "Wireless Charging Pad Pro",
    slug: "wireless-charging-pad-pro",
    sku: "CD-ACC-002",
    quantity: 20,
    manualOutOfStock: false,
    price: 65.00,
    category: "Accessories",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/wireless-charging-pad-pro.jpg",
    description: "Sleek aluminum wireless charger that blends perfectly into any modern desk setup. Supports 15W fast charging.",
    features: ["15W Qi-Certified Fast Charge", "Matte Aluminum Finish", "LED Status Indicator"],
    inStock: true
  },
  {
    name: "Ergonomic Walnut Wrist Rest",
    slug: "ergonomic-walnut-wrist-rest",
    sku: "CD-ACC-003",
    quantity: 18,
    manualOutOfStock: false,
    price: 35.00,
    category: "Accessories",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/ergonomic-walnut-wrist-rest.jpg",
    description: "Hand-carved solid American walnut wrist rest designed to perfectly align with 65% and TKL mechanical keyboards.",
    features: ["Solid American Walnut", "Anti-slip rubber feet", "Finished with natural oils"],
    inStock: true
  },

  // --- DESK ORGANIZERS ---
  {
    name: "Minimalist Monitor Stand",
    slug: "minimalist-monitor-stand",
    sku: "CD-ORG-001",
    quantity: 15,
    manualOutOfStock: false,
    price: 89.00,
    category: "Desk Organizers",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/minimalist-monitor-stand.webp",
    description: "Elevate your screen to eye level and slide your keyboard underneath at the end of the day.",
    features: ["Solid walnut wood", "Holds up to 50 lbs", "Built-in cable routing"],
    inStock: true
  },
  {
    name: "Aluminum Catchall Tray",
    slug: "aluminum-catchall-tray",
    sku: "CD-ORG-002",
    quantity: 30,
    manualOutOfStock: false,
    price: 28.00,
    category: "Desk Organizers",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/aluminum-catchall-tray.jpg",
    description: "Keep your keys, SD cards, and loose items organized in this precision-machined aluminum tray.",
    features: ["Aerospace-grade aluminum", "Micro-textured finish", "Scratch-resistant padding"],
    inStock: true
  },
  {
    name: "Under-Desk Cable Management Grid",
    slug: "under-desk-cable-grid",
    sku: "CD-ORG-003",
    quantity: 12,
    manualOutOfStock: false,
    price: 42.00,
    category: "Desk Organizers",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/under-desk-cable-grid.webp",
    description: "Hide the rat's nest. This heavy-duty steel grid mounts under your desk to hold power strips and route cables cleanly.",
    features: ["Powder-coated steel", "Includes mounting hardware", "Supports 20 lbs of cables/bricks"],
    inStock: true
  },

  // --- KEYCAPS ---
  {
    name: "Artisan Keycap Set - Midnight",
    slug: "artisan-keycap-set-midnight",
    sku: "CD-KC-001",
    quantity: 14,
    manualOutOfStock: false,
    price: 120.00,
    category: "Keycaps",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/artisan-keycap-set-midnight.jpg",
    description: "Double-shot PBT keycaps in a striking midnight blue and stealth grey colorway.",
    features: ["Cherry profile", "114 keys included", "Fade resistant"],
    inStock: true
  },
  {
    name: "Matcha Green PBT Keycaps",
    slug: "matcha-green-pbt-keycaps",
    sku: "CD-KC-002",
    quantity: 22,
    manualOutOfStock: false,
    price: 85.00,
    category: "Keycaps",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/matcha-green-pbt-keycaps.webp",
    description: "Bring a calming, earthy vibe to your workspace with this thick PBT keycap set featuring dye-sublimated Japanese root characters.",
    features: ["XDA Profile", "Dye-Sublimated Legends", "125 keys included"],
    inStock: true
  },
  {
    name: "Resin Galaxy Spacebar",
    slug: "resin-galaxy-spacebar",
    sku: "CD-KC-003",
    quantity: 0,
    manualOutOfStock: true,
    price: 45.00,
    category: "Keycaps",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/resin-galaxy-spacebar.jpg",
    description: "A handcrafted resin spacebar that encapsulates a tiny, swirling galaxy. Every piece is entirely unique.",
    features: ["Hand-poured resin", "6.25u size", "OEM Profile"],
    inStock: false 
  },

  // --- TECH ---
  {
    name: "Coiled Aviator Cable (USB-C)",
    slug: "coiled-aviator-cable",
    sku: "CD-TECH-001",
    quantity: 35,
    manualOutOfStock: false,
    price: 55.00,
    category: "Tech",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/coiled-aviator-cable.jpg",
    description: "Upgrade your keyboard aesthetic with this premium double-sleeved coiled cable featuring a heavy-duty aviator connector.",
    features: ["USB-A to USB-C", "5-pin Aviator Connector", "Double-sleeved paracord"],
    inStock: true
  },
  {
    name: "Magnetic Screen Light Bar",
    slug: "magnetic-screen-light-bar",
    sku: "CD-TECH-002",
    quantity: 10,
    manualOutOfStock: false,
    price: 110.00,
    category: "Tech",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/magnetic-screen-light-bar.webp",
    description: "Reduce eye strain. This asymmetrical light bar mounts perfectly to your monitor, illuminating only your desk area without glaring on the screen.",
    features: ["Adjustable color temp (2700K-6500K)", "Wireless remote dial", "No screen glare"],
    inStock: true
  },
  {
    name: "Alloy Headphone Stand",
    slug: "alloy-headphone-stand",
    sku: "CD-TECH-003",
    quantity: 16,
    manualOutOfStock: false,
    price: 48.00,
    category: "Tech",
    image: "https://creatorsdesks-product-images.s3.ap-south-1.amazonaws.com/alloy-headphone-stand.jpg",
    description: "Showcase your premium audio gear on this weighted, solid aluminum headphone stand.",
    features: ["Silicone top pad", "Weighted anti-tip base", "Anodized finish"],
    inStock: true
  }
];

const seedDatabase = async () => {
  try {
    // 1. Connect to Atlas
    await mongoose.connect(process.env.MONGO_URI_PRODUCTS);
    console.log('✅ Connected to MongoDB Atlas for Seeding');

    // 2. Clear existing products to prevent duplicates
    await Product.deleteMany({});
    console.log('🧹 Cleared existing catalog');

    // 3. Insert the new products
    await Product.insertMany(catalogData);
    console.log('📦 Successfully seeded database with products!');

    // 4. Disconnect safely
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
