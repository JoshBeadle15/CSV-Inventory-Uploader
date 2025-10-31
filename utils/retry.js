import { logWarning, logError } from './logger.js';

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @param {string} options.operationName - Name of operation for logging
 * @returns {Promise} Result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    operationName = 'Operation'
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (attempt > 1) {
        logWarning(`${operationName} succeeded on attempt ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        logWarning(`${operationName} failed on attempt ${attempt}/${maxAttempts}. Retrying in ${delay}ms...`, {
          error: error.message,
          attempt,
          maxAttempts
        });

        await sleep(delay);

        // Exponential backoff with max delay cap
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      } else {
        logError(`${operationName} failed after ${maxAttempts} attempts`, error);
      }
    }
  }

  // All attempts failed
  throw lastError;
}

/**
 * Check if an error is retryable (e.g., network errors, rate limits)
 * Non-retryable errors: validation errors, authentication errors
 */
export function isRetryableError(error) {
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /rate limit/i,
    /429/,
    /500/,
    /502/,
    /503/,
    /504/
  ];

  const nonRetryablePatterns = [
    /401/,  // Unauthorized
    /403/,  // Forbidden
    /404/,  // Not Found
    /400/,  // Bad Request (validation)
    /422/   // Unprocessable Entity (validation)
  ];

  const errorString = error.message || error.toString();

  // Check if error is explicitly non-retryable
  for (const pattern of nonRetryablePatterns) {
    if (pattern.test(errorString)) {
      return false;
    }
  }

  // Check if error is retryable
  for (const pattern of retryablePatterns) {
    if (pattern.test(errorString)) {
      return true;
    }
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Retry with conditional logic based on error type
 */
export async function retryIfRetryable(fn, options = {}) {
  try {
    return await retryWithBackoff(fn, options);
  } catch (error) {
    if (!isRetryableError(error)) {
      logWarning(`${options.operationName || 'Operation'} failed with non-retryable error. Skipping retries.`, {
        error: error.message
      });
      throw error;
    }
    throw error;
  }
}
