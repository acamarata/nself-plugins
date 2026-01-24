/**
 * Stripe Plugin Configuration
 */

import 'dotenv/config';

export interface Config {
  // Stripe
  stripeApiKey: string;
  stripeApiVersion: string;
  stripeWebhookSecret: string;

  // Server
  port: number;
  host: string;

  // Database
  databaseHost: string;
  databasePort: number;
  databaseName: string;
  databaseUser: string;
  databasePassword: string;
  databaseSsl: boolean;

  // Sync
  syncInterval: number;
  logLevel: string;
}

export function loadConfig(overrides?: Partial<Config>): Config {
  const config: Config = {
    // Stripe
    stripeApiKey: process.env.STRIPE_API_KEY ?? '',
    stripeApiVersion: process.env.STRIPE_API_VERSION ?? '2024-12-18.acacia',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',

    // Server
    port: parseInt(process.env.STRIPE_PLUGIN_PORT ?? process.env.PORT ?? '3001', 10),
    host: process.env.STRIPE_PLUGIN_HOST ?? process.env.HOST ?? '0.0.0.0',

    // Database
    databaseHost: process.env.POSTGRES_HOST ?? 'localhost',
    databasePort: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    databaseName: process.env.POSTGRES_DB ?? 'nself',
    databaseUser: process.env.POSTGRES_USER ?? 'postgres',
    databasePassword: process.env.POSTGRES_PASSWORD ?? '',
    databaseSsl: process.env.POSTGRES_SSL === 'true',

    // Sync
    syncInterval: parseInt(process.env.STRIPE_SYNC_INTERVAL ?? '3600', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',

    // Apply overrides
    ...overrides,
  };

  // Validation
  if (!config.stripeApiKey) {
    throw new Error('STRIPE_API_KEY is required');
  }

  return config;
}

export function isTestMode(apiKey: string): boolean {
  return apiKey.startsWith('sk_test_') || apiKey.startsWith('rk_test_');
}

export function isLiveMode(apiKey: string): boolean {
  return apiKey.startsWith('sk_live_') || apiKey.startsWith('rk_live_');
}
