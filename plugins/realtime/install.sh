#!/bin/bash
# =============================================================================
# Realtime Plugin Installer
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

# Source utilities
source "${SHARED_DIR}/plugin-utils.sh"
source "${SHARED_DIR}/schema-sync.sh"

# =============================================================================
# Installation
# =============================================================================

install_realtime_plugin() {
    plugin_info "Installing Realtime plugin..."

    # Check required environment variables
    if ! plugin_check_env "realtime" "REALTIME_REDIS_URL"; then
        plugin_error "REALTIME_REDIS_URL not set. Redis is required for Socket.io adapter."
        plugin_info "Add to your .env: REALTIME_REDIS_URL=redis://localhost:6379"
        exit 1
    fi

    if ! plugin_check_env "realtime" "REALTIME_CORS_ORIGIN"; then
        plugin_warn "REALTIME_CORS_ORIGIN not set. Using default: http://localhost:3000"
        export REALTIME_CORS_ORIGIN="http://localhost:3000"
    fi

    # Apply database schema
    plugin_info "Applying database schema..."

    # Ensure migrations table exists
    schema_ensure_migrations_table

    # Apply main schema
    if [[ -f "${PLUGIN_DIR}/schema/tables.sql" ]]; then
        plugin_db_exec_file "${PLUGIN_DIR}/schema/tables.sql"
    fi

    # Apply migrations
    if [[ -d "${PLUGIN_DIR}/schema/migrations" ]]; then
        for migration in "${PLUGIN_DIR}/schema/migrations"/*.sql; do
            [[ ! -f "$migration" ]] && continue

            local migration_name
            migration_name=$(basename "$migration" .sql)

            if ! schema_migration_applied "realtime" "$migration_name"; then
                plugin_info "Applying migration: $migration_name"
                plugin_db_exec_file "$migration"
                schema_record_migration "realtime" "$migration_name"
            fi
        done
    fi

    # Create cache and log directories
    mkdir -p "${HOME}/.nself/cache/plugins/realtime"
    mkdir -p "${HOME}/.nself/logs/plugins/realtime"
    mkdir -p "${HOME}/.nself/data/plugins/realtime"

    # Install TypeScript dependencies
    if [[ -d "${PLUGIN_DIR}/ts" ]]; then
        plugin_info "Installing TypeScript dependencies..."
        cd "${PLUGIN_DIR}/ts"
        npm install
        npm run build
        cd - > /dev/null
    fi

    # Setup systemd service (optional)
    if command -v systemctl &> /dev/null && [[ -f "${PLUGIN_DIR}/templates/realtime.service" ]]; then
        plugin_info "Systemd detected. Service template available at templates/realtime.service"
        plugin_info "To install as a service, run: sudo systemctl enable ${PLUGIN_DIR}/templates/realtime.service"
    fi

    plugin_success "Realtime plugin installed successfully!"

    printf "\n"
    printf "Configuration:\n"
    printf "  REALTIME_REDIS_URL:    %s\n" "${REALTIME_REDIS_URL}"
    printf "  REALTIME_CORS_ORIGIN:  %s\n" "${REALTIME_CORS_ORIGIN}"
    printf "  REALTIME_PORT:         %s\n" "${REALTIME_PORT:-3101}"
    printf "\n"
    printf "Next steps:\n"
    printf "  1. Review .env configuration (see .env.example)\n"
    printf "  2. Start the server: nself plugin realtime server\n"
    printf "  3. Check status: nself plugin realtime status\n"
    printf "  4. View rooms: nself plugin realtime rooms\n"
    printf "\n"
    printf "Endpoints:\n"
    printf "  WebSocket:  ws://localhost:%s\n" "${REALTIME_PORT:-3101}"
    printf "  Health:     http://localhost:%s/health\n" "${REALTIME_PORT:-3101}"
    printf "  Metrics:    http://localhost:%s/metrics\n" "${REALTIME_PORT:-3101}"
    printf "\n"
}

# Run installation
install_realtime_plugin
