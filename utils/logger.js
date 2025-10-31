import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(path.dirname(__dirname), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const successLogPath = path.join(logsDir, 'success.log');
const errorLogPath = path.join(logsDir, 'errors.log');
const failedProductsPath = path.join(logsDir, 'failed-products.json');

/**
 * Format a log message with timestamp
 */
function formatMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
}

/**
 * Write to log file
 */
function writeToFile(filePath, message) {
  try {
    fs.appendFileSync(filePath, message, 'utf8');
  } catch (error) {
    console.error(`Failed to write to log file ${filePath}:`, error);
  }
}

/**
 * Log success message
 */
export function logSuccess(message, data = null) {
  const logMessage = formatMessage('SUCCESS', message, data);
  console.log(logMessage.trim());
  writeToFile(successLogPath, logMessage);
}

/**
 * Log error message
 */
export function logError(message, error = null, data = null) {
  const errorData = error ? {
    message: error.message,
    stack: error.stack,
    ...data
  } : data;

  const logMessage = formatMessage('ERROR', message, errorData);
  console.error(logMessage.trim());
  writeToFile(errorLogPath, logMessage);
}

/**
 * Log info message
 */
export function logInfo(message, data = null) {
  const logMessage = formatMessage('INFO', message, data);
  console.log(logMessage.trim());
  writeToFile(successLogPath, logMessage);
}

/**
 * Log warning message
 */
export function logWarning(message, data = null) {
  const logMessage = formatMessage('WARNING', message, data);
  console.warn(logMessage.trim());
  writeToFile(errorLogPath, logMessage);
}

/**
 * Save failed product for manual review
 */
export function saveFailedProduct(product, error) {
  try {
    let failedProducts = [];

    // Read existing failed products if file exists
    if (fs.existsSync(failedProductsPath)) {
      const content = fs.readFileSync(failedProductsPath, 'utf8');
      failedProducts = JSON.parse(content);
    }

    // Add new failed product
    failedProducts.push({
      timestamp: new Date().toISOString(),
      product,
      error: {
        message: error.message,
        stack: error.stack
      }
    });

    // Write back to file
    fs.writeFileSync(failedProductsPath, JSON.stringify(failedProducts, null, 2), 'utf8');
    logError('Failed product saved for manual review', null, { sku: product.sku || product.id });
  } catch (err) {
    logError('Failed to save failed product', err);
  }
}

/**
 * Get failed products for review
 */
export function getFailedProducts() {
  try {
    if (fs.existsSync(failedProductsPath)) {
      const content = fs.readFileSync(failedProductsPath, 'utf8');
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    logError('Failed to read failed products', error);
    return [];
  }
}

/**
 * Clear failed products log
 */
export function clearFailedProducts() {
  try {
    if (fs.existsSync(failedProductsPath)) {
      fs.unlinkSync(failedProductsPath);
      logInfo('Failed products log cleared');
    }
  } catch (error) {
    logError('Failed to clear failed products log', error);
  }
}
