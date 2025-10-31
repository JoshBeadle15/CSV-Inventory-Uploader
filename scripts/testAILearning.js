#!/usr/bin/env node

/**
 * AI Learning Test Script
 *
 * This script demonstrates the complete AI learning system:
 * 1. Auto-generates field mappings from sample data
 * 2. Transforms products using AI
 * 3. Builds transformation cache
 * 4. Shows cost reduction over time
 *
 * Run with: node scripts/testAILearning.js
 */

import dotenv from 'dotenv';
import { getSampleProducts, readProductsFromXLSX } from '../services/xlsxDataService.js';
import { initializeFieldMappings, loadFieldMappings } from '../services/aiFieldMappingService.js';
import {
  initializeTransformCache,
  getTransformCacheStats,
  transformProductWithAI
} from '../services/aiEnhancedTransformService.js';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger.js';

// Load environment variables
dotenv.config();

async function main() {
  console.log('='.repeat(70));
  console.log('AI LEARNING SYSTEM TEST');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Step 1: Initialize field mappings
    console.log('STEP 1: Field Mapping Auto-Discovery');
    console.log('-'.repeat(70));

    let fieldMappings = await loadFieldMappings();

    if (!fieldMappings) {
      logInfo('No existing field mappings found. Generating from sample data...');

      // Get sample products for analysis
      const sampleProducts = await getSampleProducts(5);

      logInfo('Sample products loaded. Analyzing with AI...');
      fieldMappings = await initializeFieldMappings(sampleProducts);

      logSuccess('Field mappings generated!');
      console.log(JSON.stringify(fieldMappings, null, 2));
      console.log('');
      logInfo('You can review and edit mappings at: ai-field-mappings.json');
    } else {
      logSuccess('Using existing field mappings');
    }

    console.log('');

    // Step 2: Initialize transformation cache
    console.log('STEP 2: Initialize Transformation Cache');
    console.log('-'.repeat(70));

    await initializeTransformCache();
    let stats = getTransformCacheStats();
    console.log('Initial cache stats:', JSON.stringify(stats, null, 2));
    console.log('');

    // Step 3: Transform products and watch the system learn
    console.log('STEP 3: Transform Products (Watch AI Learning)');
    console.log('-'.repeat(70));

    // Get 10 test products (mix of different categories)
    const testProducts = await readProductsFromXLSX(undefined, {
      limit: 10,
      offset: 0
    });

    logInfo(`Transforming ${testProducts.length} products...`);
    console.log('');

    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];

      console.log(`[${i + 1}/${testProducts.length}] Processing: ${product.Mfg} ${product.Model}`);
      console.log(`  Category: ${product['Cat Desc']} > ${product['Sub Desc']}`);

      try {
        const shopifyProduct = await transformProductWithAI(product, fieldMappings);

        console.log(`  ✓ Title: ${shopifyProduct.product.title}`);
        console.log(`  ✓ SKU: ${shopifyProduct.product.variants[0].sku}`);
        console.log(`  ✓ Price: $${shopifyProduct.product.variants[0].price}`);
        console.log(`  ✓ Published: ${shopifyProduct.product.published} (draft)`);
        console.log(`  ✓ Images: ${shopifyProduct.product.images?.length || 0} (will add manually)`);

        // Show updated cache stats
        stats = getTransformCacheStats();
        const hitRate = stats.hitRate || '0%';
        console.log(`  📊 Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses (${hitRate} hit rate)`);
      } catch (error) {
        logError(`Failed to transform product: ${error.message}`);
      }

      console.log('');

      // Small delay to avoid rate limiting
      if (i < testProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Step 4: Final statistics
    console.log('STEP 4: Final Statistics');
    console.log('='.repeat(70));

    stats = getTransformCacheStats();
    console.log('');
    console.log('Final Cache Performance:');
    console.log(`  Templates Created: ${stats.templates}`);
    console.log(`  Total Transformations: ${stats.totalTransformations}`);
    console.log(`  Cache Hits: ${stats.cacheHits} (no AI cost)`);
    console.log(`  Cache Misses: ${stats.cacheMisses} (AI used)`);
    console.log(`  Hit Rate: ${stats.hitRate}`);
    console.log('');

    // Calculate estimated cost savings
    const aiCallsAvoided = stats.cacheHits || 0;
    const estimatedSavingsGemini = (aiCallsAvoided * 0.001).toFixed(2); // ~$0.001 per call with Gemini
    const estimatedSavingsOpenAI = (aiCallsAvoided * 0.01).toFixed(2); // ~$0.01 per call with OpenAI

    console.log('Estimated Cost Savings:');
    console.log(`  With Gemini: ~$${estimatedSavingsGemini}`);
    console.log(`  With OpenAI: ~$${estimatedSavingsOpenAI}`);
    console.log('');

    logSuccess('AI Learning System Test Complete!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Review generated files: ai-field-mappings.json, ai-transformation-cache.json');
    console.log('2. Edit field mappings if needed');
    console.log('3. Run the full sync to process all products');
    console.log('');

  } catch (error) {
    logError('Test failed', error);
    process.exit(1);
  }
}

// Run the test
main();
