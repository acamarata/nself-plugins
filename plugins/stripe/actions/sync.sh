#!/bin/bash
# =============================================================================
# Stripe Sync Action
# Sync all Stripe data to local database
# =============================================================================

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$(dirname "$PLUGIN_DIR")/../shared"

source "${SHARED_DIR}/plugin-utils.sh"

# =============================================================================
# Configuration
# =============================================================================

STRIPE_API_KEY="${STRIPE_API_KEY:-}"
STRIPE_API_VERSION="${STRIPE_API_VERSION:-2024-12-18.acacia}"
STRIPE_API_BASE="https://api.stripe.com/v1"

# =============================================================================
# API Functions
# =============================================================================

stripe_api() {
    local endpoint="$1"
    local params="${2:-}"

    local url="${STRIPE_API_BASE}/${endpoint}"
    if [[ -n "$params" ]]; then
        url="${url}?${params}"
    fi

    curl -s \
        -H "Authorization: Bearer ${STRIPE_API_KEY}" \
        -H "Stripe-Version: ${STRIPE_API_VERSION}" \
        "$url"
}

stripe_list_all() {
    local endpoint="$1"
    local params="${2:-limit=100}"
    local callback="$3"

    local has_more="true"
    local starting_after=""
    local total=0

    while [[ "$has_more" == "true" ]]; do
        local request_params="$params"
        if [[ -n "$starting_after" ]]; then
            request_params="${request_params}&starting_after=${starting_after}"
        fi

        local response
        response=$(stripe_api "$endpoint" "$request_params")

        # Check for error
        if printf '%s' "$response" | grep -q '"error"'; then
            plugin_error "API error: $(plugin_json_get "$response" "message")"
            return 1
        fi

        # Process data
        local data
        data=$(printf '%s' "$response" | grep -o '"data":\[[^]]*\]' | sed 's/"data"://')

        if [[ -n "$data" && "$data" != "[]" ]]; then
            $callback "$data"

            # Get count
            local count
            count=$(printf '%s' "$data" | grep -o '"id"' | wc -l)
            total=$((total + count))

            # Get last ID for pagination
            starting_after=$(printf '%s' "$data" | grep -o '"id":"[^"]*"' | tail -1 | sed 's/"id":"\([^"]*\)"/\1/')
        fi

        # Check if there's more
        has_more=$(printf '%s' "$response" | grep -o '"has_more":[a-z]*' | sed 's/"has_more"://')
        [[ "$has_more" != "true" ]] && break
    done

    printf '%s' "$total"
}

# =============================================================================
# Sync Functions
# =============================================================================

sync_customers() {
    plugin_info "Syncing customers..."

    process_customers() {
        local data="$1"

        # Process each customer
        printf '%s' "$data" | tr '}' '\n' | while read -r customer; do
            [[ -z "$customer" ]] && continue

            local id email name phone description currency balance created

            id=$(plugin_json_get "$customer" "id")
            [[ -z "$id" ]] && continue

            email=$(plugin_json_get "$customer" "email")
            name=$(plugin_json_get "$customer" "name")
            phone=$(plugin_json_get "$customer" "phone")
            description=$(plugin_json_get "$customer" "description")
            currency=$(plugin_json_get "$customer" "currency")
            balance=$(printf '%s' "$customer" | grep -o '"balance":[0-9-]*' | sed 's/"balance"://' || echo "0")
            created=$(printf '%s' "$customer" | grep -o '"created":[0-9]*' | sed 's/"created"://')

            # Escape for SQL
            email=$(printf '%s' "$email" | sed "s/'/''/g")
            name=$(printf '%s' "$name" | sed "s/'/''/g")
            description=$(printf '%s' "$description" | sed "s/'/''/g")

            plugin_db_query "
                INSERT INTO stripe_customers (id, email, name, phone, description, currency, balance, created_at, synced_at)
                VALUES ('$id', $([ -n "$email" ] && echo "'$email'" || echo "NULL"), $([ -n "$name" ] && echo "'$name'" || echo "NULL"), $([ -n "$phone" ] && echo "'$phone'" || echo "NULL"), $([ -n "$description" ] && echo "'$description'" || echo "NULL"), $([ -n "$currency" ] && echo "'$currency'" || echo "NULL"), ${balance:-0}, to_timestamp(${created:-0}), NOW())
                ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, phone = EXCLUDED.phone, description = EXCLUDED.description, currency = EXCLUDED.currency, balance = EXCLUDED.balance, synced_at = NOW();
            " >/dev/null 2>&1 || true
        done
    }

    local count
    count=$(stripe_list_all "customers" "limit=100" process_customers)
    plugin_success "Synced $count customers"
}

