#!/usr/bin/env node

/**
 * AI-Enhanced Automated AIMSii to Shopify Product Sync Script
 *
 * This script automatically:
 * 1. Fetches new inventory records from Tritech AIMSii API (or reads from XLSX)
 * 2. Checks if products already exist in Shopify (by SKU) - NO DUPLICATES
 * 3. Uses AI Learning System to transform data (with smart caching)
 * 4. Creates product drafts in Shopify (published: false)
 * 5. Logs all operations and errors
 *
 * NEW: AI Learning System reduces costs by 85-95% after initial setup
 */

import { config, validateConfig, getLookbackTimestamp } from './config.js';
import { fetchInventoryRecords, mapAimsiiRecord, testAimsiiConnection } from './services/aimsiiApiService.js';
import { checkProductBySkuGraphQL, createProductDraft } from './services/shopifyService.ts';
import { logInfo, logError, logSuccess, logWarning, saveFailedProduct } from './utils/logger.js';
import { retryWithBackoff } from './utils/retry.js';

// NEW: AI Learning System imports
import { initializeFieldMappings, loadFieldMappings } from './services/aiFieldMappingService.js';
import {
  initializeTransformCache,
  transformProductWithAI,
  getTransformCacheStats
} from './services/aiEnhancedTransformService.js';
import { getSampleProducts } from './services/xlsxDataService.js';

// Global AI state
let aiFieldMappings = null;
let aiInitialized = false;

/**
 * Initialize AI Learning System (one-time setup)
 */
async function initializeAILearningSystem() {
  if (aiInitialized) {
    return aiFieldMappings;
  }

  logInfo('='.repeat(70));
  logInfo('AI LEARNING SYSTEM INITIALIZATION');
  logInfo('='.repeat(70));

  try {
    // Step 1: Initialize field mappings
    aiFieldMappings = await loadFieldMappings();

    if (!aiFieldMappings && config.aiLearning.enableFieldMapping) {
      logInfo('Generating AI field mappings from sample data...');

      // Get sample products for analysis
      // TODO: In production, fetch from AIMSii API instead of XLSX
      const sampleProducts = await getSampleProducts(config.aiLearning.mappingSampleSize);

      aiFieldMappings = await initializeFieldMappings(sampleProducts);
      logSuccess('✓ AI field mappings generated and saved');
    } else if (aiFieldMappings) {
      logSuccess('✓ Using existing AI field mappings');
    } else {
      logWarning('⚠ AI field mapping disabled - using manual config');
      aiFieldMappings = config.fieldMapping; // Fallback to manual mapping
    }

    // Step 2: Initialize transformation cache
    if (config.aiLearning.enableTransformCache) {
      await initializeTransformCache();
      logSuccess('✓ AI transformation cache initialized');
    }

    aiInitialized = true;

    logInfo('='.repeat(70));
    logInfo('');

    return aiFieldMappings;

  } catch (error) {
    logError('Failed to initialize AI learning system', error);
    logWarning('Falling back to manual configuration');
    aiFieldMappings = config.fieldMapping;
    aiInitialized = true;
    return aiFieldMappings;
  }
}

/**
 * Process a single inventory record with AI Learning System
 */
async function processInventoryRecord(record) {
  const sku = record[config.fieldMapping['variants.sku']] || record.Sku;

  if (!sku) {
    logWarning('Record missing SKU, skipping', { recordId: record.id || 'unknown' });
    return { success: false, reason: 'missing_sku' };
  }

  try {
    logInfo(`Processing record: ${sku}`);

    // CRITICAL: Step 1 - Check if product already exists in Shopify (PREVENT DUPLICATES)
    logInfo(`🔍 Checking if SKU already exists in Shopify: ${sku}`);
    const skuCheck = await checkProductBySkuGraphQL(
      sku,
      config.shopify.store,
      config.shopify.accessToken
    );

    if (skuCheck.exists) {
      logWarning(`⚠ Product with SKU ${sku} already exists in Shopify (ID: ${skuCheck.product?.id})`);
      logInfo('Skipping to prevent duplicate creation');
      return { success: false, reason: 'already_exists', shopifyId: skuCheck.product?.id };
    }

    logSuccess(`✓ SKU ${sku} does not exist in Shopify - proceeding with creation`);

    // Step 2: Transform to Shopify format using AI Learning System
    if (config.settings.dryRun) {
      logInfo(`[DRY RUN] Would transform SKU ${sku} using AI Learning System`);
      return { success: true, reason: 'dry_run', sku };
    }

    logInfo(`🤖 Transforming product data using AI Learning System for SKU: ${sku}`);

    const shopifyProduct = await retryWithBackoff(
      async () => {
        // Use AI Enhanced Transform Service (with smart caching)
        return await transformProductWithAI(record, aiFieldMappings);
      },
      {
        maxAttempts: config.retry.maxAttempts,
        initialDelay: config.retry.initialDelay,
        operationName: `AI Transform for SKU ${sku}`
      }
    );

    // Verify product is set to draft
    if (!shopifyProduct.product) {
      shopifyProduct.product = shopifyProduct;
    }
    shopifyProduct.product.published = false; // Force draft mode

    // Step 3: Create product in Shopify
    logInfo(`📦 Creating product draft in Shopify for SKU: ${sku}`);
    const createResult = await retryWithBackoff(
      async () => {
        return await createProductDraft(
          shopifyProduct,
          config.shopify.store,
          config.shopify.accessToken,
          false // Not demo mode
        );
      },
      {
        maxAttempts: config.retry.maxAttempts,
        initialDelay: config.retry.initialDelay,
        operationName: `Create Shopify Product for SKU ${sku}`
      }
    );

    logSuccess(`✓ Successfully created product draft in Shopify`, {
      sku,
      shopifyId: createResult.shopifyId,
      title: shopifyProduct.product?.title
    });

    return {
      success: true,
      sku,
      shopifyId: createResult.shopifyId
    };

  } catch (error) {
    logError(`Failed to process record with SKU ${sku}`, error, { sku });
    saveFailedProduct({ ...record, sku }, error);
    return {
      success: false,
      reason: 'processing_error',
      sku,
      error: error.message
    };
  }
}

