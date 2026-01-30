/**
 * Jobs Plugin Configuration
 * Load and validate configuration from environment variables
 */

import { config } from 'dotenv';
import type { JobsConfig } from './types.js';

// Load .env file
config();

/**
 * Load configuration from environment variables
 */
export function loadConfig(overrides?: Partial<JobsConfig>): JobsConfig {
  const cfg: JobsConfig = {
    // Redis
    redisUrl: process.env.JOBS_REDIS_URL || 'redis://localhost:6379',

    // Dashboard
    dashboardEnabled: process.env.JOBS_DASHBOARD_ENABLED !== 'false',
    dashboardPort: parseInt(process.env.JOBS_DASHBOARD_PORT || '3105', 10),
    dashboardPath: process.env.JOBS_DASHBOARD_PATH || '/dashboard',

    // Worker
    defaultConcurrency: parseInt(process.env.JOBS_DEFAULT_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.JOBS_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.JOBS_RETRY_DELAY || '5000', 10),
    jobTimeout: parseInt(process.env.JOBS_JOB_TIMEOUT || '60000', 10),

    // Monitoring
    enableTelemetry: process.env.JOBS_ENABLE_TELEMETRY !== 'false',

    // Cleanup
    cleanCompletedAfter: parseInt(process.env.JOBS_CLEAN_COMPLETED_AFTER || '86400000', 10), // 24 hours
    cleanFailedAfter: parseInt(process.env.JOBS_CLEAN_FAILED_AFTER || '604800000', 10), // 7 days

    // Database
    database: {
      host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.DB_NAME || process.env.POSTGRES_DB || 'nself',
      user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
    },

    ...overrides,
  };

  return cfg;
}

/**
 * Validate configuration
 */
export function validateConfig(config: JobsConfig): void {
  const errors: string[] = [];

  // Required fields
  if (!config.redisUrl) {
    errors.push('JOBS_REDIS_URL is required');
  }

  if (!config.database.host) {
    errors.push('DB_HOST or POSTGRES_HOST is required');
  }

  if (!config.database.database) {
    errors.push('DB_NAME or POSTGRES_DB is required');
  }

  // Validate ranges
  if (config.defaultConcurrency < 1) {
    errors.push('JOBS_DEFAULT_CONCURRENCY must be >= 1');
  }

  if (config.retryAttempts < 0) {
    errors.push('JOBS_RETRY_ATTEMPTS must be >= 0');
  }

  if (config.retryDelay < 0) {
    errors.push('JOBS_RETRY_DELAY must be >= 0');
  }

  if (config.jobTimeout < 1000) {
    errors.push('JOBS_JOB_TIMEOUT must be >= 1000');
  }

  if (config.dashboardPort < 1 || config.dashboardPort > 65535) {
    errors.push('JOBS_DASHBOARD_PORT must be between 1 and 65535');
  }

  if (errors.length > 0) {
    throw new Error('Configuration errors:\n' + errors.join('\n'));
  }
}

/**
 * Get configuration with validation
 */
export function getConfig(overrides?: Partial<JobsConfig>): JobsConfig {
  const config = loadConfig(overrides);
  validateConfig(config);
  return config;
}

export type { JobsConfig };
