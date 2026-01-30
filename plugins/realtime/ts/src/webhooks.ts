/**
 * Realtime plugin is a Socket.io server that handles real-time events directly.
 * It does not use traditional HTTP webhooks - events flow through WebSocket connections.
 */
export function getWebhookInfo(): { supported: false; reason: string } {
  return {
    supported: false,
    reason: 'Realtime plugin uses WebSocket events, not HTTP webhooks',
  };
}
