import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

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

// Initialize OpenAI with API key from server environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON Schema for Shopify product format
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
        variants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              price: { type: "string", description: "Price as string" },
              sku: { type: "string", description: "Stock keeping unit" },
              inventory_quantity: { type: "integer", description: "Inventory count" },
              option1: { type: "string", description: "Variant option (e.g., 'Default Title')" }
            },
            required: ["price", "sku", "inventory_quantity", "option1"]
          },
          description: "Product variants"
        },
        images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              src: { type: "string", description: "Image URL" }
            },
            required: ["src"]
          },
          description: "Product images"
        }
      },
      required: ["title", "body_html", "vendor", "product_type", "tags", "variants", "images"]
    }
  },
  required: ["product"]
};

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
Always ensure all required fields are populated. If a value is missing, provide a reasonable default.`;

    const userPrompt = `
Given the following single product data from a source CSV, please create a product listing in JSON format that is compatible with the Shopify Product API.

Source Product Data:
${sourceDataDescription}

Use the following mapping rules to populate the Shopify fields from the source data:
${mappingDescription}

Instructions for generation:
1. Use the mapped fields to construct the JSON. For example, if Shopify 'title' is mapped to source 'product_name', use the value of 'product_name' for the 'title' field in the JSON.
2. The 'body_html' should be well-formatted HTML.
3. The 'tags' should be a comma-separated string.
4. The variant's 'price' must be a string.
5. The variant's 'option1' should be "Default Title".
6. Create a single variant and a single image object.

Generate ONLY valid JSON output that matches the required schema.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
      return res.status(500).json({ error: 'Received an empty response from OpenAI' });
    }

    res.json({ success: true, data: jsonText });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
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
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY environment variable is not set!');
  }
});