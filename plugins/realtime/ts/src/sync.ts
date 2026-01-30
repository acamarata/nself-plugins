/**
 * Realtime plugin maintains live connection state.
 * It does not sync from external APIs - state is managed in real-time
 * through Socket.io connections and persisted to PostgreSQL.
 */
export function getSyncInfo(): { supported: false; reason: string } {
  return {
    supported: false,
    reason: 'Realtime plugin manages live state - no external data sync needed',
  };
}
