import { config, getLookbackTimestamp, shouldSyncCategory } from '../config.js';
import { logInfo, logError, logWarning } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';

// Authentication token cache
let authCache = {
  endpointDomain: null,
  oauthToken: null,
  securityToken: null,
  expiresAt: null
};

/**
 * Get endpoint domain and OAuth token from AIMSii
 * Step 1 of authentication flow
 *
 * @returns {Promise<Object>} Object containing NewEndpointDomain and OAuthToken
 */
async function getEndpoint() {
  const url = `${config.aimsii.baseUrl}/GetEndpoint`;

  logInfo('Fetching AIMSii endpoint and OAuth token...');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        APIKey: config.aimsii.apiKey
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`GetEndpoint failed (${res.status}): ${errorBody}`);
    }

    const data = await res.json();

    if (!data.NewEndpointDomain || !data.OAuthToken) {
      throw new Error('GetEndpoint response missing required fields');
    }

    logInfo(`Endpoint received: ${data.NewEndpointDomain}`);

    return {
      endpointDomain: data.NewEndpointDomain,
      oauthToken: data.OAuthToken
    };
  } catch (error) {
    logError('Failed to get AIMSii endpoint', error);
    throw error;
  }
}

/**
 * Login to AIMSii and get security token
 * Step 2 of authentication flow
 *
 * @param {string} endpointDomain - Domain from getEndpoint
 * @returns {Promise<string>} SecurityToken
 */
async function login(endpointDomain) {
  const url = `${endpointDomain}/Security`;

  logInfo('Logging in to AIMSii...');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        UserName: config.aimsii.username,
        Password: config.aimsii.password
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Login failed (${res.status}): ${errorBody}`);
    }

    const data = await res.json();

    if (!data.SecurityToken) {
      throw new Error('Login response missing SecurityToken');
    }

    logInfo('AIMSii login successful');

    return data.SecurityToken;
  } catch (error) {
    logError('Failed to login to AIMSii', error);
    throw error;
  }
}

/**
 * Authenticate with AIMSii API using multi-step OAuth flow
 * Caches tokens for reuse
 *
 * @returns {Promise<Object>} Authentication credentials
 */
async function authenticate() {
  // Check if we have valid cached tokens
  if (authCache.expiresAt && Date.now() < authCache.expiresAt) {
    logInfo('Using cached AIMSii authentication tokens');
    return authCache;
  }

  logInfo('Authenticating with AIMSii API...');

  try {
    // Step 1: Get endpoint and OAuth token
    const endpointData = await getEndpoint();

    // Step 2: Login to get security token
    const securityToken = await login(endpointData.endpointDomain);

    // Cache tokens (expire in 23 hours to be safe)
    authCache = {
      endpointDomain: endpointData.endpointDomain,
      oauthToken: endpointData.oauthToken,
      securityToken: securityToken,
      expiresAt: Date.now() + (23 * 60 * 60 * 1000)
    };

    logInfo('AIMSii authentication complete');

    return authCache;
  } catch (error) {
    logError('Authentication failed', error);
    throw error;
  }
}

/**
 * Fetch inventory records from Tritech AIMSii API
 *
 * @param {Date} since - Fetch records created since this timestamp
 * @returns {Promise<Array>} Array of inventory records
 */
export async function fetchInventoryRecords(since = null) {
  const lookbackDate = since || getLookbackTimestamp();

  logInfo(`Fetching inventory records from AIMSii since ${lookbackDate.toISOString()}`);

  try {
    // Authenticate first
    const auth = await authenticate();

    // Build URL using authenticated endpoint domain
    const url = `${auth.endpointDomain}${config.aimsii.inventoryEndpoint}`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.oauthToken}`,
            'X-Security-Token': auth.securityToken
          },
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`AIMSii API error (${res.status}): ${errorBody}`);
        }

        return res.json();
      },
      {
        maxAttempts: config.retry.maxAttempts,
        initialDelay: config.retry.initialDelay,
        operationName: 'Fetch AIMSii Inventory'
      }
    );

    // Parse response - adjust based on actual AIMSii API response structure
    // This assumes the API returns an array of records or an object with a records array
    let records = Array.isArray(response) ? response : response.data || response.records || [];

    logInfo(`Fetched ${records.length} records from AIMSii API`);

    // Filter by timestamp
    records = filterByTimestamp(records, lookbackDate);
    logInfo(`${records.length} records match timestamp filter (since ${lookbackDate.toISOString()})`);

    // Filter by category if enabled
    if (config.sync.filterByCategory) {
      const beforeCategoryFilter = records.length;
      records = filterByCategory(records);
      logInfo(`${records.length} records match category filter (filtered out ${beforeCategoryFilter - records.length})`);
    }

    return records;
  } catch (error) {
    logError('Failed to fetch inventory records from AIMSii', error);
    throw error;
  }
}

/**
 * Filter records by timestamp
 * Assumes records have a 'created_at', 'createdAt', or 'timestamp' field
 *
 * @param {Array} records - Array of inventory records
 * @param {Date} since - Filter records created since this date
 * @returns {Array} Filtered records
 */
