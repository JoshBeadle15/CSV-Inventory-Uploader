import { config, getLookbackTimestamp, shouldSyncCategory } from '../config.js';
import { logInfo, logError, logWarning } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';

/**
 * Fetch inventory records from Tritech AIMSii API
 *
 * @param {Date} since - Fetch records created since this timestamp
 * @returns {Promise<Array>} Array of inventory records
 */
export async function fetchInventoryRecords(since = null) {
  const lookbackDate = since || getLookbackTimestamp();
  const url = `${config.aimsii.apiUrl}${config.aimsii.inventoryEndpoint}`;

  logInfo(`Fetching inventory records from AIMSii since ${lookbackDate.toISOString()}`);

  try {
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.aimsii.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
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
  const url = `${config.aimsii.apiUrl}${config.aimsii.inventoryEndpoint}/${recordId}`;

  logInfo(`Fetching single inventory record from AIMSii: ${recordId}`);

  try {
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.aimsii.apiKey}`,
            'Content-Type': 'application/json',
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

    // Try to fetch a small set of records
    const url = `${config.aimsii.apiUrl}${config.aimsii.inventoryEndpoint}?limit=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.aimsii.apiKey}`,
        'Content-Type': 'application/json',
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
