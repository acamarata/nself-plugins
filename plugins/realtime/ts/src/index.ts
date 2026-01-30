/**
 * Realtime Plugin - Main entry point
 */

export { Database } from './database.js';
export { config, loadConfig } from './config.js';
export { getWebhookInfo } from './webhooks.js';
export { getSyncInfo } from './sync.js';
export * from './types.js';

// Re-export for easy importing
export const version = '1.0.0';