function filterByTimestamp(records, since) {
  return records.filter(record => {
    // Try different possible timestamp field names
    const timestamp = record.created_at || record.createdAt || record.timestamp || record.date_created;

    if (!timestamp) {
      logWarning('Record missing timestamp field, including by default', { recordId: record.id || 'unknown' });
      return true; // Include if no timestamp field found
    }

    const recordDate = new Date(timestamp);

    // Validate date
    if (isNaN(recordDate.getTime())) {
      logWarning('Invalid timestamp in record, including by default', {
        recordId: record.id || 'unknown',
        timestamp
      });
      return true;
    }

    return recordDate >= since;
  });
}

/**
 * Filter records by category
 *
 * @param {Array} records - Array of inventory records
 * @returns {Array} Filtered records
 */
function filterByCategory(records) {
  return records.filter(record => {
    // Try different possible category field names
    const category = record.category || record.product_type || record.type || record.productCategory;

    if (!category) {
      logWarning('Record missing category field, excluding from sync', {
        recordId: record.id || 'unknown'
      });
      return false;
    }

    return shouldSyncCategory(category);
  });
}

/**
 * Detect and extract location-specific quantities from AIMSii record
 *
 * @param {Object} aimsiiRecord - Raw record from AIMSii API
 * @returns {Object|null} Object mapping location names to quantities, or null if none found
 */
function extractLocationInventory(aimsiiRecord) {
  if (!config.inventory.enableLocationUpdates) {
    return null;
  }

  const locationInventory = {};
  const locationIdMapping = config.inventory.locationIdMapping;
  const patterns = config.inventory.locationQuantityPatterns;

  // For each location ID in the mapping
  Object.entries(locationIdMapping).forEach(([locationId, locationName]) => {
    // Try each pattern to find a matching field
    for (const pattern of patterns) {
      // Replace {id} placeholder with actual location ID
      const fieldName = pattern.replace('{id}', locationId);

      if (aimsiiRecord[fieldName] !== undefined && aimsiiRecord[fieldName] !== null) {
        const quantity = parseInt(aimsiiRecord[fieldName], 10);

        if (!isNaN(quantity)) {
          locationInventory[locationName] = quantity;
          logInfo(`Found location quantity: ${fieldName} (${locationName}) = ${quantity}`);
          break; // Found a match for this location, move to next location
        }
      }
    }
  });

  // Return null if no location-specific quantities were found
  return Object.keys(locationInventory).length > 0 ? locationInventory : null;
}

/**
 * Map AIMSii record to internal format expected by the rest of the application
 *
 * @param {Object} aimsiiRecord - Raw record from AIMSii API
 * @returns {Object} Mapped record with standardized field names
 */
export function mapAimsiiRecord(aimsiiRecord) {
  const mapped = {};

  // Map each field according to config.fieldMapping
  Object.entries(config.fieldMapping).forEach(([shopifyField, aimsiiFieldName]) => {
    if (aimsiiFieldName && aimsiiRecord[aimsiiFieldName] !== undefined) {
      mapped[shopifyField] = aimsiiRecord[aimsiiFieldName];
    }
  });

  // Extract location-specific inventory if multi-location is enabled
  const locationInventory = extractLocationInventory(aimsiiRecord);
  if (locationInventory) {
    mapped.locationInventory = locationInventory;
    logInfo(`Mapped location inventory for SKU ${aimsiiRecord[config.fieldMapping['variants.sku']]}:`, locationInventory);
  }

  // Keep original record for reference
  mapped._original = aimsiiRecord;

  return mapped;
}

/**
 * Get a single inventory record by ID (for testing/manual processing)
 *
 * @param {string} recordId - The ID of the record to fetch
 * @returns {Promise<Object>} The inventory record
 */
export async function fetchInventoryRecordById(recordId) {
  logInfo(`Fetching single inventory record from AIMSii: ${recordId}`);

  try {
    // Authenticate first
    const auth = await authenticate();

    // Build URL using authenticated endpoint domain
    const url = `${auth.endpointDomain}${config.aimsii.inventoryEndpoint}/${recordId}`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.oauthToken}`,
            'X-Security-Token': auth.securityToken
          },
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`AIMSii API error (${res.status}): ${errorBody}`);
        }

        return res.json();
      },
      {
        maxAttempts: config.retry.maxAttempts,
        initialDelay: config.retry.initialDelay,
        operationName: `Fetch AIMSii Record ${recordId}`
      }
    );

    return response;
  } catch (error) {
    logError(`Failed to fetch inventory record ${recordId} from AIMSii`, error);
    throw error;
  }
}

/**
 * Test AIMSii API connection
 *
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testAimsiiConnection() {
  try {
    logInfo('Testing AIMSii API connection...');

    // Test authentication flow
    const auth = await authenticate();

    // Try to fetch a small set of records
    const url = `${auth.endpointDomain}${config.aimsii.inventoryEndpoint}?limit=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.oauthToken}`,
        'X-Security-Token': auth.securityToken
      },
    });

    if (!response.ok) {
      throw new Error(`Connection failed with status ${response.status}`);
    }

    logInfo('AIMSii API connection successful');
    return true;
  } catch (error) {
    logError('AIMSii API connection test failed', error);
    return false;
  }
}
