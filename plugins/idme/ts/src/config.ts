/**
 * ID.me Configuration
 */

import { config } from 'dotenv';
import { createLogger } from '@nself/plugin-utils';
import type { IDmeConfig } from './types.js';

const logger = createLogger('idme:config');

// Load environment variables
config();

export function loadConfig(): IDmeConfig {
  const clientId = process.env.IDME_CLIENT_ID;
  const clientSecret = process.env.IDME_CLIENT_SECRET;
  const redirectUri = process.env.IDME_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing required ID.me configuration. Please set IDME_CLIENT_ID, IDME_CLIENT_SECRET, and IDME_REDIRECT_URI');
  }

  const scopes = (process.env.IDME_SCOPES || 'openid,email,profile').split(',').map(s => s.trim());
  const sandbox = process.env.IDME_SANDBOX === 'true';
  const webhookSecret = process.env.IDME_WEBHOOK_SECRET;

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    sandbox,
    webhookSecret,
  };
}

export const DEFAULT_PORT = 3010;
export const DEFAULT_HOST = '0.0.0.0';