sync_products() {
    plugin_info "Syncing products..."

    process_products() {
        local data="$1"

        printf '%s' "$data" | tr '}' '\n' | while read -r product; do
            [[ -z "$product" ]] && continue

            local id name description active created

            id=$(plugin_json_get "$product" "id")
            [[ -z "$id" ]] && continue

            name=$(plugin_json_get "$product" "name")
            description=$(plugin_json_get "$product" "description")
            active=$(printf '%s' "$product" | grep -o '"active":[a-z]*' | sed 's/"active"://' || echo "true")
            created=$(printf '%s' "$product" | grep -o '"created":[0-9]*' | sed 's/"created"://')

            name=$(printf '%s' "$name" | sed "s/'/''/g")
            description=$(printf '%s' "$description" | sed "s/'/''/g")

            plugin_db_query "
                INSERT INTO stripe_products (id, name, description, active, created_at, synced_at)
                VALUES ('$id', '$name', $([ -n "$description" ] && echo "'$description'" || echo "NULL"), $active, to_timestamp(${created:-0}), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = EXCLUDED.active, synced_at = NOW();
            " >/dev/null 2>&1 || true
        done
    }

    local count
    count=$(stripe_list_all "products" "limit=100&active=true" process_products)
    plugin_success "Synced $count products"
}

sync_prices() {
    plugin_info "Syncing prices..."

    process_prices() {
        local data="$1"

        printf '%s' "$data" | tr '}' '\n' | while read -r price; do
            [[ -z "$price" ]] && continue

            local id product_id currency unit_amount type active created

            id=$(plugin_json_get "$price" "id")
            [[ -z "$id" ]] && continue

            product_id=$(plugin_json_get "$price" "product")
            currency=$(plugin_json_get "$price" "currency")
            unit_amount=$(printf '%s' "$price" | grep -o '"unit_amount":[0-9]*' | sed 's/"unit_amount"://' || echo "0")
            type=$(plugin_json_get "$price" "type")
            active=$(printf '%s' "$price" | grep -o '"active":[a-z]*' | sed 's/"active"://' || echo "true")
            created=$(printf '%s' "$price" | grep -o '"created":[0-9]*' | sed 's/"created"://')

            plugin_db_query "
                INSERT INTO stripe_prices (id, product_id, currency, unit_amount, type, active, created_at, synced_at)
                VALUES ('$id', '$product_id', '$currency', ${unit_amount:-0}, '${type:-one_time}', $active, to_timestamp(${created:-0}), NOW())
                ON CONFLICT (id) DO UPDATE SET product_id = EXCLUDED.product_id, currency = EXCLUDED.currency, unit_amount = EXCLUDED.unit_amount, type = EXCLUDED.type, active = EXCLUDED.active, synced_at = NOW();
            " >/dev/null 2>&1 || true
        done
    }

    local count
    count=$(stripe_list_all "prices" "limit=100&active=true" process_prices)
    plugin_success "Synced $count prices"
}

sync_subscriptions() {
    plugin_info "Syncing subscriptions..."

    process_subscriptions() {
        local data="$1"

        printf '%s' "$data" | tr '}' '\n' | while read -r sub; do
            [[ -z "$sub" ]] && continue

            local id customer_id status current_period_start current_period_end cancel_at_period_end created

            id=$(plugin_json_get "$sub" "id")
            [[ -z "$id" ]] && continue

            customer_id=$(plugin_json_get "$sub" "customer")
            status=$(plugin_json_get "$sub" "status")
            current_period_start=$(printf '%s' "$sub" | grep -o '"current_period_start":[0-9]*' | sed 's/"current_period_start"://')
            current_period_end=$(printf '%s' "$sub" | grep -o '"current_period_end":[0-9]*' | sed 's/"current_period_end"://')
            cancel_at_period_end=$(printf '%s' "$sub" | grep -o '"cancel_at_period_end":[a-z]*' | sed 's/"cancel_at_period_end"://' || echo "false")
            created=$(printf '%s' "$sub" | grep -o '"created":[0-9]*' | sed 's/"created"://')

            plugin_db_query "
                INSERT INTO stripe_subscriptions (id, customer_id, status, current_period_start, current_period_end, cancel_at_period_end, items, created_at, synced_at)
                VALUES ('$id', '$customer_id', '$status', to_timestamp(${current_period_start:-0}), to_timestamp(${current_period_end:-0}), $cancel_at_period_end, '[]'::jsonb, to_timestamp(${created:-0}), NOW())
                ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, synced_at = NOW();
            " >/dev/null 2>&1 || true
        done
    }

    local count
    count=$(stripe_list_all "subscriptions" "limit=100" process_subscriptions)
    plugin_success "Synced $count subscriptions"
}

# =============================================================================
# Main
# =============================================================================

sync_all() {
    local target="${1:-all}"

    # Check API key
    if [[ -z "$STRIPE_API_KEY" ]]; then
        plugin_error "STRIPE_API_KEY is not set"
        printf "\nSet it in your .env file:\n"
        printf "  STRIPE_API_KEY=sk_live_...\n\n"
        return 1
    fi

    plugin_info "Starting Stripe data sync..."
    printf "\n"

    case "$target" in
        all)
            sync_customers
            sync_products
            sync_prices
            sync_subscriptions
            ;;
        customers)
            sync_customers
            ;;
        products)
            sync_products
            ;;
        prices)
            sync_prices
            ;;
        subscriptions)
            sync_subscriptions
            ;;
        *)
            plugin_error "Unknown sync target: $target"
            printf "\nAvailable targets: all, customers, products, prices, subscriptions\n"
            return 1
            ;;
    esac

    printf "\n"
    plugin_success "Stripe sync complete!"
}

# Show help
show_help() {
    printf "Usage: nself plugin stripe sync [target]\n\n"
    printf "Sync Stripe data to local database.\n\n"
    printf "Targets:\n"
    printf "  all           Sync all data (default)\n"
    printf "  customers     Sync customers only\n"
    printf "  products      Sync products only\n"
    printf "  prices        Sync prices only\n"
    printf "  subscriptions Sync subscriptions only\n\n"
    printf "Environment:\n"
    printf "  STRIPE_API_KEY  Your Stripe API key (required)\n"
}

# Parse arguments
case "${1:-}" in
    -h|--help|help)
        show_help
        ;;
    *)
        sync_all "${1:-all}"
        ;;
esac
