import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5005;

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || 'http://localhost:5002';

// --------------------------------------------------
// GEMINI
// --------------------------------------------------

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ai-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// GET PRODUCTS FROM PRODUCT SERVICE
// --------------------------------------------------

const getProducts = async ({
  category,
  minPrice,
  maxPrice,
  inStock
}) => {
  const params = new URLSearchParams();

  if (category) {
    params.append('category', category);
  }

  if (minPrice !== undefined) {
    params.append('minPrice', minPrice);
  }

  if (maxPrice !== undefined) {
    params.append('maxPrice', maxPrice);
  }

  if (inStock !== undefined) {
    params.append('inStock', inStock);
  }

  const url = `${PRODUCT_SERVICE_URL}/?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Product Service returned status ${response.status}`
    );
  }

  return response.json();
};

// --------------------------------------------------
// GEMINI — REQUIREMENT ANALYZER
// --------------------------------------------------

const analyzeRequirements = async ({
  useCase,
  budget,
  existingProducts,
  preferences
}) => {

  const prompt = `
You are an AI desk setup planner for an ecommerce store called Creator's Desk.

Your job is to understand what kind of desk setup the customer wants.

DO NOT recommend specific products yet.

Convert the customer's request into structured requirements.

Customer request:

Use cases:
${JSON.stringify(useCase)}

Budget:
${budget}

Existing products:
${JSON.stringify(existingProducts || [])}

Preferences:
${JSON.stringify(preferences || {})}

Return ONLY valid JSON.

Use exactly this structure:

{
  "useCases": [],
  "budget": {
    "max": 0
  },
  "requiredCategories": [],
  "preferredCategories": [],
  "preferences": [],
  "existingProducts": []
}

Rules:

1. Do not invent information that the customer did not provide.
2. requiredCategories = things that are genuinely necessary.
3. preferredCategories = useful but optional additions.
4. Keep category names broad enough to match an ecommerce catalog.
5. Respect the customer's budget.
6. Preserve existingProducts.
7. Do not recommend product names yet.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  return JSON.parse(response.text);
};

// --------------------------------------------------
// DESK BUILDER

// --------------------------------------------------

app.post('/desk-builder', async (req, res) => {
  try {

    const {
      useCase,
      budget,
      existingProducts,
      preferences
    } = req.body;

    // ----------------------------------------------
    // VALIDATION
    // ----------------------------------------------

    if (!useCase || !budget) {
      return res.status(400).json({
        error: 'useCase and budget are required'
      });
    }

    // ----------------------------------------------
    // STEP 1 — UNDERSTAND USER
    // ----------------------------------------------

    const requirements = await analyzeRequirements({
      useCase,
      budget,
      existingProducts: existingProducts || [],
      preferences: preferences || {}
    });

    // ----------------------------------------------
    // STEP 2 — GET AVAILABLE PRODUCTS
    // ----------------------------------------------

    const products = await getProducts({
      inStock: true
    });

    // ----------------------------------------------
    // RESPONSE
    // ----------------------------------------------

    res.status(200).json({
      message: 'Desk Builder analyzed the request',

      requirements,

      catalog: {
        totalProducts: products.length,
        products
      }
    });

  } catch (error) {

    console.error('Desk Builder Error:', error);

    res.status(500).json({
      error: 'Failed to process desk setup request'
    });

  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
});