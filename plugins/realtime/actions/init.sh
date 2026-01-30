#!/bin/bash
# =============================================================================
# Initialize Realtime Server
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

source "${SHARED_DIR}/plugin-utils.sh"

plugin_info "Initializing realtime server..."

# Check database connection
if ! plugin_db_check; then
    plugin_error "Cannot connect to database. Check DATABASE_URL."
    exit 1
fi

# Verify schema is installed
if ! plugin_db_table_exists "realtime_connections"; then
    plugin_error "Schema not installed. Run: nself plugin realtime install"
    exit 1
fi

# Check Redis connection
if [[ -z "${REALTIME_REDIS_URL:-}" ]]; then
    plugin_error "REALTIME_REDIS_URL not set."
    exit 1
fi

# Test Redis connection
plugin_info "Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    REDIS_HOST=$(echo "${REALTIME_REDIS_URL}" | sed -E 's|redis://([^:]+).*|\1|')
    REDIS_PORT=$(echo "${REALTIME_REDIS_URL}" | sed -E 's|redis://[^:]+:?([0-9]+)?.*|\1|')
    REDIS_PORT=${REDIS_PORT:-6379}

    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        plugin_success "Redis connection OK"
    else
        plugin_error "Cannot connect to Redis at ${REDIS_HOST}:${REDIS_PORT}"
        exit 1
    fi
fi

# Create default rooms if needed
plugin_info "Creating default rooms..."

plugin_db_exec "
INSERT INTO realtime_rooms (name, type, visibility)
VALUES
    ('general', 'channel', 'public'),
    ('announcements', 'channel', 'public')
ON CONFLICT (name) DO NOTHING;
"

# Clean up stale data
plugin_info "Cleaning up stale data..."

plugin_db_exec "DELETE FROM realtime_typing WHERE expires_at < NOW();"
plugin_db_exec "UPDATE realtime_connections SET status = 'disconnected', disconnected_at = NOW() WHERE status = 'connected';"
plugin_db_exec "UPDATE realtime_presence SET status = 'offline', connections_count = 0 WHERE connections_count > 0;"

plugin_success "Realtime server initialized!"

printf "\n"
printf "Default rooms created:\n"
printf "  - general (public channel)\n"
printf "  - announcements (public channel)\n"
printf "\n"
printf "Ready to start server: nself plugin realtime server\n"
printf "\n"
