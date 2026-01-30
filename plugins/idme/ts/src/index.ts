/**
 * ID.me Plugin for nself
 * OAuth authentication with government-grade identity verification
 */

export { IDmeClient, createIDmeClient } from './client.js';
export { IDmeDatabase, createDatabase } from './database.js';
export { createServer } from './server.js';
export { loadConfig } from './config.js';
export { handleWebhookEvent } from './webhooks.js';
export { syncVerifications, syncGroups } from './sync.js';

export type {
  IDmeConfig,
  IDmeTokens,
  IDmeUserProfile,
  IDmeVerification,
  IDmeGroup,
  IDmeAttributes,
  IDmeBadge,
  IDmeVerificationRecord,
  IDmeGroupRecord,
  IDmeBadgeRecord,
  IDmeAttributeRecord,
  IDmeWebhookEvent,
} from './types.js';

export { IDME_SCOPES, BADGE_CONFIG } from './types.js';
