/**
 * XLSX Data Service
 *
 * Service for reading product data from the local XLSX file
 * This is useful for testing and development with real MusicVilla data
 */

import ExcelJS from 'exceljs';
import { logInfo, logError } from '../utils/logger.js';
import path from 'path';

const DEFAULT_XLSX_PATH = '/Users/ninja/Downloads/InventoryCountbyCategoryFEED.xlsx';

/**
 * Read products from XLSX file
 */
export async function readProductsFromXLSX(filePath = DEFAULT_XLSX_PATH, options = {}) {
  const {
    limit = null, // Limit number of products to read
    offset = 0,   // Skip first N products
    categories = null // Filter by categories (array)
  } = options;

  try {
    logInfo(`Reading products from XLSX: ${path.basename(filePath)}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];

    // Get headers from first row
    const headers = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers.push(cell.value);
    });

    logInfo(`Found ${worksheet.rowCount - 1} products in spreadsheet`);

    // Read product data
    const products = [];
    let rowsProcessed = 0;
    let rowsSkipped = 0;

    for (let i = 2; i <= worksheet.rowCount; i++) { // Start from row 2 (skip header)
      // Skip offset rows
      if (rowsProcessed < offset) {
        rowsProcessed++;
        continue;
      }

      // Check limit
      if (limit && products.length >= limit) {
        break;
      }

      const row = worksheet.getRow(i);
      const product = {};

      // Map cells to headers
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        product[header] = cell.value;
      });

      // Filter by categories if specified
      if (categories && categories.length > 0) {
        const productCategory = product['Cat Desc'];
        if (!categories.includes(productCategory)) {
          rowsSkipped++;
          continue;
        }
      }

      products.push(product);
      rowsProcessed++;
    }

    logInfo(`Loaded ${products.length} products (skipped ${rowsSkipped} due to filters)`);

    return products;

  } catch (error) {
    logError('Error reading XLSX file', error);
    throw error;
  }
}

/**
 * Get sample products for field mapping analysis
 */
export async function getSampleProducts(count = 5, filePath = DEFAULT_XLSX_PATH) {
  logInfo(`Reading ${count} sample products for field mapping analysis`);

  return await readProductsFromXLSX(filePath, {
    limit: count,
    offset: 0
  });
}

/**
 * Get product categories from XLSX
 */
export async function getProductCategories(filePath = DEFAULT_XLSX_PATH) {
  const products = await readProductsFromXLSX(filePath, { limit: 1000 });

  const categories = new Set();
  const subcategories = new Set();

  products.forEach(product => {
    if (product['Cat Desc']) {
      categories.add(product['Cat Desc']);
    }
    if (product['Sub Desc']) {
      subcategories.add(product['Sub Desc']);
    }
  });

  return {
    categories: Array.from(categories).sort(),
    subcategories: Array.from(subcategories).sort()
  };
}
