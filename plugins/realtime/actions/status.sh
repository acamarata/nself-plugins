#!/bin/bash
# =============================================================================
# Show Realtime Server Status
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

source "${SHARED_DIR}/plugin-utils.sh"

plugin_info "Realtime Server Status"
printf "\n"

# Check database connection
if ! plugin_db_check; then
    plugin_error "Database connection failed"
    exit 1
fi

# Server process status
PID_FILE="${HOME}/.nself/data/plugins/realtime/server.pid"
if [[ -f "$PID_FILE" ]]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        printf "Server Process:     RUNNING (PID: %s)\n" "$pid"
    else
        printf "Server Process:     STOPPED (stale PID)\n"
    fi
else
    printf "Server Process:     STOPPED\n"
fi

# Get active connections count
ACTIVE_CONN=$(plugin_db_query "SELECT COUNT(*) FROM realtime_connections WHERE status = 'connected';")
printf "Active Connections: %s\n" "$ACTIVE_CONN"

# Get unique users count
UNIQUE_USERS=$(plugin_db_query "SELECT COUNT(DISTINCT user_id) FROM realtime_connections WHERE status = 'connected' AND user_id IS NOT NULL;")
printf "Unique Users:       %s\n" "$UNIQUE_USERS"

# Get rooms count
TOTAL_ROOMS=$(plugin_db_query "SELECT COUNT(*) FROM realtime_rooms WHERE is_active = TRUE;")
printf "Active Rooms:       %s\n" "$TOTAL_ROOMS"

printf "\n"

# Presence breakdown
printf "Presence Status:\n"
plugin_db_exec "
SELECT
    status,
    COUNT(*) AS count
FROM realtime_presence
GROUP BY status
ORDER BY count DESC;
" | while IFS='|' read -r status count; do
    printf "  %-10s %s\n" "$status" "$count"
done

printf "\n"

# Top active rooms
printf "Top 5 Active Rooms:\n"
plugin_db_exec "
SELECT
    r.name,
    COUNT(DISTINCT c.socket_id) AS connections
FROM realtime_rooms r
LEFT JOIN realtime_room_members rm ON r.id = rm.room_id
LEFT JOIN realtime_connections c ON rm.user_id = c.user_id AND c.status = 'connected'
WHERE r.is_active = TRUE
GROUP BY r.name
ORDER BY connections DESC
LIMIT 5;
" | while IFS='|' read -r name connections; do
    printf "  %-20s %s connections\n" "$name" "$connections"
done

printf "\n"

# Recent events
printf "Recent Events (last 10):\n"
plugin_db_exec "
SELECT
    event_type,
    user_id,
    TO_CHAR(created_at, 'HH24:MI:SS') AS time
FROM realtime_events
ORDER BY created_at DESC
LIMIT 10;
" | while IFS='|' read -r event_type user_id time; do
    printf "  [%s] %-20s %s\n" "$time" "$event_type" "${user_id:-anonymous}"
done

printf "\n"

# Check HTTP endpoints if server is running
if [[ -f "$PID_FILE" ]]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null && command -v curl &> /dev/null; then
        port="${REALTIME_PORT:-3101}"

        printf "HTTP Endpoints:\n"

        if curl -s "http://localhost:${port}/health" &> /dev/null; then
            printf "  Health:  http://localhost:%s/health  ✓\n" "$port"
        else
            printf "  Health:  http://localhost:%s/health  ✗\n" "$port"
        fi

        if curl -s "http://localhost:${port}/metrics" &> /dev/null; then
            printf "  Metrics: http://localhost:%s/metrics ✓\n" "$port"
        else
            printf "  Metrics: http://localhost:%s/metrics ✗\n" "$port"
        fi

        printf "\n"
    fi
fi

plugin_success "Status check complete"
