import { ShopifyProductData } from '../types';

interface ShopifyCreateResponse {
  success: boolean;
  shopifyId: number;
  message: string;
}

/**
 * Creates a product draft on Shopify using the Admin API or simulates it in Demo Mode.
 * @param productData The Shopify-formatted product data.
 * @param storeName The name of the Shopify store (e.g., 'your-store').
 * @param accessToken The Admin API access token.
 * @param isDemoMode Flag to enable simulation instead of a real API call.
 * @returns A promise that resolves with the success response.
 */
export const createProductDraft = async (
    productData: ShopifyProductData,
    storeName: string,
    accessToken: string,
    isDemoMode: boolean
): Promise<ShopifyCreateResponse> => {
    if (isDemoMode) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              // Generate a random mock ID for display purposes
              shopifyId: Math.floor(1000000000000 + Math.random() * 9000000000000),
              message: 'Product draft created successfully in Demo Mode.',
            });
          }, 1500); // Simulate network delay
        });
    }

    const API_VERSION = '2024-07';
    // Ensure storeName doesn't contain the full domain
    const sanitizedStoreName = storeName.replace('.myshopify.com', '');
    const url = `https://${sanitizedStoreName}.myshopify.com/admin/api/${API_VERSION}/products.json`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify(productData),
        });

        const responseData = await response.json();

        if (!response.ok) {
            // Shopify often provides detailed errors in the 'errors' field.
            const errorMessage = responseData.errors 
                ? `Shopify Error: ${JSON.stringify(responseData.errors)}`
                : `Shopify API returned status ${response.status}`;
            throw new Error(errorMessage);
        }

        return {
            success: true,
            shopifyId: responseData.product.id,
            message: 'Product draft created successfully on Shopify.',
        };
    } catch (error) {
        console.error('Error creating Shopify draft:', error);
        
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('Network error: Failed to fetch. This may be a CORS issue. The Shopify Admin API cannot be called directly from a browser for security reasons. This tool is intended for development, and you may need a browser extension to disable CORS protection.');
        }
        // Re-throw the original or constructed error to be caught by the calling function
        throw error;
    }
};