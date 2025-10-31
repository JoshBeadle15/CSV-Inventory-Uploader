#!/usr/bin/env node

/**
 * Automated AIMSii to Shopify Product Sync Script
 *
 * This script automatically:
 * 1. Fetches new inventory records from Tritech AIMSii API (last 24 hours)
 * 2. Filters by configured categories
 * 3. Checks if products already exist in Shopify (by SKU)
 * 4. Uses OpenAI to transform data to Shopify format
 * 5. Creates product drafts in Shopify
 * 6. Logs all operations and errors
 */

import { config, validateConfig, getLookbackTimestamp } from './config.js';
import { fetchInventoryRecords, mapAimsiiRecord, testAimsiiConnection } from './services/aimsiiApiService.js';
import { checkProductBySkuGraphQL } from './services/shopifyService.ts';
import { generateShopifyProductJson } from './services/openaiService.ts';
import { createProductDraft } from './services/shopifyService.ts';
import { logInfo, logError, logSuccess, logWarning, saveFailedProduct } from './utils/logger.js';
import { retryWithBackoff } from './utils/retry.js';

/**
 * Process a single inventory record
 */
async function processInventoryRecord(record) {
  const sku = record[config.fieldMapping['variants.sku']];

  if (!sku) {
    logWarning('Record missing SKU, skipping', { recordId: record.id || 'unknown' });
    return { success: false, reason: 'missing_sku' };
  }

  try {
    logInfo(`Processing record: ${sku}`);

    // Step 1: Check if product already exists in Shopify
    logInfo(`Checking if SKU already exists in Shopify: ${sku}`);
    const skuCheck = await checkProductBySkuGraphQL(
      sku,
      config.shopify.store,
      config.shopify.accessToken
    );

    if (skuCheck.exists) {
      logInfo(`Product with SKU ${sku} already exists in Shopify (ID: ${skuCheck.product?.id}), skipping`);
      return { success: false, reason: 'already_exists', shopifyId: skuCheck.product?.id };
    }

    // Step 2: Map AIMSii record to internal format
    const mappedRecord = mapAimsiiRecord(record);
    logInfo(`Mapped AIMSii record to internal format for SKU: ${sku}`);

    // Step 3: Transform to Shopify format using OpenAI
    if (config.settings.dryRun) {
      logInfo(`[DRY RUN] Would transform SKU ${sku} using OpenAI`);
    } else {
      logInfo(`Transforming data using OpenAI for SKU: ${sku}`);
    }

    const shopifyJsonString = await retryWithBackoff(
      async () => {
        return await generateShopifyProductJson(mappedRecord, config.fieldMapping);
      },
      {
        maxAttempts: config.retry.maxAttempts,
        initialDelay: config.retry.initialDelay,
        operationName: `OpenAI Transform for SKU ${sku}`
      }
    );

    const shopifyData = JSON.parse(shopifyJsonString);

    // Step 4: Create product in Shopify
    if (config.settings.dryRun) {
      logInfo(`[DRY RUN] Would create product in Shopify for SKU: ${sku}`);
      return { success: true, reason: 'dry_run', sku };
    }

    logInfo(`Creating product draft in Shopify for SKU: ${sku}`);
    const createResult = await retryWithBackoff(
      async () => {
        return await createProductDraft(
          shopifyData,
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

    logSuccess(`Successfully created product in Shopify`, {
      sku,
      shopifyId: createResult.shopifyId,
      title: shopifyData.product?.title
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
 * Main sync function
 */
async function syncProducts() {
  logInfo('='.repeat(60));
  logInfo('Starting AIMSii to Shopify product sync');
  logInfo('='.repeat(60));

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
    logInfo('Configuration validated successfully');

    // Log sync settings
    logInfo('Sync Configuration:', {
      lookbackHours: config.sync.lookbackHours,
      filterByCategory: config.sync.filterByCategory,
      allowedCategories: config.sync.allowedCategories,
      dryRun: config.settings.dryRun
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
      logInfo(`\nProcessing record ${i + 1}/${records.length}...`);

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

    logInfo('='.repeat(60));
    logInfo('Sync Complete');
    logInfo('='.repeat(60));
    logInfo('Statistics:', {
      duration: `${duration}s`,
      ...stats
    });
    logInfo('='.repeat(60));
  }

  return stats;
}

/**
 * Schedule recurring sync
 */
async function startScheduledSync() {
  logInfo('Starting scheduled sync service');
  logInfo(`Will run every ${config.sync.checkIntervalHours} hours`);

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
