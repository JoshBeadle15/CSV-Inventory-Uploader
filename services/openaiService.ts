import { ColumnMapping } from '../types';

// A list of core Shopify fields the user can map to.
export const SHOPIFY_TARGET_FIELDS = [
  'title', 'body_html', 'vendor', 'product_type', 'tags', 
  'variants.price', 'variants.sku', 'variants.inventory_quantity',
  'images.src'
];

// API endpoint URL for the backend server (server.js)
// When running locally, this defaults to localhost:5001
// When deployed, both the script and server run in the same container
const API_BASE_URL = process.env.BACKEND_API_URL || 'http://localhost:5001';

export const generateShopifyProductJson = async (
  rowData: Record<string, any>,
  mapping: ColumnMapping
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-shopify-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rowData, mapping })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Backend API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.data) {
      throw new Error("Received an empty response from backend.");
    }

    return result.data;
  } catch (error) {
    console.error("Error calling backend API:", error);
    if (error instanceof Error) {
      throw new Error(`Backend API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the backend.");
  }
};