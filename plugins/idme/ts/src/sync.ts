import { createLogger } from '@nself/plugin-utils';

const logger = createLogger('idme:sync');

/**
 * ID.me uses OAuth flow rather than traditional data sync.
 * Users authenticate via OAuth, and data is synced on-demand during verification.
 * This module provides utility methods for batch operations.
 */
export async function syncVerifications(): Promise<{ synced: number }> {
  logger.info('ID.me sync is OAuth-based - verifications sync on user authentication');
  return { synced: 0 };
}

export async function syncGroups(): Promise<{ synced: number }> {
  logger.info('Group data syncs automatically during OAuth verification');
  return { synced: 0 };
}
