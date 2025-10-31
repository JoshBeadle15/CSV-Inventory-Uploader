/**
 * AI-Powered Field Mapping Service
 *
 * This service uses AI to automatically discover and generate field mappings
 * from AIMSii data to Shopify format. It learns from sample data and creates
 * a reusable mapping configuration.
 *
 * NOTE: Images are NOT handled by AI - they will be added manually later
 */

import fs from 'fs/promises';
import path from 'path';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger.js';
import { generateWithAI } from './aiProviderService.js';

const MAPPING_FILE_PATH = path.join(process.cwd(), 'ai-field-mappings.json');
const SAMPLE_SIZE = 5; // Number of products to analyze for mapping generation

/**
 * Load existing field mappings from file
 */
export async function loadFieldMappings() {
  try {
    const data = await fs.readFile(MAPPING_FILE_PATH, 'utf-8');
    const mappings = JSON.parse(data);
    logInfo('Loaded existing AI-generated field mappings');
    return mappings;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logInfo('No existing field mappings found');
      return null;
    }
    throw error;
  }
}

/**
 * Save field mappings to file
 */
export async function saveFieldMappings(mappings) {
  await fs.writeFile(
    MAPPING_FILE_PATH,
    JSON.stringify(mappings, null, 2),
    'utf-8'
  );
  logSuccess(`Field mappings saved to ${MAPPING_FILE_PATH}`);
}

/**
 * Generate field mappings using AI by analyzing sample data
 */
export async function generateFieldMappings(sampleRecords) {
  logInfo(`Analyzing ${sampleRecords.length} sample records to generate field mappings...`);

  const systemPrompt = `You are a data mapping expert specializing in e-commerce product data.
Your task is to analyze sample product records from an AIMSii inventory system and create optimal field mappings to Shopify's product schema.

AIMSii is a retail inventory management system. Analyze the provided sample records and determine:
1. Which AIMSii fields map to which Shopify fields
2. Which fields should be combined (e.g., manufacturer + model for title)
3. Which fields can be used to generate missing Shopify fields (e.g., description, tags)

IMPORTANT: DO NOT include or reference images. Images will be added manually later.

Required Shopify fields to map:
- title: Product title (should be descriptive and SEO-friendly)
- body_html: HTML product description
- vendor: Manufacturer/brand
- product_type: Product category
- tags: Comma-separated tags for searchability
- variants.price: Selling price
- variants.sku: Stock keeping unit
- variants.inventory_quantity: Available quantity
- variants.barcode: Product barcode (if available)

Respond with a JSON object containing:
1. directMappings: Simple 1-to-1 field mappings from AIMSii to Shopify
2. combinedFields: Fields that should be combined (with template using {fieldName} placeholders)
3. generationRules: Rules for AI-generating missing fields (like descriptions)
4. metadata: Any insights about the data structure`;

  const userPrompt = `Analyze these sample AIMSii product records and create optimal Shopify field mappings:

${JSON.stringify(sampleRecords, null, 2)}

Create a comprehensive mapping strategy that will work for all products in this inventory system.
Focus on musical instruments and retail products.

Remember: DO NOT include image mappings. Images will be handled manually.`;

  const response = await generateWithAI(systemPrompt, userPrompt, {
    temperature: 0.1, // Low temperature for consistent, logical mapping
    responseFormat: 'json'
  });

  const mappings = JSON.parse(response);

  // Add timestamp and version
  mappings.metadata = mappings.metadata || {};
  mappings.metadata.generatedAt = new Date().toISOString();
  mappings.metadata.version = '1.0';
  mappings.metadata.sampleSize = sampleRecords.length;
  mappings.metadata.note = 'Images not included - will be added manually';

  return mappings;
}

/**
 * Apply field mappings to a single product record
 */
export function applyFieldMappings(record, mappings) {
  const result = {};

  // Apply direct mappings
  if (mappings.directMappings) {
    for (const [shopifyField, aimsiiField] of Object.entries(mappings.directMappings)) {
      if (record[aimsiiField] !== undefined && record[aimsiiField] !== null && record[aimsiiField] !== '') {
        result[shopifyField] = record[aimsiiField];
      }
    }
  }

  // Apply combined fields (e.g., title = Mfg + Model + Desc)
  if (mappings.combinedFields) {
    for (const [shopifyField, combination] of Object.entries(mappings.combinedFields)) {
      if (combination.template) {
        // Replace placeholders in template with actual values
        let value = combination.template;
        for (const aimsiiField of combination.fields || []) {
          const placeholder = `{${aimsiiField}}`;
          const fieldValue = record[aimsiiField] || '';
          value = value.replace(placeholder, fieldValue);
        }
        // Clean up extra spaces
        result[shopifyField] = value.replace(/\s+/g, ' ').trim();
      }
    }
  }

  return result;
}

/**
 * Initialize field mappings (generate if not exists, or load existing)
 */
export async function initializeFieldMappings(sampleRecords) {
  // Try to load existing mappings
  let mappings = await loadFieldMappings();

  if (mappings) {
    logInfo('Using existing field mappings');
    logInfo(`Mappings generated on: ${mappings.metadata?.generatedAt || 'unknown'}`);
    return mappings;
  }

  // Generate new mappings if none exist
  logWarning('No field mappings found. Generating new mappings using AI...');
  logInfo(`This is a one-time setup. Analyzing ${sampleRecords.length} sample products...`);

  mappings = await generateFieldMappings(sampleRecords);

  // Save for future use
  await saveFieldMappings(mappings);

  logSuccess('Field mappings generated successfully!');
  logInfo(`You can review and edit the mappings at: ${MAPPING_FILE_PATH}`);

  return mappings;
}

/**
 * Validate that mappings are properly structured
 */
export function validateMappings(mappings) {
  if (!mappings || typeof mappings !== 'object') {
    throw new Error('Invalid mappings: must be an object');
  }

  const requiredSections = ['directMappings', 'combinedFields', 'generationRules'];
  for (const section of requiredSections) {
    if (!mappings[section]) {
      logWarning(`Mappings missing section: ${section}`);
    }
  }

  return true;
}
