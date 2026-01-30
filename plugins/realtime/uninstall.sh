#!/bin/bash
# =============================================================================
# Realtime Plugin Uninstaller
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

# Source utilities
source "${SHARED_DIR}/plugin-utils.sh"
source "${SHARED_DIR}/schema-sync.sh"

# =============================================================================
# Uninstallation
# =============================================================================

uninstall_realtime_plugin() {
    plugin_info "Uninstalling Realtime plugin..."

    # Confirm data deletion
    plugin_warn "This will remove all realtime data including:"
    printf "  - Active connections\n"
    printf "  - Room configurations\n"
    printf "  - Room memberships\n"
    printf "  - Presence data\n"
    printf "  - Typing indicators\n"
    printf "  - Event logs\n"
    printf "\n"

    printf "Continue? (y/N): "
    read -r REPLY
    printf "\n"

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        plugin_info "Uninstall cancelled."
        exit 0
    fi

    # Stop server if running
    if [[ -f "${HOME}/.nself/data/plugins/realtime/server.pid" ]]; then
        plugin_info "Stopping realtime server..."
        local pid
        pid=$(cat "${HOME}/.nself/data/plugins/realtime/server.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            plugin_success "Server stopped (PID: $pid)"
        fi
        rm -f "${HOME}/.nself/data/plugins/realtime/server.pid"
    fi

    # Drop database tables
    plugin_info "Dropping database tables..."

    plugin_db_exec "DROP VIEW IF EXISTS realtime_presence_summary CASCADE;"
    plugin_db_exec "DROP VIEW IF EXISTS realtime_current_typing CASCADE;"
    plugin_db_exec "DROP VIEW IF EXISTS realtime_room_stats CASCADE;"
    plugin_db_exec "DROP VIEW IF EXISTS realtime_active_connections CASCADE;"

    plugin_db_exec "DROP TABLE IF EXISTS realtime_events CASCADE;"
    plugin_db_exec "DROP TABLE IF EXISTS realtime_typing CASCADE;"
    plugin_db_exec "DROP TABLE IF EXISTS realtime_presence CASCADE;"
    plugin_db_exec "DROP TABLE IF EXISTS realtime_room_members CASCADE;"
    plugin_db_exec "DROP TABLE IF EXISTS realtime_rooms CASCADE;"
    plugin_db_exec "DROP TABLE IF EXISTS realtime_connections CASCADE;"

    plugin_db_exec "DROP FUNCTION IF EXISTS cleanup_expired_typing() CASCADE;"
    plugin_db_exec "DROP FUNCTION IF EXISTS update_presence_from_activity() CASCADE;"
    plugin_db_exec "DROP FUNCTION IF EXISTS disconnect_stale_connections() CASCADE;"
    plugin_db_exec "DROP FUNCTION IF EXISTS update_room_timestamp() CASCADE;"
    plugin_db_exec "DROP FUNCTION IF EXISTS update_presence_timestamp() CASCADE;"

    # Remove migration records
    schema_remove_plugin_migrations "realtime"

    # Remove cache and logs (ask first)
    printf "Remove cache and logs? (y/N): "
    read -r REPLY
    printf "\n"

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        plugin_info "Removing cache and logs..."
        rm -rf "${HOME}/.nself/cache/plugins/realtime"
        rm -rf "${HOME}/.nself/logs/plugins/realtime"
        rm -rf "${HOME}/.nself/data/plugins/realtime"
    fi

    plugin_success "Realtime plugin uninstalled successfully!"

    printf "\n"
    printf "Note: The TypeScript code in ts/ directory has not been deleted.\n"
    printf "You can manually remove it if desired.\n"
    printf "\n"
}

# Run uninstallation
uninstall_realtime_plugin
