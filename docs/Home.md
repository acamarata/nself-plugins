# nself Plugins

Welcome to the official nself plugins documentation. This wiki provides comprehensive guides for installing, configuring, and developing plugins that extend the nself CLI.

## Table of Contents

- [Quick Start](#quick-start)
- [What are nself Plugins?](#what-are-nself-plugins)
- [Why Use Plugins?](#why-use-plugins)
- [Available Plugins](#available-plugins)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Plugin Commands](#plugin-commands)
- [Security](#security)
- [Support](#support)

---

## Quick Start

```bash
# List available plugins
nself plugin list

# Install a plugin
nself plugin install stripe

# Configure (add required environment variables to .env)
echo "STRIPE_API_KEY=sk_live_xxx" >> .env

# Initialize database schema
nself plugin stripe init

# Sync data from the service
nself plugin stripe sync

# Start webhook server
nself plugin stripe server
```

---

## What are nself Plugins?

nself plugins are self-contained integrations that connect external services (like Stripe, GitHub, Shopify) to your local PostgreSQL database. Each plugin provides:

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Data Synchronization** | Full and incremental sync of all service data to PostgreSQL |
| **Webhook Handling** | Real-time event processing with signature verification |
| **REST API** | Query synced data through a local HTTP API |
| **CLI Commands** | Interact with synced data from the command line |
| **Analytics Views** | Pre-built SQL views for common queries |

### Plugin Components

Every plugin includes:

```
plugins/<name>/
├── plugin.json         # Plugin metadata and configuration
├── ts/                 # TypeScript implementation
│   ├── src/
│   │   ├── types.ts      # Type definitions
│   │   ├── client.ts     # API client with rate limiting
│   │   ├── database.ts   # PostgreSQL operations
│   │   ├── sync.ts       # Data synchronization logic
│   │   ├── webhooks.ts   # Webhook event handlers
│   │   ├── server.ts     # Fastify HTTP server
│   │   └── cli.ts        # CLI interface
│   ├── package.json
│   └── tsconfig.json
└── README.md           # Plugin documentation
```

---

## Why Use Plugins?

### 1. Local Data Access

Instead of making API calls for every request, plugins sync data to your local PostgreSQL database:

- **Faster queries** - SQL queries on local data are orders of magnitude faster than API calls
- **No rate limits** - Query millions of records without hitting service rate limits
- **Works offline** - Your data is always available, even without internet
- **Join across services** - Combine data from multiple services in a single SQL query

### 2. Real-Time Updates

Webhooks keep your local data synchronized with external services:

- **Instant updates** - Data changes are reflected within seconds
- **Event history** - Complete audit trail of all webhook events
- **Reliable processing** - Automatic retries for failed events
- **Signature verification** - Secure webhook handling

### 3. Custom Analytics

Build powerful analytics with SQL:

```sql
-- Example: Monthly recurring revenue from Stripe
SELECT
    DATE_TRUNC('month', created_at) AS month,
    SUM(amount / 100.0) AS mrr
FROM stripe_subscriptions
WHERE status = 'active'
GROUP BY month
ORDER BY month DESC;
```

### 4. CLI Integration

Manage everything through the nself CLI:

```bash
# Stripe examples
nself plugin stripe sync
nself plugin stripe customers list
nself plugin stripe subscriptions stats

# GitHub examples
nself plugin github sync
nself plugin github issues list --state open
nself plugin github prs list --repo owner/repo

# Shopify examples
nself plugin shopify sync
nself plugin shopify orders list --status paid
nself plugin shopify analytics top-products
```

---

## Available Plugins

### Released Plugins (v1.0.0)

| Plugin | Category | Description | Docs |
|--------|----------|-------------|------|
| **Stripe** | Billing | Payment processing, subscriptions, invoices | [Guide](plugins/Stripe.md) |
| **GitHub** | DevOps | Repositories, issues, PRs, workflows | [Guide](plugins/GitHub.md) |
| **Shopify** | E-Commerce | Products, orders, customers, inventory | [Guide](plugins/Shopify.md) |
| **ID.me** | Authentication | ID.me OAuth authentication | [Guide](plugins/IDme.md) |
| **Realtime** | Infrastructure | Socket.io real-time server | [Guide](plugins/Realtime.md) |
| **Notifications** | Infrastructure | Multi-channel notifications | [Guide](plugins/Notifications.md) |
| **File Processing** | Infrastructure | File processing with thumbnails | [Guide](plugins/FileProcessing.md) |
| **Jobs** | Infrastructure | BullMQ background job queue | [Guide](plugins/Jobs.md) |

### Data Sync Coverage

#### Stripe Plugin
- Customers, Products, Prices
- Subscriptions, Invoices, Payment Intents
- Payment Methods, Charges, Refunds
- Disputes, Balance Transactions, Payouts
- Coupons, Promotion Codes, Tax Rates
- 70+ webhook events

#### GitHub Plugin
- Repositories, Issues, Pull Requests
- Commits, Releases, Branches, Tags
- Workflow Runs, Jobs, Deployments
- Check Suites, Check Runs
- Teams, Collaborators, Milestones, Labels
- 20+ webhook events

#### Shopify Plugin
- Products, Variants, Collections
- Customers, Orders, Order Items
- Inventory, Locations, Fulfillments
- Refunds, Transactions, Draft Orders
- Abandoned Checkouts, Discount Codes
- 25+ webhook events

### Planned Plugins

See [Planned Plugins](PLANNED.md) for the complete roadmap including:
- PayPal, Square, Paddle (Payments)
- Linear, Notion, Airtable (Productivity)
- Intercom, Resend, SendGrid (Communication)
- Plaid, HubSpot, Segment (Analytics)

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Service                          │
│                    (Stripe, GitHub, Shopify)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
    ┌───────────────┐                   ┌───────────────┐
    │   REST API    │                   │   Webhooks    │
    │   (Polling)   │                   │  (Real-time)  │
    └───────────────┘                   └───────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Plugin Server  │
                    │  (TypeScript)   │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │    Database     │
                    └─────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
    ┌───────────────┐                   ┌───────────────┐
    │   REST API    │                   │    SQL        │
    │   (Query)     │                   │   Queries     │
    └───────────────┘                   └───────────────┘
```

### Sync Process

1. **Initial Sync**: Plugin fetches all historical data from service API
2. **Incremental Sync**: Periodic updates fetch only changed data
3. **Real-time Updates**: Webhooks provide instant updates for events
4. **Data Storage**: All data stored in PostgreSQL with proper indexing

### Webhook Processing

1. **Receive**: Webhook received at plugin endpoint
2. **Verify**: Signature verified using service-specific HMAC
3. **Store**: Raw event stored in webhook_events table
4. **Process**: Event handler updates related data
5. **Confirm**: Event marked as processed

---

## Getting Started

### Prerequisites

- **nself v0.4.8+** - Install via `curl -fsSL https://nself.org/install.sh | bash`
- **PostgreSQL 14+** - Running database instance
- **Node.js 20+** - For TypeScript plugins

### Installation Steps

1. **Install a plugin**:
   ```bash
   nself plugin install stripe
   ```

2. **Configure environment variables**:
   ```bash
   # Add to your .env file
   DATABASE_URL=postgresql://user:pass@localhost:5432/nself
   STRIPE_API_KEY=sk_live_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

3. **Initialize the database**:
   ```bash
   nself plugin stripe init
   ```

4. **Run initial sync**:
   ```bash
   nself plugin stripe sync
   ```

5. **Start webhook server** (optional):
   ```bash
   nself plugin stripe server --port 3001
   ```

### Multiple Plugins

Run multiple plugins simultaneously:

```bash
# Start all plugin servers
nself plugin stripe server --port 3001 &
nself plugin github server --port 3002 &
nself plugin shopify server --port 3003 &

# Or use process manager
pm2 start ecosystem.config.js
```

---

## Plugin Commands

### Global Commands

```bash
# List available plugins
nself plugin list

# List installed plugins
nself plugin list --installed

# Check for updates
nself plugin updates

# Update all plugins
nself plugin update

# Remove a plugin
nself plugin remove <name>

# Remove plugin and delete data
nself plugin remove <name> --delete-data
```

### Plugin-Specific Commands

Each plugin provides standard commands:

```bash
# Initialize database schema
nself plugin <name> init

# Sync all data
nself plugin <name> sync

# Sync specific resources
nself plugin <name> sync --resources customers,orders

# Incremental sync
nself plugin <name> sync --incremental

# Show sync status
nself plugin <name> status

# Start HTTP server
nself plugin <name> server

# Start on custom port
nself plugin <name> server --port 3001
```

### Direct CLI Access

Plugins also install as standalone CLI tools:

```bash
# Use directly (if npm linked)
nself-stripe sync
nself-github status
nself-shopify orders list
```

---

## Security

nself plugins are designed with security in mind. All plugins implement:

- **Webhook Signature Verification**: HMAC-SHA256 validation for all incoming webhooks
- **Parameterized SQL Queries**: Protection against SQL injection attacks
- **Type-Safe Operations**: Full TypeScript implementation with strict typing
- **Secure Credential Handling**: Environment-based configuration, no hardcoded secrets

### Security Documentation

For detailed security information, including deployment best practices and our security audit:

- **[Security Audit Report](Security.md)** - Comprehensive security assessment with findings and recommendations
- **[Deployment Security](Security.md#deployment-security)** - Production deployment guidelines
- **[Security Checklist](Security.md#security-checklist)** - Pre-deployment and operational checklists

### Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainers directly
3. Allow 90 days for remediation before public disclosure

---

## Support

### Documentation

- [Installation Guide](Installation.md) - Detailed installation instructions
- [Plugin Development](DEVELOPMENT.md) - Create your own plugins
- [TypeScript Guide](TYPESCRIPT_PLUGIN_GUIDE.md) - TypeScript plugin development
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Security Audit](Security.md) - Security assessment and best practices

### Getting Help

- **GitHub Issues**: [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)
- **nself CLI Issues**: [nself/issues](https://github.com/acamarata/nself/issues)

### Plugin-Specific Documentation

- **Stripe**: [API Docs](https://stripe.com/docs/api) | [Plugin Guide](plugins/Stripe.md)
- **GitHub**: [API Docs](https://docs.github.com/en/rest) | [Plugin Guide](plugins/GitHub.md)
- **Shopify**: [API Docs](https://shopify.dev/docs/api) | [Plugin Guide](plugins/Shopify.md)

---

## Quick Reference

### Environment Variables

| Variable | Plugin | Description |
|----------|--------|-------------|
| `DATABASE_URL` | All | PostgreSQL connection string |
| `STRIPE_API_KEY` | Stripe | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signing secret |
| `GITHUB_TOKEN` | GitHub | Personal access token |
| `GITHUB_WEBHOOK_SECRET` | GitHub | Webhook signing secret |
| `SHOPIFY_SHOP_DOMAIN` | Shopify | Store domain |
| `SHOPIFY_ACCESS_TOKEN` | Shopify | Admin API token |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify | Webhook signing secret |

### Default Ports

| Plugin | Port |
|--------|------|
| Stripe | 3001 |
| GitHub | 3002 |
| Shopify | 3003 |
| ID.me | 3010 |
| Realtime | 3101 |
| Notifications | 3102 |
| File Processing | 3104 |
| Jobs | 3105 |

### Webhook Endpoints

| Plugin | Endpoint |
|--------|----------|
| Stripe | `POST /webhook` |
| GitHub | `POST /webhook` |
| Shopify | `POST /webhook` |

---

*Last Updated: January 24, 2026*
*For nself v0.4.8+*
