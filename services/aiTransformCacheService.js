/**
 * AI Transformation Cache Service
 *
 * This service caches successful AI transformations and uses them as templates
 * for similar products, dramatically reducing AI API calls over time.
 *
 * Caching strategy:
 * - Group products by category and brand
 * - Store successful transformation patterns
 * - Match new products to cached templates
 * - Only use AI for novel products
 */

import fs from 'fs/promises';
import path from 'path';
import { logInfo, logSuccess, logWarning } from '../utils/logger.js';

const CACHE_FILE_PATH = path.join(process.cwd(), 'ai-transformation-cache.json');
const SIMILARITY_THRESHOLD = 0.7; // How similar products need to be to use cache

/**
 * Load transformation cache from file
 */
export async function loadTransformationCache() {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    const cache = JSON.parse(data);
    logInfo(`Loaded transformation cache with ${Object.keys(cache.templates || {}).length} templates`);
    return cache;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logInfo('No transformation cache found, starting fresh');
      return {
        templates: {},
        stats: {
          totalTransformations: 0,
          cacheHits: 0,
          cacheMisses: 0,
          createdAt: new Date().toISOString()
        }
      };
    }
    throw error;
  }
}

/**
 * Save transformation cache to file
 */
export async function saveTransformationCache(cache) {
  cache.stats = cache.stats || {};
  cache.stats.lastUpdated = new Date().toISOString();

  await fs.writeFile(
    CACHE_FILE_PATH,
    JSON.stringify(cache, null, 2),
    'utf-8'
  );
}

/**
 * Generate a cache key for a product based on category and brand
 */
function generateCacheKey(product) {
  const category = (product['Cat Desc'] || product.category || 'unknown').toLowerCase().trim();
  const subcategory = (product['Sub Desc'] || product.subcategory || '').toLowerCase().trim();
  const brand = (product.Mfg || product.vendor || product.brand || 'unknown').toLowerCase().trim();

  return `${category}|${subcategory}|${brand}`;
}

/**
 * Calculate similarity between two products
 */
function calculateSimilarity(product1, product2) {
  let score = 0;
  let factors = 0;

  // Same category (most important)
  if ((product1['Cat Desc'] || '').toLowerCase() === (product2['Cat Desc'] || '').toLowerCase()) {
    score += 0.4;
  }
  factors++;

  // Same subcategory
  if ((product1['Sub Desc'] || '').toLowerCase() === (product2['Sub Desc'] || '').toLowerCase()) {
    score += 0.3;
  }
  factors++;

  // Same brand
  if ((product1.Mfg || '').toLowerCase() === (product2.Mfg || '').toLowerCase()) {
    score += 0.3;
  }
  factors++;

  return score;
}

/**
 * Find a matching template in cache for a product
 */
export function findMatchingTemplate(product, cache) {
  const cacheKey = generateCacheKey(product);

  // Check for exact cache key match
  if (cache.templates[cacheKey] && cache.templates[cacheKey].examples.length > 0) {
    const template = cache.templates[cacheKey];

    // Calculate similarity with cached examples
    const similarities = template.examples.map(example =>
      calculateSimilarity(product, example.sourceProduct)
    );

    const maxSimilarity = Math.max(...similarities);

    if (maxSimilarity >= SIMILARITY_THRESHOLD) {
      logInfo(`Cache HIT: Found template for ${cacheKey} (similarity: ${(maxSimilarity * 100).toFixed(1)}%)`);
      cache.stats.cacheHits = (cache.stats.cacheHits || 0) + 1;
      return {
        template,
        similarity: maxSimilarity,
        cacheKey
      };
    }
  }

  logInfo(`Cache MISS: No suitable template for ${cacheKey}`);
  cache.stats.cacheMisses = (cache.stats.cacheMisses || 0) + 1;
  return null;
}

/**
 * Apply a cached template to a new product
 */
export function applyTemplate(product, templateMatch, mappedData) {
  const { template } = templateMatch;

  // Use the template's transformation pattern
  // We'll adapt the latest example's structure with the new product's data
  const latestExample = template.examples[template.examples.length - 1];
  const shopifyTemplate = latestExample.shopifyProduct;

  // Create new product based on template structure
  const result = {
    product: {
      title: `${product.Mfg || ''} ${product.Model || ''} ${product.Desc || ''}`.trim(),
      body_html: shopifyTemplate.product.body_html
        .replace(/{{mfg}}/gi, product.Mfg || '')
        .replace(/{{model}}/gi, product.Model || '')
        .replace(/{{desc}}/gi, product.Desc || '')
        .replace(/{{category}}/gi, product['Cat Desc'] || '')
        .replace(/{{subcategory}}/gi, product['Sub Desc'] || ''),
      vendor: product.Mfg || mappedData.vendor || '',
      product_type: product['Cat Desc'] || mappedData.product_type || '',
      tags: [
        product['Cat Desc'],
        product['Sub Desc'],
        product.Mfg
      ].filter(Boolean).join(', '),
      published: false, // Always create as draft
      variants: [{
        price: (product.Ourprice || mappedData['variants.price'] || '0').toString(),
        sku: product.Sku || mappedData['variants.sku'] || '',
        inventory_quantity: product['Comp Qty'] || mappedData['variants.inventory_quantity'] || 0,
        barcode: product.Barcode || '',
        option1: 'Default Title'
      }],
      images: [] // No images - will be added manually
    }
  };

  logSuccess(`Applied cached template for: ${result.product.title}`);
  return result;
}

/**
 * Add a successful transformation to the cache
 */
export async function cacheTransformation(product, shopifyProduct, cache) {
  const cacheKey = generateCacheKey(product);

  if (!cache.templates[cacheKey]) {
    cache.templates[cacheKey] = {
      category: product['Cat Desc'] || 'unknown',
      subcategory: product['Sub Desc'] || '',
      brand: product.Mfg || 'unknown',
      examples: [],
      createdAt: new Date().toISOString()
    };
  }

  // Add this transformation as an example (keep last 5)
  cache.templates[cacheKey].examples.push({
    sourceProduct: {
      Mfg: product.Mfg,
      Model: product.Model,
      Desc: product.Desc,
      'Cat Desc': product['Cat Desc'],
      'Sub Desc': product['Sub Desc']
    },
    shopifyProduct,
    cachedAt: new Date().toISOString()
  });

  // Keep only the most recent 5 examples per template
  if (cache.templates[cacheKey].examples.length > 5) {
    cache.templates[cacheKey].examples = cache.templates[cacheKey].examples.slice(-5);
  }

  cache.templates[cacheKey].lastUsed = new Date().toISOString();
  cache.stats.totalTransformations = (cache.stats.totalTransformations || 0) + 1;

  await saveTransformationCache(cache);

  logInfo(`Cached transformation for: ${cacheKey}`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(cache) {
  const stats = cache.stats || {};
  const templateCount = Object.keys(cache.templates || {}).length;
  const hitRate = stats.totalTransformations > 0
    ? ((stats.cacheHits || 0) / stats.totalTransformations * 100).toFixed(1)
    : 0;

  return {
    templates: templateCount,
    totalTransformations: stats.totalTransformations || 0,
    cacheHits: stats.cacheHits || 0,
    cacheMisses: stats.cacheMisses || 0,
    hitRate: `${hitRate}%`,
    createdAt: stats.createdAt,
    lastUpdated: stats.lastUpdated
  };
}