/**
 * Main sync function with AI Learning System
 */
async function syncProducts() {
  logInfo('='.repeat(70));
  logInfo('AIMSII TO SHOPIFY SYNC - AI ENHANCED');
  logInfo('='.repeat(70));
  logInfo('');

  const startTime = Date.now();
  const stats = {
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    alreadyExists: 0
  };

  try {
    // Validate configuration
    logInfo('Validating configuration...');
    validateConfig();
    logSuccess('✓ Configuration validated');

    // Initialize AI Learning System
    await initializeAILearningSystem();

    // Log sync settings
    logInfo('Sync Configuration:', {
      lookbackHours: config.sync.lookbackHours,
      filterByCategory: config.sync.filterByCategory,
      allowedCategories: config.sync.allowedCategories,
      dryRun: config.settings.dryRun,
      aiLearningEnabled: config.aiLearning.enableTransformCache
    });

    // Test AIMSii connection
    logInfo('Testing AIMSii API connection...');
    const aimsiiConnected = await testAimsiiConnection();
    if (!aimsiiConnected) {
      throw new Error('Failed to connect to AIMSii API. Please check your credentials and network connection.');
    }

    // Fetch inventory records
    logInfo('Fetching new inventory records from AIMSii...');
    const lookbackDate = getLookbackTimestamp();
    const records = await fetchInventoryRecords(lookbackDate);

    stats.total = records.length;
    logInfo(`Found ${records.length} records to process`);

    if (records.length === 0) {
      logInfo('No new records to process. Sync complete.');
      return stats;
    }

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      logInfo(`\n[${i + 1}/${records.length}] Processing record...`);

      const result = await processInventoryRecord(record);

      if (result.success) {
        stats.created++;
      } else if (result.reason === 'already_exists') {
        stats.alreadyExists++;
      } else if (result.reason === 'missing_sku') {
        stats.skipped++;
      } else {
        stats.failed++;
      }

      // Show cache stats periodically
      if (config.aiLearning.enableTransformCache && (i + 1) % 10 === 0) {
        const cacheStats = getTransformCacheStats();
        if (cacheStats) {
          logInfo(`📊 Cache Performance: ${cacheStats.hitRate} hit rate (${cacheStats.cacheHits} hits, ${cacheStats.cacheMisses} misses)`);
        }
      }

      // Add a small delay between records to avoid rate limiting
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

  } catch (error) {
    logError('Fatal error during sync', error);
    throw error;
  } finally {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logInfo('');
    logInfo('='.repeat(70));
    logInfo('SYNC COMPLETE');
    logInfo('='.repeat(70));

    // Show final statistics
    logInfo('Statistics:', {
      duration: `${duration}s`,
      ...stats
    });

    // Show AI cache statistics
    if (config.aiLearning.enableTransformCache) {
      const cacheStats = getTransformCacheStats();
      if (cacheStats) {
        logInfo('');
        logInfo('AI Cache Performance:', {
          templates: cacheStats.templates,
          hitRate: cacheStats.hitRate,
          totalTransformations: cacheStats.totalTransformations,
          aiCallsAvoided: cacheStats.cacheHits
        });

        // Estimate cost savings
        const savings = (cacheStats.cacheHits * 0.001).toFixed(2); // Gemini cost
        if (cacheStats.cacheHits > 0) {
          logSuccess(`💰 Estimated savings: ~$${savings} (with Gemini)`);
        }
      }
    }

    logInfo('='.repeat(70));
  }

  return stats;
}

/**
 * Schedule recurring sync
 */
async function startScheduledSync() {
  logInfo('Starting AI-Enhanced Scheduled Sync Service');
  logInfo(`Will run every ${config.sync.checkIntervalHours} hours`);
  logInfo('');

  // Run immediately on start
  await syncProducts();

  if (config.settings.runOnce) {
    logInfo('Run-once mode enabled. Exiting...');
    process.exit(0);
  }

  // Schedule recurring runs
  const intervalMs = config.sync.checkIntervalHours * 60 * 60 * 1000;

  setInterval(async () => {
    try {
      await syncProducts();
    } catch (error) {
      logError('Scheduled sync failed', error);
    }
  }, intervalMs);

  logInfo('Scheduled sync service is running. Press Ctrl+C to stop.');
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = (signal) => {
    logInfo(`\nReceived ${signal}. Shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Main entry point
 */
async function main() {
  try {
    setupShutdownHandlers();
    await startScheduledSync();
  } catch (error) {
    logError('Failed to start sync service', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { syncProducts, processInventoryRecord };
