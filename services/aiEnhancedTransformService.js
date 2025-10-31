/**
 * AI Enhanced Transform Service
 *
 * This service orchestrates the complete AI transformation pipeline:
 * 1. Load/generate field mappings
 * 2. Check transformation cache for similar products
 * 3. Use AI only when necessary
 * 4. Cache successful transformations for future use
 * 5. Intelligently populate missing fields
 *
 * NOTE: Images are NOT included - they will be added manually
 */

import { applyFieldMappings } from './aiFieldMappingService.js';
import {
  loadTransformationCache,
  findMatchingTemplate,
  applyTemplate,
  cacheTransformation,
  getCacheStats
} from './aiTransformCacheService.js';
import { generateWithAI } from './aiProviderService.js';
import { logInfo, logSuccess, logWarning } from '../utils/logger.js';

let transformCache = null;

/**
 * Initialize the transformation cache
 */
export async function initializeTransformCache() {
  if (!transformCache) {
    transformCache = await loadTransformationCache();
    const stats = getCacheStats(transformCache);
    logInfo('Transform cache initialized', stats);
  }
  return transformCache;
}

/**
 * Transform a single product using AI with smart caching
 */
export async function transformProductWithAI(product, fieldMappings) {
  // Ensure cache is initialized
  if (!transformCache) {
    await initializeTransformCache();
  }

  // Step 1: Apply basic field mappings
  const mappedData = applyFieldMappings(product, fieldMappings);

  // Step 2: Check if we have a cached template for this type of product
  const templateMatch = findMatchingTemplate(product, transformCache);

  if (templateMatch && templateMatch.similarity >= 0.8) {
    // High similarity - use cached template directly
    logSuccess(`Using cached template (${(templateMatch.similarity * 100).toFixed(0)}% match) - NO AI CALL`);
    return applyTemplate(product, templateMatch, mappedData);
  }

  // Step 3: Need to use AI for this product
  logInfo('No suitable cache match - using AI transformation');

  const systemPrompt = `You are a product data transformation expert for musical instruments and retail products.

Transform the provided product data into Shopify-compatible JSON format.

CRITICAL RULES:
1. Create engaging, SEO-friendly product titles
2. Generate detailed, formatted HTML descriptions that highlight product features
3. Use proper product categorization
4. Add relevant tags for searchability
5. DO NOT include or reference images - images will be added manually later
6. ALWAYS set published: false (products must be drafts)

The product should sound professional and appealing to musicians and music enthusiasts.`;

  const userPrompt = `Transform this product into Shopify format:

Source Product Data:
${JSON.stringify(product, null, 2)}

Mapped Fields (use these as a starting point):
${JSON.stringify(mappedData, null, 2)}

Generate a complete Shopify product with:
- Professional title combining brand, model, and description
- Rich HTML description highlighting features and benefits
- Appropriate product type and tags
- Variant with price, SKU, quantity, and barcode
- NO images array (images handled separately)
- published: false (draft mode)

Return ONLY valid JSON matching the Shopify product structure.`;

  const responseText = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.3, // Slightly higher for creative descriptions
    responseFormat: 'json'
  });

  const shopifyProduct = JSON.parse(responseText);

  // Ensure critical fields are set correctly
  if (!shopifyProduct.product) {
    shopifyProduct.product = shopifyProduct;
  }

  // Force draft mode
  shopifyProduct.product.published = false;

  // Ensure no images
  shopifyProduct.product.images = [];

  // Ensure variants exist
  if (!shopifyProduct.product.variants || shopifyProduct.product.variants.length === 0) {
    shopifyProduct.product.variants = [{
      price: (product.Ourprice || mappedData['variants.price'] || '0').toString(),
      sku: product.Sku || mappedData['variants.sku'] || '',
      inventory_quantity: product['Comp Qty'] || mappedData['variants.inventory_quantity'] || 0,
      barcode: product.Barcode || '',
      option1: 'Default Title'
    }];
  }

  // Step 4: Cache this successful transformation
  await cacheTransformation(product, shopifyProduct, transformCache);

  logSuccess(`AI transformation complete and cached: ${shopifyProduct.product.title}`);

  return shopifyProduct;
}

/**
 * Get current cache statistics
 */
export function getTransformCacheStats() {
  if (!transformCache) {
    return null;
  }
  return getCacheStats(transformCache);
}

/**
 * Populate missing Shopify fields using AI inference
 */
export async function populateMissingFields(product, shopifyData, fieldMappings) {
  const missingFields = [];

  // Check which critical fields are missing
  if (!shopifyData.product.body_html || shopifyData.product.body_html.trim() === '') {
    missingFields.push('body_html');
  }

  if (!shopifyData.product.tags || shopifyData.product.tags.trim() === '') {
    missingFields.push('tags');
  }

  if (missingFields.length === 0) {
    return shopifyData; // Nothing to populate
  }

  logInfo(`Populating missing fields: ${missingFields.join(', ')}`);

  const systemPrompt = `You are helping populate missing product information for an e-commerce store.
Generate professional, relevant content for musical instruments and retail products.`;

  const userPrompt = `Product: ${product.Mfg} ${product.Model} - ${product.Desc}
Category: ${product['Cat Desc']} > ${product['Sub Desc']}

Generate:
${missingFields.includes('body_html') ? '- Professional HTML product description (2-3 paragraphs highlighting features and benefits)' : ''}
${missingFields.includes('tags') ? '- Relevant search tags (comma-separated)' : ''}

Return JSON with: { "body_html": "...", "tags": "..." }`;

  const response = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.4,
    responseFormat: 'json'
  });

  const generated = JSON.parse(response);

  // Apply generated fields
  if (generated.body_html && missingFields.includes('body_html')) {
    shopifyData.product.body_html = generated.body_html;
  }

  if (generated.tags && missingFields.includes('tags')) {
    shopifyData.product.tags = generated.tags;
  }

  return shopifyData;
}
