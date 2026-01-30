/**
 * ID.me Webhook Event Handlers
 */

import { createLogger } from '@nself/plugin-utils';
import type { IDmeVerification, IDmeGroup, IDmeAttributes } from './types.js';

const logger = createLogger('idme:webhooks');

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Process an incoming webhook event by type
 */
export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  logger.info('Processing webhook event', { type: event.type });

  switch (event.type) {
    case 'verification.created':
      await handleVerificationCreated(event.data);
      break;

    case 'verification.updated':
      await handleVerificationUpdated(event.data);
      break;

    case 'verification.completed':
      await handleVerificationCompleted(event.data);
      break;

    case 'verification.failed':
      await handleVerificationFailed(event.data);
      break;

    case 'group.verified':
      await handleGroupVerified(event.data);
      break;

    case 'group.revoked':
      await handleGroupRevoked(event.data);
      break;

    case 'attribute.updated':
      await handleAttributeUpdated(event.data);
      break;

    default:
      logger.warn('Unhandled webhook event type', { type: event.type });
      break;
  }
}

async function handleVerificationCreated(data: Record<string, unknown>): Promise<void> {
  logger.info('Verification created', { userId: data.user_id });
}

async function handleVerificationUpdated(data: Record<string, unknown>): Promise<void> {
  logger.info('Verification updated', { userId: data.user_id });
}

async function handleVerificationCompleted(data: Record<string, unknown>): Promise<void> {
  logger.info('Verification completed', { userId: data.user_id });
}

async function handleVerificationFailed(data: Record<string, unknown>): Promise<void> {
  logger.info('Verification failed', { userId: data.user_id, reason: data.reason });
}

async function handleGroupVerified(data: Record<string, unknown>): Promise<void> {
  logger.info('Group verified', { userId: data.user_id, group: data.group_type });
}

async function handleGroupRevoked(data: Record<string, unknown>): Promise<void> {
  logger.info('Group revoked', { userId: data.user_id, group: data.group_type });
}

async function handleAttributeUpdated(data: Record<string, unknown>): Promise<void> {
  logger.info('Attribute updated', { userId: data.user_id, attribute: data.attribute_key });
}
