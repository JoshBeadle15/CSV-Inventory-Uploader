/**
 * AI Provider Service - Unified interface for OpenAI and Gemini
 *
 * Provides Gemini as primary provider with OpenAI as fallback
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { logInfo, logWarning, logError } from '../utils/logger.js';

// Initialize providers
let openai;
let gemini;

if (config.ai.openai.apiKey) {
  openai = new OpenAI({ apiKey: config.ai.openai.apiKey });
}

if (config.ai.gemini.apiKey) {
  gemini = new GoogleGenerativeAI(config.ai.gemini.apiKey);
}

/**
 * Generate content using Gemini
 */
async function generateWithGemini(systemPrompt, userPrompt, options = {}) {
  if (!gemini) {
    throw new Error('Gemini API key not configured');
  }

  const model = gemini.getGenerativeModel({
    model: options.model || config.ai.gemini.model || 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: options.responseFormat === 'json' ? 'application/json' : 'text/plain',
      temperature: options.temperature ?? 0.2,
    }
  });

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text().trim();

  if (!text) {
    throw new Error('Received empty response from Gemini');
  }

  return text;
}

/**
 * Generate content using OpenAI
 */
async function generateWithOpenAI(systemPrompt, userPrompt, options = {}) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const completionOptions = {
    model: options.model || config.ai.openai.model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.2
  };

  // Add JSON schema if requested
  if (options.responseFormat === 'json' && options.jsonSchema) {
    completionOptions.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.jsonSchema.name || 'response',
        schema: options.jsonSchema.schema,
        strict: true
      }
    };
  } else if (options.responseFormat === 'json') {
    completionOptions.response_format = { type: 'json_object' };
  }

  const response = await openai.chat.completions.create(completionOptions);
  const text = response.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('Received empty response from OpenAI');
  }

  return text;
}

/**
 * Generate content with primary provider (Gemini) and fallback (OpenAI)
 */
export async function generateWithAI(systemPrompt, userPrompt, options = {}) {
  const primaryProvider = config.ai.provider || 'gemini';

  try {
    if (primaryProvider === 'gemini' && gemini) {
      logInfo('Using Gemini AI for generation');
      return await generateWithGemini(systemPrompt, userPrompt, options);
    } else if (primaryProvider === 'openai' && openai) {
      logInfo('Using OpenAI for generation');
      return await generateWithOpenAI(systemPrompt, userPrompt, options);
    } else {
      throw new Error(`Primary AI provider ${primaryProvider} not configured`);
    }
  } catch (error) {
    logWarning(`Primary AI provider (${primaryProvider}) failed: ${error.message}`);

    // Try fallback
    const fallbackProvider = primaryProvider === 'gemini' ? 'openai' : 'gemini';

    if (fallbackProvider === 'openai' && openai) {
      logInfo('Falling back to OpenAI...');
      return await generateWithOpenAI(systemPrompt, userPrompt, options);
    } else if (fallbackProvider === 'gemini' && gemini) {
      logInfo('Falling back to Gemini...');
      return await generateWithGemini(systemPrompt, userPrompt, options);
    } else {
      throw new Error(`Both AI providers failed. Last error: ${error.message}`);
    }
  }
}

/**
 * Check which AI providers are available
 */
export function getAvailableProviders() {
  return {
    gemini: !!gemini,
    openai: !!openai,
    primary: config.ai.provider || 'gemini'
  };
}
