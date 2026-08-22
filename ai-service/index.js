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
      return res.status(400).json({
        error: 'useCase must be a non-empty array'
      });
    }

    if (
      typeof budget !== 'number' ||
      budget <= 0
    ) {
      return res.status(400).json({
        error: 'budget must be a positive number'
      });
    }


    // ------------------------------------------------
    // 2. Ask Gemini to analyze requirements
    // ------------------------------------------------

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

Return exactly:

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
- Categories should describe useful product types.
- Consider existing products.
- Do not recommend products yet.
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


    // ------------------------------------------------
    // 3. Fetch REAL catalog
    // ------------------------------------------------

    const productResponse = await fetch(
      `${PRODUCT_SERVICE_URL}/`
    );

    if (!productResponse.ok) {
      throw new Error(
        `Product service returned ${productResponse.status}`
      );
    }

    const catalog = await productResponse.json();


    // ------------------------------------------------
    // 4. Ask Gemini for recommendations
    // ------------------------------------------------

    const recommendationPrompt = `
You are an expert AI desk setup recommendation engine.

Recommend products ONLY from the supplied catalog.

USER REQUIREMENTS:
${JSON.stringify(requirements)}

AVAILABLE PRODUCTS:
${JSON.stringify(catalog)}

RULES:

1. ONLY use product IDs from the catalog.
2. NEVER invent products.
3. NEVER modify prices.
4. NEVER recommend out-of-stock products.
5. NEVER recommend something already owned.
6. Stay within the budget.
7. Recommend between 2 and 5 products when possible.
8. Explain why each product fits.
9. Return ONLY valid JSON.

Return exactly:

{
  "recommendations": [
    {
      "productId": "catalog _id",
      "name": "catalog product name",
      "price": number,
      "reason": "short explanation"
    }
  ],
  "summary": "short explanation"
}
`;

    const recommendationResponse =
      await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: recommendationPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

    const aiResult = JSON.parse(
      recommendationResponse.text
    );


    // ------------------------------------------------
    // 5. BACKEND VALIDATION
    // ------------------------------------------------

    const catalogMap = new Map(
      catalog.map(product => [
        product._id.toString(),
        product
      ])
    );

    const existingProductNames =
      existingProducts.map(product =>
        product.toString().toLowerCase()
      );


    const validatedRecommendations = [];


    for (const recommendation of
      aiResult.recommendations || []) {

      const productId =
        recommendation.productId?.toString();

      const realProduct =
        catalogMap.get(productId);


      // ----------------------------------------------
      // Product must exist
      // ----------------------------------------------

      if (!realProduct) {
        console.warn(
          `⚠️ AI recommended unknown product: ${productId}`
        );

        continue;
      }


      // ----------------------------------------------
      // Product must be in stock
      // ----------------------------------------------

      if (!realProduct.inStock) {
        console.warn(
          `⚠️ AI recommended out-of-stock product: ${realProduct.name}`
        );

        continue;
      }


      // ----------------------------------------------
      // Don't recommend existing products
      // ----------------------------------------------

      if (
        existingProductNames.includes(
          realProduct.name.toLowerCase()
        ) ||
        existingProductNames.includes(
          realProduct.slug.toLowerCase()
        ) ||
        existingProductNames.includes(
          realProduct._id.toString().toLowerCase()
        )
      ) {
        continue;
      }


      // ----------------------------------------------
      // ALWAYS use DB price
      // ----------------------------------------------

      validatedRecommendations.push({
        productId: realProduct._id,
        name: realProduct.name,
        price: realProduct.price,
        image: realProduct.image,
        slug: realProduct.slug,
        reason:
          recommendation.reason ||
          'Recommended based on your desk setup preferences.'
      });
    }


    // ------------------------------------------------
    // 6. Backend calculates total
    // ------------------------------------------------

    const totalPrice =
      validatedRecommendations.reduce(
        (total, product) =>
          total + product.price,
        0
      );


    // ------------------------------------------------
    // 7. Final budget validation
    // ------------------------------------------------

    const withinBudget =
      totalPrice <= budget;


    let finalRecommendations =
      validatedRecommendations;


    // Safety fallback:
    // If Gemini somehow returned products above budget,
    // remove products until the total is within budget.

    if (!withinBudget) {

      finalRecommendations = [];

      let runningTotal = 0;

      for (const product of
        validatedRecommendations) {

        if (
          runningTotal + product.price <=
          budget
        ) {
          finalRecommendations.push(product);

          runningTotal += product.price;
        }
      }
    }


    // Recalculate after budget filtering

    const finalTotal =
      finalRecommendations.reduce(
        (total, product) =>
          total + product.price,
        0
      );


    // ------------------------------------------------
    // 8. Send trusted response
    // ------------------------------------------------

    res.status(200).json({

      message:
        'Desk setup generated successfully',

      requirements,

      recommendations: {

        recommendations:
          finalRecommendations,

        totalPrice:
          finalTotal,

        withinBudget:
          finalTotal <= budget,

        summary:
          aiResult.summary ||
          'Recommended products selected based on your requirements.'
      }
    });


  } catch (error) {

    console.error(
      '❌ Desk Builder Error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to process desk setup request'
    });
  }
});


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🤖 AI Service running on port ${PORT}`
    );
  }
);