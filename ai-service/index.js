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

// ==================================================
// HEALTH CHECK
// ==================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ai-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==================================================
// DOMAIN VALIDATION (PRE-CHECK)
// ==================================================

app.post('/validate-domain', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const prompt = `
You are an AI for a tech and desk setup e-commerce store.
A user is looking for: "${query}"
Determine if this request is even remotely related to tech accessories, computers, desk gear, monitors, keyboards, cables, or office supplies.
Return ONLY valid JSON:
{
  "isValid": boolean,
  "reason": "If false, politely explain that you only sell tech, accessories, and desk gear."
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    res.status(200).json(JSON.parse(response.text));
  } catch (error) {
    console.error('❌ Validation Error:', error);
    // If it fails, fail open so we don't block the user unnecessarily
    res.status(200).json({ isValid: true }); 
  }
});

// ==================================================
// DESK BUILDER
// ==================================================

app.post('/desk-builder', async (req, res) => {
  try {
    const {
      useCase,
      budget,
      existingProducts = [],
      preferences = {}
    } = req.body;

    // ------------------------------------------------
    // 1. Validate user input
    // ------------------------------------------------
    if (!Array.isArray(useCase) || useCase.length === 0) {
      return res.status(400).json({ error: 'useCase must be a non-empty array' });
    }
    if (typeof budget !== 'number' || budget <= 0) {
      return res.status(400).json({ error: 'budget must be a positive number' });
    }

    // ------------------------------------------------
    // 2. Ask Gemini to analyze requirements
    // ------------------------------------------------
    const analysisPrompt = `
You are an AI desk setup expert for an e-commerce store.
Your catalog ONLY contains tech accessories, desk gear, monitors, keyboards, cables, etc.

Analyze the user's requirements. If the user asks for something unrelated to tech or desk setups (e.g., "airplane", "groceries"), set "isValidRequest" to false and provide a rejection reason.

USER REQUIREMENTS:
${JSON.stringify({ useCase, budget, existingProducts, preferences })}

Return exactly this JSON:
{
  "isValidRequest": boolean,
  "rejectionReason": "string (only if isValidRequest is false)",
  "useCases": [],
  "budget": { "max": number },
  "requiredCategories": [],
  "preferredCategories": [],
  "preferences": [],
  "existingProducts": []
}
`;

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: analysisPrompt,
      config: { responseMimeType: 'application/json' }
    });

    const requirements = JSON.parse(analysisResponse.text);

    // 🔥 Short-circuit if the request is absurd (fallback)
    if (requirements.isValidRequest === false) {
      return res.status(200).json({
        message: 'Invalid domain request',
        requirements,
        recommendations: {
          summary: requirements.rejectionReason || "I can only help with desk setups and tech accessories.",
          recommendations: [],
          totalPrice: 0,
          withinBudget: true
        }
      });
    }

    // ------------------------------------------------
    // 3. Fetch REAL catalog
    // ------------------------------------------------
    const productResponse = await fetch(`${PRODUCT_SERVICE_URL}/`);
    if (!productResponse.ok) {
      throw new Error(`Product service returned ${productResponse.status}`);
    }
    const catalog = await productResponse.json();

    // 🔥 STRIP DOWN CATALOG to prevent LLM hallucinations
    const cleanCatalog = catalog
      .filter(p => p.inStock)
      .map(p => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price
      }));

    // ------------------------------------------------
    // 4. Ask Gemini for recommendations
    // ------------------------------------------------
    const recommendationPrompt = `
You are an expert AI desk setup recommendation engine.
Recommend products ONLY from the supplied catalog. 
Note: Catalog prices are in USD ($). If the user budget is in another currency, do your best to estimate, but prioritize staying under the numerical budget provided.

USER REQUIREMENTS:
${JSON.stringify(requirements)}

AVAILABLE IN-STOCK PRODUCTS:
${JSON.stringify(cleanCatalog)}

RULES:
1. ONLY use "id" from the catalog.
2. NEVER invent products.
3. NEVER modify prices.
4. NEVER recommend something already owned.
5. Stay within the budget.
6. Return ONLY valid JSON.

Return exactly:
{
  "recommendations": [
    {
      "productId": "catalog id",
      "reason": "short explanation"
    }
  ],
  "summary": "short explanation"
}
`;

    const recommendationResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: recommendationPrompt,
      config: { responseMimeType: 'application/json' }
    });

    const aiResult = JSON.parse(recommendationResponse.text);

    // ------------------------------------------------
    // 5. BACKEND VALIDATION
    // ------------------------------------------------
    const catalogMap = new Map(catalog.map(product => [product._id.toString(), product]));
    const existingProductNames = existingProducts.map(p => p.toString().toLowerCase());
    const validatedRecommendations = [];

    for (const recommendation of aiResult.recommendations || []) {
      const productId = recommendation.productId?.toString();
      const realProduct = catalogMap.get(productId);

      if (!realProduct || !realProduct.inStock) continue;

      const isOwned = existingProductNames.some(
        name => realProduct.name.toLowerCase().includes(name) || realProduct.slug.toLowerCase().includes(name)
      );
      if (isOwned) continue;

      validatedRecommendations.push({
        productId: realProduct._id,
        name: realProduct.name,
        price: realProduct.price,
        image: realProduct.image,
        slug: realProduct.slug,
        reason: recommendation.reason || 'Recommended based on your preferences.'
      });
    }

    // ------------------------------------------------
    // 6. Calculate Total & Budget Filtering
    // ------------------------------------------------
    let finalRecommendations = [];
    let runningTotal = 0;

    for (const product of validatedRecommendations) {
      if (runningTotal + product.price <= budget) {
        finalRecommendations.push(product);
        runningTotal += product.price;
      }
    }

    // ------------------------------------------------
    // 7. Send trusted response
    // ------------------------------------------------
    res.status(200).json({
      message: 'Desk setup generated successfully',
      requirements,
      recommendations: {
        recommendations: finalRecommendations,
        totalPrice: runningTotal,
        withinBudget: runningTotal <= budget,
        summary: aiResult.summary || 'Here are the best matches from our catalog.'
      }
    });

  } catch (error) {
    console.error('❌ Desk Builder Error:', error);
    res.status(500).json({ error: 'Failed to process desk setup request' });
  }
});

// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
});