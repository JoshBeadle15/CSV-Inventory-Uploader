import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration for the automated Shopify product sync
 */
export const config = {
  // AIMSii API Configuration
  aimsii: {
    // Base URL for initial authentication (GetEndpoint call)
    baseUrl: process.env.AIMSII_BASE_URL || 'https://active-ewebservice.biz/aeservices30/api',
    apiKey: process.env.AIMSII_API_KEY,
    username: process.env.AIMSII_USERNAME,
    password: process.env.AIMSII_PASSWORD,
    // Endpoint to fetch inventory records (appended to authenticated domain)
    inventoryEndpoint: process.env.AIMSII_INVENTORY_ENDPOINT || '/api/inventory',
  },

  // Shopify API Configuration
  shopify: {
    store: process.env.SHOPIFY_STORE,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-07',
  },

  // AI Provider Configuration
  ai: {
    // Provider selection: 'openai' or 'gemini'
    provider: process.env.AI_PROVIDER || 'openai',

    // OpenAI Configuration
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },

    // Google Gemini Configuration
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    },
  },

  // Sync Configuration
  sync: {
    // Check interval in hours (default: 24)
    checkIntervalHours: parseInt(process.env.CHECK_INTERVAL_HOURS || '24', 10),

    // Lookback period in hours (default: 24)
    // Fetches records created within this time period
    lookbackHours: parseInt(process.env.LOOKBACK_HOURS || '24', 10),

    // Categories to sync (comma-separated string or array)
    // Example: "Electronics,Accessories,Cables" or leave empty for all
    allowedCategories: process.env.ALLOWED_CATEGORIES
      ? process.env.ALLOWED_CATEGORIES.split(',').map(c => c.trim())
      : [],

    // Whether to filter by categories (if false, syncs all categories)
    filterByCategory: process.env.FILTER_BY_CATEGORY === 'true',

    // Batch size: Number of products to process per run (default: 10)
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),

    // Focus categories: Override allowedCategories for current run
    // Example: "Electronics,Cables" - targets only these categories
    focusCategories: process.env.FOCUS_CATEGORIES
      ? process.env.FOCUS_CATEGORIES.split(',').map(c => c.trim())
      : null,
  },

  // Multi-Location Inventory Configuration
  inventory: {
    // Enable multi-location inventory updates (default: false)
    enableLocationUpdates: process.env.ENABLE_LOCATION_UPDATES === 'true',

    // Specific Shopify location names or IDs (comma-separated)
    // Leave empty to use all locations
    // Example: "Warehouse,Storefront" or "gid://shopify/Location/123,gid://shopify/Location/456"
    locations: process.env.SHOPIFY_LOCATIONS
      ? process.env.SHOPIFY_LOCATIONS.split(',').map(l => l.trim())
      : [],

    // AIMSii Location ID to Name Mapping
    // Maps numeric location IDs from AIMSii to friendly location names
    // Format: "id:name,id:name" (e.g., "1:Bozeman,2:Billings")
    // This is used to detect and translate location-specific quantity fields
    locationIdMapping: process.env.AIMSII_LOCATION_MAPPING
      ? Object.fromEntries(
          process.env.AIMSII_LOCATION_MAPPING.split(',').map(pair => {
            const [id, name] = pair.trim().split(':');
            return [id.trim(), name.trim()];
          })
        )
      : { '1': 'Bozeman', '2': 'Billings' }, // Default mapping

    // Field name pattern for location quantities in AIMSii data
    // Patterns to detect location-specific quantity fields
    // Examples: "qty_{id}", "location_{id}_qty", "{id}_quantity"
    locationQuantityPatterns: process.env.AIMSII_LOCATION_QTY_PATTERNS
      ? process.env.AIMSII_LOCATION_QTY_PATTERNS.split(',').map(p => p.trim())
      : ['qty_{id}', 'location_{id}_qty', 'quantity_{id}', '{id}_qty'],

    // Update inventory for existing products (default: true if location updates enabled)
    updateExistingProducts: process.env.UPDATE_EXISTING_INVENTORY !== 'false',

    // Cache duration for location data in milliseconds (default: 1 hour)
    locationCacheDuration: parseInt(process.env.LOCATION_CACHE_DURATION || '3600000', 10),
  },

  // Retry Configuration
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10),
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000', 10),
    backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2'),
  },

  // Field Mapping: AIMSii field name -> Shopify field path
  // Customize this based on your AIMSii data structure
  fieldMapping: {
    // Basic product info
    'title': process.env.AIMSII_FIELD_TITLE || 'name',
    'body_html': process.env.AIMSII_FIELD_DESCRIPTION || 'description',
    'vendor': process.env.AIMSII_FIELD_VENDOR || 'brand',
    'product_type': process.env.AIMSII_FIELD_TYPE || 'category',
    'tags': process.env.AIMSII_FIELD_TAGS || 'tags',

    // Variant info
    'variants.price': process.env.AIMSII_FIELD_PRICE || 'price',
    'variants.sku': process.env.AIMSII_FIELD_SKU || 'sku',
    'variants.inventory_quantity': process.env.AIMSII_FIELD_QUANTITY || 'quantity',

    // Image
    'images.src': process.env.AIMSII_FIELD_IMAGE || 'imageUrl',
  },

  // AI Learning Configuration
  aiLearning: {
    // Enable AI field mapping auto-discovery
    enableFieldMapping: process.env.AI_ENABLE_FIELD_MAPPING !== 'false', // default true

    // Enable transformation caching for cost reduction
    enableTransformCache: process.env.AI_ENABLE_TRANSFORM_CACHE !== 'false', // default true

    // Number of sample products to analyze for field mapping
    mappingSampleSize: parseInt(process.env.AI_MAPPING_SAMPLE_SIZE || '5', 10),

    // Similarity threshold for using cached templates (0.0 - 1.0)
    cacheSimilarityThreshold: parseFloat(process.env.AI_CACHE_SIMILARITY || '0.7'),

    // Maximum examples to keep per template
    maxExamplesPerTemplate: parseInt(process.env.AI_MAX_EXAMPLES_PER_TEMPLATE || '5', 10),
  },

  // Additional Settings
  settings: {
    // Whether to create products as drafts (true) or published (false)
    createAsDraft: process.env.CREATE_AS_DRAFT !== 'false', // default true

    // Run once and exit, or keep running on schedule
    runOnce: process.env.RUN_ONCE === 'true',

    // Dry run mode (don't actually create products in Shopify)
    dryRun: process.env.DRY_RUN === 'true',

    // Review mode: Process batch, log results, and exit for manual review
    // When true, processes only batchSize products, logs summary, and exits
    // When false, processes all products in full auto mode
    reviewMode: process.env.REVIEW_MODE !== 'false', // default true for safety
  },
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const required = [
    { key: 'AIMSII_API_KEY', value: config.aimsii.apiKey },
    { key: 'AIMSII_BASE_URL', value: config.aimsii.baseUrl },
    { key: 'AIMSII_USERNAME', value: config.aimsii.username },
    { key: 'AIMSII_PASSWORD', value: config.aimsii.password },
    { key: 'SHOPIFY_STORE', value: config.shopify.store },
    { key: 'SHOPIFY_ACCESS_TOKEN', value: config.shopify.accessToken },
  ];

  // Validate the appropriate AI provider API key
  if (config.ai.provider === 'openai') {
    required.push({ key: 'OPENAI_API_KEY', value: config.ai.openai.apiKey });
  } else if (config.ai.provider === 'gemini') {
    required.push({ key: 'GEMINI_API_KEY', value: config.ai.gemini.apiKey });
  } else {
    throw new Error(`Invalid AI_PROVIDER: ${config.ai.provider}. Must be 'openai' or 'gemini'`);
  }

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ');
    throw new Error(`Missing required environment variables: ${missingKeys}`);
  }

  // Validate that SKU field mapping is configured
  // SKU is critical for duplicate detection
  if (!config.fieldMapping['variants.sku']) {
    throw new Error('SKU field mapping is required (AIMSII_FIELD_SKU). This field is used for duplicate detection.');
  }

  return true;
}

/**
 * Get timestamp for lookback period
 */
export function getLookbackTimestamp() {
  const now = new Date();
  const lookbackMs = config.sync.lookbackHours * 60 * 60 * 1000;
  return new Date(now.getTime() - lookbackMs);
}

/**
 * Check if a category should be synced
 */
export function shouldSyncCategory(category) {
  if (!config.sync.filterByCategory) {
    return true;
  }

  // Focus categories override allowedCategories if specified
  const categoriesToCheck = config.sync.focusCategories || config.sync.allowedCategories;

  if (categoriesToCheck.length === 0) {
    return true; // No filter specified, sync all
  }

  return categoriesToCheck.some(
    allowed => allowed.toLowerCase() === (category || '').toLowerCase()
  );
}

export default config;
