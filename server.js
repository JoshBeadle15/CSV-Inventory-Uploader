import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env (server-side only)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Enable CORS with specific configuration for development
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// AI Provider configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'gemini'

// Initialize OpenAI (if selected)
let openai;
if (AI_PROVIDER === 'openai') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Initialize Google Gemini (if selected)
let gemini;
if (AI_PROVIDER === 'gemini') {
  gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// JSON Schema for Shopify product format
// NOTE: Images are NOT included - they will be added manually later
const shopifyProductSchema = {
  type: "object",
  properties: {
    product: {
      type: "object",
      properties: {
        title: { type: "string", description: "Product title" },
        body_html: { type: "string", description: "Product description in HTML format" },
        vendor: { type: "string", description: "Product vendor/manufacturer" },
        product_type: { type: "string", description: "Product type/category" },
        tags: { type: "string", description: "Comma-separated tags" },
        published: { type: "boolean", description: "Whether product is published (always false for drafts)" },
        variants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              price: { type: "string", description: "Price as string" },
              sku: { type: "string", description: "Stock keeping unit" },
              inventory_quantity: { type: "integer", description: "Inventory count" },
              barcode: { type: "string", description: "Product barcode" },
              option1: { type: "string", description: "Variant option (e.g., 'Default Title')" }
            },
            required: ["price", "sku", "inventory_quantity", "option1"]
          },
          description: "Product variants"
        }
      },
      required: ["title", "body_html", "vendor", "product_type", "tags", "published", "variants"]
    }
  },
  required: ["product"]
};

/**
 * Generate product JSON using OpenAI
 */
async function generateWithOpenAI(sourceDataDescription, mappingDescription, systemPrompt, userPrompt) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ShopifyProduct",
        schema: shopifyProductSchema,
        strict: true
      }
    },
    temperature: 0.2
  });

  const jsonText = response.choices[0]?.message?.content?.trim();

  if (!jsonText) {
    throw new Error('Received an empty response from OpenAI');
  }

  return jsonText;
}

/**
 * Generate product JSON using Google Gemini
 */
async function generateWithGemini(sourceDataDescription, mappingDescription, systemPrompt, userPrompt) {
  const model = gemini.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    }
  });

  const fullPrompt = `${systemPrompt}

${userPrompt}

IMPORTANT: You must respond with valid JSON matching this exact schema:
${JSON.stringify(shopifyProductSchema, null, 2)}`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const jsonText = response.text().trim();

  if (!jsonText) {
    throw new Error('Received an empty response from Gemini');
  }

  // Validate it's valid JSON
  JSON.parse(jsonText);

  return jsonText;
}

// API endpoint for generating Shopify product JSON
app.post('/api/generate-shopify-product', async (req, res) => {
  try {
    const { rowData, mapping } = req.body;

    if (!rowData || !mapping) {
      return res.status(400).json({ error: 'Missing rowData or mapping in request body' });
    }

    // Construct a dynamic list of source data and mappings for the prompt
    const sourceDataDescription = Object.entries(rowData)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    const mappingDescription = Object.entries(mapping)
      .filter(([_, aimsiiHeader]) => aimsiiHeader)
      .map(([shopifyHeader, aimsiiHeader]) => `- Shopify '${shopifyHeader}' should use the value from source field '${aimsiiHeader}'.`)
      .join('\n');

    const systemPrompt = `You are a data transformation expert specializing in converting product data into Shopify-compatible JSON format.
Your task is to take source product data and mapping rules, then generate a valid JSON object that adheres to the Shopify Product API schema.
Always ensure all required fields are populated. If a value is missing, provide a reasonable default.

CRITICAL: DO NOT include an images array or image URLs. Images will be added manually later.
CRITICAL: ALWAYS set published: false (products must be created as drafts).`;

    const userPrompt = `
Given the following single product data from a source CSV, please create a product listing in JSON format that is compatible with the Shopify Product API.

Source Product Data:
${sourceDataDescription}

Use the following mapping rules to populate the Shopify fields from the source data:
${mappingDescription}

Instructions for generation:
1. Use the mapped fields to construct the JSON. For example, if Shopify 'title' is mapped to source 'product_name', use the value of 'product_name' for the 'title' field in the JSON.
2. The 'body_html' should be well-formatted HTML with professional product description.
3. The 'tags' should be a comma-separated string for searchability.
4. The variant's 'price' must be a string.
5. The variant's 'option1' should be "Default Title".
6. Set 'published' to false (product will be a draft).
7. DO NOT include an 'images' field or array - images will be added manually later.
8. Include barcode in variant if available in source data.

Generate ONLY valid JSON output that matches the required schema.`;

    // Generate using the selected AI provider
    let jsonText;
    if (AI_PROVIDER === 'openai') {
      jsonText = await generateWithOpenAI(sourceDataDescription, mappingDescription, systemPrompt, userPrompt);
    } else if (AI_PROVIDER === 'gemini') {
      jsonText = await generateWithGemini(sourceDataDescription, mappingDescription, systemPrompt, userPrompt);
    } else {
      return res.status(500).json({ error: `Unknown AI provider: ${AI_PROVIDER}` });
    }

    res.json({ success: true, data: jsonText });
  } catch (error) {
    console.error(`Error calling ${AI_PROVIDER.toUpperCase()} API:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/generate-shopify-product`);
  console.log(`🤖 AI Provider: ${AI_PROVIDER.toUpperCase()}`);

  // Validate API keys based on provider
  if (AI_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY environment variable is not set!');
  }
  if (AI_PROVIDER === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable is not set!');
  }
});