#!/bin/bash
# =============================================================================
# Manage Realtime Rooms
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

source "${SHARED_DIR}/plugin-utils.sh"

ACTION="${1:-list}"

# =============================================================================
# Functions
# =============================================================================

list_rooms() {
    plugin_info "Active Rooms"
    printf "\n"

    printf "%-36s %-20s %-10s %-10s %-10s\n" "ID" "NAME" "TYPE" "MEMBERS" "ACTIVE"
    printf "%s\n" "$(printf '%.0s-' {1..88})"

    plugin_db_exec "
    SELECT
        r.id,
        r.name,
        r.type,
        COUNT(DISTINCT rm.user_id) AS members,
        COUNT(DISTINCT c.socket_id) AS active
    FROM realtime_rooms r
    LEFT JOIN realtime_room_members rm ON r.id = rm.room_id
    LEFT JOIN realtime_connections c ON rm.user_id = c.user_id AND c.status = 'connected'
    WHERE r.is_active = TRUE
    GROUP BY r.id, r.name, r.type
    ORDER BY active DESC, members DESC;
    " | while IFS='|' read -r id name type members active; do
        printf "%-36s %-20s %-10s %-10s %-10s\n" "$id" "$name" "$type" "$members" "$active"
    done

    printf "\n"
}

create_room() {
    local name="${2:-}"
    local type="${3:-channel}"
    local visibility="${4:-public}"

    if [[ -z "$name" ]]; then
        plugin_error "Room name required"
        printf "Usage: rooms create <name> [type] [visibility]\n"
        exit 1
    fi

    plugin_info "Creating room: $name"

    plugin_db_exec "
    INSERT INTO realtime_rooms (name, type, visibility)
    VALUES ('$name', '$type', '$visibility')
    ON CONFLICT (name) DO NOTHING;
    "

    plugin_success "Room created: $name (type: $type, visibility: $visibility)"
}

delete_room() {
    local name="${2:-}"

    if [[ -z "$name" ]]; then
        plugin_error "Room name required"
        printf "Usage: rooms delete <name>\n"
        exit 1
    fi

    plugin_warn "This will delete room '$name' and all associated data"
    read -p "Continue? (y/N): " -n 1 -r
    printf "\n"

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        plugin_info "Cancelled"
        return 0
    fi

    plugin_db_exec "DELETE FROM realtime_rooms WHERE name = '$name';"
    plugin_success "Room deleted: $name"
}

room_info() {
    local name="${2:-}"

    if [[ -z "$name" ]]; then
        plugin_error "Room name required"
        printf "Usage: rooms info <name>\n"
        exit 1
    fi

    plugin_info "Room: $name"
    printf "\n"

    # Room details
    plugin_db_exec "
    SELECT
        id,
        type,
        visibility,
        max_members,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created
    FROM realtime_rooms
    WHERE name = '$name';
    " | while IFS='|' read -r id type visibility max_members created; do
        printf "ID:           %s\n" "$id"
        printf "Type:         %s\n" "$type"
        printf "Visibility:   %s\n" "$visibility"
        printf "Max Members:  %s\n" "${max_members:-unlimited}"
        printf "Created:      %s\n" "$created"
    done

    printf "\n"

    # Member stats
    local total_members
    total_members=$(plugin_db_query "SELECT COUNT(*) FROM realtime_room_members rm JOIN realtime_rooms r ON rm.room_id = r.id WHERE r.name = '$name';")
    printf "Total Members: %s\n" "$total_members"

    local active_members
    active_members=$(plugin_db_query "SELECT COUNT(DISTINCT c.socket_id) FROM realtime_room_members rm JOIN realtime_rooms r ON rm.room_id = r.id LEFT JOIN realtime_connections c ON rm.user_id = c.user_id AND c.status = 'connected' WHERE r.name = '$name';")
    printf "Active Now:    %s\n" "$active_members"

    printf "\n"

    # Recent members
    printf "Recent Members:\n"
    plugin_db_exec "
    SELECT
        rm.user_id,
        rm.role,
        TO_CHAR(rm.joined_at, 'YYYY-MM-DD HH24:MI:SS') AS joined,
        CASE WHEN c.status = 'connected' THEN 'online' ELSE 'offline' END AS status
    FROM realtime_room_members rm
    JOIN realtime_rooms r ON rm.room_id = r.id
    LEFT JOIN realtime_connections c ON rm.user_id = c.user_id AND c.status = 'connected'
    WHERE r.name = '$name'
    ORDER BY rm.joined_at DESC
    LIMIT 10;
    " | while IFS='|' read -r user_id role joined status; do
        printf "  %-30s %-12s %-20s %s\n" "$user_id" "$role" "$joined" "$status"
    done

    printf "\n"
}

add_member() {
    local room_name="${2:-}"
    local user_id="${3:-}"
    local role="${4:-member}"

    if [[ -z "$room_name" ]] || [[ -z "$user_id" ]]; then
        plugin_error "Room name and user ID required"
        printf "Usage: rooms add-member <room> <user_id> [role]\n"
        exit 1
    fi

    plugin_db_exec "
    INSERT INTO realtime_room_members (room_id, user_id, role)
    SELECT r.id, '$user_id', '$role'
    FROM realtime_rooms r
    WHERE r.name = '$room_name'
    ON CONFLICT (room_id, user_id) DO UPDATE
    SET role = '$role';
    "

    plugin_success "Member added: $user_id to $room_name (role: $role)"
}

remove_member() {
    local room_name="${2:-}"
    local user_id="${3:-}"

    if [[ -z "$room_name" ]] || [[ -z "$user_id" ]]; then
        plugin_error "Room name and user ID required"
        printf "Usage: rooms remove-member <room> <user_id>\n"
        exit 1
    fi

    plugin_db_exec "
    DELETE FROM realtime_room_members
    WHERE room_id IN (SELECT id FROM realtime_rooms WHERE name = '$room_name')
      AND user_id = '$user_id';
    "

    plugin_success "Member removed: $user_id from $room_name"
}

# =============================================================================
# Main
# =============================================================================

case "$ACTION" in
    list)
        list_rooms
        ;;
    create)
        create_room "$@"
        ;;
    delete)
        delete_room "$@"
        ;;
    info)
        room_info "$@"
        ;;
    add-member)
        add_member "$@"
        ;;
    remove-member)
        remove_member "$@"
        ;;
    *)
        printf "Usage: %s {list|create|delete|info|add-member|remove-member}\n" "$0"
        printf "\n"
        printf "Commands:\n"
        printf "  list                           List all active rooms\n"
        printf "  create <name> [type] [vis]     Create new room\n"
        printf "  delete <name>                  Delete room\n"
        printf "  info <name>                    Show room details\n"
        printf "  add-member <room> <user> [role] Add user to room\n"
        printf "  remove-member <room> <user>    Remove user from room\n"
        printf "\n"
        exit 1
        ;;
esac
