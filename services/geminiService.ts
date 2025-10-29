
import { GoogleGenAI, Type } from "@google/genai";
import { ColumnMapping } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// A list of core Shopify fields the user can map to.
export const SHOPIFY_TARGET_FIELDS = [
  'title', 'body_html', 'vendor', 'product_type', 'tags', 
  'variants.price', 'variants.sku', 'variants.inventory_quantity',
  'images.src'
];

export const generateShopifyProductJson = async (
  rowData: Record<string, any>,
  mapping: ColumnMapping
): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  // Construct a dynamic list of source data and mappings for the prompt
  const sourceDataDescription = Object.entries(rowData)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const mappingDescription = Object.entries(mapping)
    .filter(([_, aimsiiHeader]) => aimsiiHeader)
    .map(([shopifyHeader, aimsiiHeader]) => `- Shopify '${shopifyHeader}' should use the value from source field '${aimsiiHeader}'.`)
    .join('\n');

  const prompt = `
    Given the following single product data from a source CSV, please create a product listing in JSON format that is compatible with the Shopify Product API.

    Source Product Data:
    ${sourceDataDescription}

    Use the following mapping rules to populate the Shopify fields from the source data:
    ${mappingDescription}

    Instructions for generation:
    1.  Use the mapped fields to construct the JSON. For example, if Shopify 'title' is mapped to source 'product_name', use the value of 'product_name' for the 'title' field in the JSON.
    2.  The 'body_html' should be well-formatted HTML.
    3.  The 'tags' should be a comma-separated string.
    4.  The variant's 'price' must be a string.
    5.  The variant's 'option1' should be "Default Title".
    6.  Create a single variant and a single image object.
    
    Generate ONLY the JSON output, adhering to the schema provided.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      product: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body_html: { type: Type.STRING },
          vendor: { type: Type.STRING },
          product_type: { type: Type.STRING },
          tags: { type: Type.STRING },
          variants: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                price: { type: Type.STRING },
                sku: { type: Type.STRING },
                inventory_quantity: { type: Type.INTEGER },
                option1: { type: Type.STRING },
              },
              required: ['price', 'sku', 'inventory_quantity', 'option1']
            }
          },
          images: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                src: { type: Type.STRING }
              },
              required: ['src']
            }
          }
        },
        required: ['title', 'body_html', 'vendor', 'product_type', 'tags', 'variants', 'images']
      }
    },
    required: ['product']
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("Received an empty response from the AI.");
    }
    return jsonText;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the Gemini API.");
  }
};
