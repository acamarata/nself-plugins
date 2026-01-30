import { createLogger } from '@nself/plugin-utils';

const logger = createLogger('file-processing:webhooks');

/**
 * File processing plugin is an internal infrastructure service.
 * It sends outbound webhooks to notify applications when processing completes,
 * but does not receive inbound webhooks from external services.
 */
export function getWebhookInfo(): { supported: false; reason: string } {
  return {
    supported: false,
    reason: 'File processing sends outbound notifications but does not receive external webhooks',
  };
}
