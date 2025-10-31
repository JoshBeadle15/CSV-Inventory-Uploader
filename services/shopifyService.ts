import { ShopifyProductData } from '../types';

interface ShopifyCreateResponse {
  success: boolean;
  shopifyId: number;
  message: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    sku: string;
    price: string;
  }>;
}

/**
 * Check if a product with the given SKU already exists in Shopify
 * @param sku The SKU to search for
 * @param storeName The name of the Shopify store (e.g., 'your-store')
 * @param accessToken The Admin API access token
 * @returns Promise with object containing exists flag and product data if found
 */
export const checkProductBySku = async (
    sku: string,
    storeName: string,
    accessToken: string
): Promise<{ exists: boolean; product?: ShopifyProduct }> => {
    const API_VERSION = '2024-07';
    const sanitizedStoreName = storeName.replace('.myshopify.com', '');

    // Shopify GraphQL query to search products by SKU
    const url = `https://${sanitizedStoreName}.myshopify.com/admin/api/${API_VERSION}/products.json?fields=id,title,variants&limit=1`;

    try {
        // Use the REST API to search - note: Shopify doesn't have direct SKU search in REST
        // We need to fetch and filter, or use GraphQL for better performance
        // For now, we'll use a workaround with variant SKU in the query
        const searchUrl = `https://${sanitizedStoreName}.myshopify.com/admin/api/${API_VERSION}/products.json?limit=250`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
        });

        if (!response.ok) {
            throw new Error(`Shopify API returned status ${response.status}`);
        }

        const responseData = await response.json();
        const products = responseData.products || [];

        // Search through all products for matching SKU
        for (const product of products) {
            const matchingVariant = product.variants?.find(
                (v: any) => v.sku && v.sku.toLowerCase() === sku.toLowerCase()
            );

            if (matchingVariant) {
                return {
                    exists: true,
                    product: product as ShopifyProduct
                };
            }
        }

        return { exists: false };
    } catch (error) {
        console.error('Error checking SKU in Shopify:', error);
        // If we can't check, assume it doesn't exist to avoid blocking
        return { exists: false };
    }
};

/**
 * Check if a product with the given SKU already exists (GraphQL version - more efficient)
 * @param sku The SKU to search for
 * @param storeName The name of the Shopify store
 * @param accessToken The Admin API access token
 * @returns Promise with object containing exists flag and product data if found
 */
export const checkProductBySkuGraphQL = async (
    sku: string,
    storeName: string,
    accessToken: string
): Promise<{ exists: boolean; product?: any }> => {
    const API_VERSION = '2024-07';
    const sanitizedStoreName = storeName.replace('.myshopify.com', '');
    const url = `https://${sanitizedStoreName}.myshopify.com/admin/api/${API_VERSION}/graphql.json`;

    const query = `
        query getProductBySku($query: String!) {
            products(first: 1, query: $query) {
                edges {
                    node {
                        id
                        title
                        variants(first: 10) {
                            edges {
                                node {
                                    id
                                    sku
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                query,
                variables: {
                    query: `sku:${sku}`
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Shopify GraphQL API returned status ${response.status}`);
        }

        const responseData = await response.json();

        if (responseData.errors) {
            console.error('GraphQL errors:', responseData.errors);
            throw new Error(`GraphQL error: ${JSON.stringify(responseData.errors)}`);
        }

        const products = responseData.data?.products?.edges || [];

        if (products.length > 0) {
            return {
                exists: true,
                product: products[0].node
            };
        }

        return { exists: false };
    } catch (error) {
        console.error('Error checking SKU via GraphQL:', error);
        // Fallback to REST API check
        return checkProductBySku(sku, storeName, accessToken);
    }
};

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