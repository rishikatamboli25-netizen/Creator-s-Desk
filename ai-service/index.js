import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5005;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || 'http://localhost:5002';


// --------------------------------------------------
// Health Check
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
// Desk Builder
// --------------------------------------------------

app.post('/desk-builder', async (req, res) => {
  try {
    const {
      useCase,
      budget,
      existingProducts,
      preferences
    } = req.body;

    if (!useCase || !budget) {
      return res.status(400).json({
        error: 'useCase and budget are required'
      });
    }

    // ----------------------------------------------
    // 1. Ask Gemini to understand the user
    // ----------------------------------------------

    const analysisPrompt = `
You are an AI desk setup expert for an ecommerce store.

Analyze the user's requirements and return ONLY valid JSON.

USER REQUIREMENTS:
${JSON.stringify({
  useCase,
  budget,
  existingProducts,
  preferences
})}

Return this exact structure:

{
  "useCases": [],
  "budget": {
    "max": number
  },
  "requiredCategories": [],
  "preferredCategories": [],
  "preferences": [],
  "existingProducts": []
}

Rules:
- Keep the budget exactly as provided.
- Do not invent products.
- Categories should describe the types of products useful for the setup.
- Consider the user's existing products so you don't recommend duplicates.
`;

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: analysisPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const requirements = JSON.parse(
      analysisResponse.text
    );


    // ----------------------------------------------
    // 2. Get real products from Product Service
    // ----------------------------------------------

    const productResponse = await fetch(
      `${PRODUCT_SERVICE_URL}/`
    );

    if (!productResponse.ok) {
      throw new Error(
        `Product service returned ${productResponse.status}`
      );
    }

    const catalog = await productResponse.json();


    // ----------------------------------------------
    // 3. Ask Gemini to recommend products
    // ----------------------------------------------

    const recommendationPrompt = `
You are an expert AI desk setup recommendation engine.

Your job is to recommend products ONLY from the provided catalog.

USER REQUIREMENTS:
${JSON.stringify(requirements)}

AVAILABLE PRODUCTS:
${JSON.stringify(catalog)}

IMPORTANT RULES:

1. ONLY recommend products whose "_id" exists in the catalog.
2. NEVER invent a product.
3. NEVER change a product's price.
4. NEVER recommend products where "inStock" is false.
5. Do not recommend products the user already owns.
6. Stay within the user's maximum budget.
7. Prefer products matching the user's use cases and preferences.
8. Recommend between 2 and 5 products.
9. Explain briefly why each product fits the setup.
10. If the catalog does not contain suitable products, return an empty recommendations array.
11. The total price must be calculated from the catalog prices.

Return ONLY valid JSON using this exact structure:

{
  "recommendations": [
    {
      "productId": "catalog _id",
      "name": "catalog product name",
      "price": number,
      "reason": "short explanation"
    }
  ],
  "totalPrice": number,
  "withinBudget": true,
  "summary": "short explanation of the recommended setup"
}
`;

    const recommendationResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: recommendationPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const recommendations = JSON.parse(
      recommendationResponse.text
    );


    // ----------------------------------------------
    // 4. Return final result
    // ----------------------------------------------

    res.status(200).json({
      message: 'Desk setup generated successfully',
      requirements,
      recommendations
    });

  } catch (error) {
    console.error('❌ Desk Builder Error:', error);

    res.status(500).json({
      error: 'Failed to process desk setup request'
    });
  }
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
});