#!/bin/bash
# =============================================================================
# Start/Stop Realtime Server
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

source "${SHARED_DIR}/plugin-utils.sh"

ACTION="${1:-start}"
PID_FILE="${HOME}/.nself/data/plugins/realtime/server.pid"
LOG_FILE="${HOME}/.nself/logs/plugins/realtime/server.log"

# =============================================================================
# Functions
# =============================================================================

start_server() {
    plugin_info "Starting realtime server..."

    # Check if already running
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            plugin_warn "Server already running (PID: $pid)"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi

    # Check TypeScript is built
    if [[ ! -f "${PLUGIN_DIR}/ts/dist/server.js" ]]; then
        plugin_info "Building TypeScript..."
        cd "${PLUGIN_DIR}/ts"
        npm run build
        cd - > /dev/null
    fi

    # Create directories
    mkdir -p "$(dirname "$PID_FILE")"
    mkdir -p "$(dirname "$LOG_FILE")"

    # Start server in background
    cd "${PLUGIN_DIR}/ts"
    NODE_ENV="${NODE_ENV:-production}" \
    nohup node dist/server.js >> "$LOG_FILE" 2>&1 &
    local pid=$!

    # Save PID
    echo "$pid" > "$PID_FILE"

    # Wait a moment and check if it started
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        plugin_success "Server started (PID: $pid)"
        printf "\n"
        printf "WebSocket URL: ws://localhost:%s\n" "${REALTIME_PORT:-3101}"
        printf "Health check:  http://localhost:%s/health\n" "${REALTIME_PORT:-3101}"
        printf "Metrics:       http://localhost:%s/metrics\n" "${REALTIME_PORT:-3101}"
        printf "Logs:          %s\n" "$LOG_FILE"
        printf "\n"
    else
        plugin_error "Server failed to start. Check logs: $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

stop_server() {
    plugin_info "Stopping realtime server..."

    if [[ ! -f "$PID_FILE" ]]; then
        plugin_warn "Server not running (no PID file)"
        return 0
    fi

    local pid
    pid=$(cat "$PID_FILE")

    if ! kill -0 "$pid" 2>/dev/null; then
        plugin_warn "Server not running (PID: $pid)"
        rm -f "$PID_FILE"
        return 0
    fi

    # Graceful shutdown
    kill -TERM "$pid" 2>/dev/null || true
    sleep 2

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        plugin_warn "Server not responding, force killing..."
        kill -KILL "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    plugin_success "Server stopped"
}

restart_server() {
    stop_server
    sleep 1
    start_server
}

server_status() {
    if [[ ! -f "$PID_FILE" ]]; then
        printf "Status: NOT RUNNING\n"
        return 1
    fi

    local pid
    pid=$(cat "$PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        printf "Status: RUNNING (PID: %s)\n" "$pid"

        # Try to get stats from server
        if command -v curl &> /dev/null; then
            local port="${REALTIME_PORT:-3101}"
            if curl -s "http://localhost:${port}/health" &> /dev/null; then
                printf "\nHealth check: OK\n"
                curl -s "http://localhost:${port}/metrics" 2>/dev/null || true
            fi
        fi

        return 0
    else
        printf "Status: STOPPED (stale PID: %s)\n" "$pid"
        rm -f "$PID_FILE"
        return 1
    fi
}

show_logs() {
    if [[ ! -f "$LOG_FILE" ]]; then
        plugin_warn "No logs found"
        return 0
    fi

    local lines="${1:-50}"
    tail -n "$lines" "$LOG_FILE"
}

# =============================================================================
# Main
# =============================================================================

case "$ACTION" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        server_status
        ;;
    logs)
        show_logs "${2:-50}"
        ;;
    *)
        printf "Usage: %s {start|stop|restart|status|logs [lines]}\n" "$0"
        exit 1
        ;;
esac
