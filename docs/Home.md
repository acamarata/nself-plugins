# nself Plugins

> **Production-Ready Integrations** • Sync external services to PostgreSQL with real-time webhooks, REST APIs, and CLI tools

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/acamarata/nself-plugins/releases)
[![License](https://img.shields.io/badge/license-Source--Available-green.svg)](https://github.com/acamarata/nself-plugins/blob/main/LICENSE)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791.svg?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?logo=node.js)](https://nodejs.org/)

---

## What is nself Plugins?

**nself-plugins** is the official plugin ecosystem for the [nself CLI](https://nself.org). It provides self-contained integrations that sync data from external services (Stripe, GitHub, Shopify, etc.) directly into your local PostgreSQL database. Think of it as **ETL pipelines that run on your machine**.

### Why Use It?

**Instead of this:**
```javascript
// Slow API calls with rate limits
const customers = await stripe.customers.list({ limit: 100 });
const invoices = await stripe.invoices.list({ customer: customers[0].id });
// 2+ seconds, 2 API calls, rate limited
```

**Do this:**
```sql
-- Lightning-fast SQL queries on local data
SELECT c.*, COUNT(i.id) as invoice_count
FROM stripe_customers c
LEFT JOIN stripe_invoices i ON i.customer_id = c.id
GROUP BY c.id;
-- 10ms, no API calls, no rate limits
```

---

## ✨ Key Features

### 🚀 **Lightning Fast**
Query millions of records in milliseconds. No API rate limits. No network latency. Your data is local.

### ⚡ **Real-Time Updates**
Webhooks keep your database in sync within seconds. Never poll APIs again.

### 🔍 **SQL-Powered Analytics**
Join data across services. Build custom dashboards. Run complex analytics queries instantly.

### 🛠️ **Full CLI Integration**
Install, configure, and manage everything through the nself CLI. Zero manual setup.

### 🔒 **Enterprise Security**
HMAC signature verification, parameterized queries, type-safe operations, comprehensive audit trails.

### 📊 **Pre-Built Views**
MRR calculations, active subscriptions, failed payments, top products, and more—out of the box.

---

## 🎯 Quick Start

```bash
# 1. List available plugins
nself plugin list

# 2. Install a plugin (e.g., Stripe)
nself plugin install stripe

# 3. Configure (add credentials to .env)
echo "STRIPE_API_KEY=sk_live_xxx" >> .env
echo "STRIPE_WEBHOOK_SECRET=whsec_xxx" >> .env

# 4. Initialize database schema
nself plugin stripe init

# 5. Sync all data from Stripe
nself plugin stripe sync

# 6. Start webhook server for real-time updates
nself plugin stripe server
```

**That's it!** Your Stripe data is now syncing to PostgreSQL.

### Query Your Data

```sql
-- Find high-value customers
SELECT email, name, SUM(amount / 100.0) as total_spent
FROM stripe_customers c
JOIN stripe_payment_intents p ON p.customer_id = c.id
WHERE p.status = 'succeeded'
GROUP BY c.id, c.email, c.name
ORDER BY total_spent DESC
LIMIT 10;

-- Monthly Recurring Revenue
SELECT DATE_TRUNC('month', created_at) AS month,
       COUNT(*) AS active_subs,
       SUM(amount / 100.0) AS mrr
FROM stripe_subscriptions
WHERE status = 'active'
GROUP BY month
ORDER BY month DESC;
```

---

## 🏗️ Architecture Overview

### System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        External Services                           │
│       (Stripe, GitHub, Shopify, ID.me, +more)                     │
└───────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
        REST API Sync                       Webhooks
         (Polling)                        (Real-Time)
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │   nself Plugin        │
                    │   (TypeScript)        │
                    │                       │
                    │  • Rate Limiting      │
                    │  • Pagination         │
                    │  • Validation         │
                    │  • Type Mapping       │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    PostgreSQL         │
                    │                       │
                    │  • Tables (synced)    │
                    │  • Views (analytics)  │
                    │  • Indexes (fast)     │
                    └───────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
        REST API                              SQL Client
      (HTTP Queries)                        (Direct Access)
              │                                   │
              ▼                                   ▼
      ┌─────────────┐                   ┌─────────────┐
      │  Web Apps   │                   │  Analytics  │
      │  Mobile     │                   │  Reports    │
      │  CLI Tools  │                   │  Dashboards │
      └─────────────┘                   └─────────────┘
```

### Data Flow

1. **Initial Sync**: Plugin fetches all historical data via service API
2. **Incremental Sync**: Periodic updates fetch only changed data
3. **Webhook Updates**: Real-time events keep data current (< 1 second)
4. **Local Storage**: Everything stored in PostgreSQL with proper indexing
5. **Query Layer**: REST API + direct SQL access for maximum flexibility

### Plugin Components

Every plugin follows the same battle-tested architecture:

```
plugins/<name>/ts/src/
├── types.ts        # TypeScript interfaces for API + DB
├── config.ts       # Environment variable loading
├── client.ts       # API client with rate limiting
├── database.ts     # PostgreSQL schema + operations
├── sync.ts         # Data synchronization logic
├── webhooks.ts     # Webhook event handlers
├── server.ts       # Fastify HTTP server
├── cli.ts          # Commander CLI interface
└── index.ts        # Module exports
```

---

## 🔌 Available Plugins

### Billing & Payments

#### **Stripe** (Port 3001) • [Documentation](plugins/Stripe.md)
Complete Stripe billing integration with 21 tables and 70+ webhook events.

**What's Synced:**
- Customers, Products, Prices
- Subscriptions, Invoices, Payment Intents
- Payment Methods, Charges, Refunds
- Disputes, Balance Transactions, Payouts
- Coupons, Promotion Codes, Tax Rates

**Pre-Built Analytics:**
- Monthly Recurring Revenue (MRR)
- Active subscriptions overview
- Failed payment tracking
- Customer lifetime value

```bash
nself plugin install stripe
```

---

### E-Commerce

#### **Shopify** (Port 3003) • [Documentation](plugins/Shopify.md)
Full-featured Shopify integration with 19 tables and 25+ webhook events.

**What's Synced:**
- Products, Variants, Collections
- Customers, Orders, Order Items
- Inventory, Locations, Fulfillments
- Refunds, Transactions, Draft Orders
- Abandoned Checkouts, Discount Codes

**Pre-Built Analytics:**
- Daily sales overview
- Top products by revenue
- Low inventory alerts
- Customer lifetime value

```bash
nself plugin install shopify
```

---

### DevOps & Development

#### **GitHub** (Port 3002) • [Documentation](plugins/GitHub.md)
Comprehensive GitHub integration with 21 tables and 20+ webhook events.

**What's Synced:**
- Repositories, Issues, Pull Requests
- Commits, Releases, Branches, Tags
- Workflow Runs, Jobs, Deployments
- Check Suites, Check Runs
- Teams, Collaborators, Milestones, Labels

**Pre-Built Analytics:**
- Open items dashboard
- Recent activity feed
- Workflow success rates
- PR merge time analysis

```bash
nself plugin install github
```

---

### Authentication

#### **ID.me** (Port 3010) • [Documentation](plugins/IDme.md)
Government-grade identity verification for military, veterans, students, teachers, first responders, nurses, and government employees.

**What's Synced:**
- Verification records and statuses
- Group affiliations (7 supported groups)
- Identity badges and attributes
- OAuth tokens and sessions

**Verification Groups:**
- Military (active duty, reserves)
- Veterans
- Students (high school, college)
- Teachers
- First responders (police, fire, EMT)
- Nurses
- Government employees

```bash
nself plugin install idme
```

---

### Infrastructure Services

#### **Realtime** (Port 3101) • [Documentation](plugins/Realtime.md)
Production-ready Socket.io server with presence tracking, typing indicators, and room management.

**Features:**
- WebSocket connections with Redis scaling
- User presence tracking
- Room-based messaging
- Typing indicators
- Connection analytics

**Use Cases:**
- Chat applications
- Live dashboards
- Collaborative editing
- Real-time notifications

```bash
nself plugin install realtime
```

---

#### **Notifications** (Port 3102) • [Documentation](plugins/Notifications.md)
Multi-channel notification system with email, push, and SMS support.

**Features:**
- Email (Resend, SendGrid, Mailgun, SES, SMTP)
- Push (FCM, OneSignal, WebPush)
- SMS (Twilio, Plivo, SNS)
- Template management
- User preferences
- Delivery tracking
- Batch processing

**Use Cases:**
- Transactional emails
- Marketing campaigns
- Push notifications
- SMS alerts

```bash
nself plugin install notifications
```

---

#### **File Processing** (Port 3104) • [Documentation](plugins/FileProcessing.md)
Automated file processing with thumbnails, optimization, and virus scanning.

**Features:**
- Multi-provider storage (MinIO, S3, GCS, R2, B2, Azure)
- Image thumbnail generation
- Video processing with FFmpeg
- Image optimization
- Virus scanning
- Metadata extraction

**Use Cases:**
- User uploads
- Media galleries
- Document processing
- Asset management

```bash
nself plugin install file-processing
```

---

#### **Jobs** (Port 3105) • [Documentation](plugins/Jobs.md)
BullMQ-powered background job queue with priorities, scheduling, and monitoring.

**Features:**
- Priority queue management
- Cron-style scheduling
- Automatic retries with backoff
- BullBoard web dashboard
- Job result storage
- Failure tracking

**Use Cases:**
- Email sending
- Report generation
- Data processing
- Scheduled tasks

```bash
nself plugin install jobs
```

---

## 📚 Complete Documentation

### Getting Started
- **[Quick Start Guide](getting-started/Quick-Start.md)** - Complete beginner-friendly walkthrough (15-30 mins)
- **[Installation Guide](Installation.md)** - Step-by-step setup instructions
- **[Security Audit](Security.md)** - Production deployment best practices

### Guides
- **[Configuration Guide](guides/Configuration.md)** - Advanced configuration and environment setup
- **[Best Practices Guide](guides/Best-Practices.md)** - Code quality, performance, and maintenance
- **[Deployment Guide](guides/Deployment.md)** - Production deployment with Docker, CI/CD, monitoring

### Development
- **[Development Guide](DEVELOPMENT.md)** - Contributing and local development
- **[TypeScript Plugin Guide](TYPESCRIPT_PLUGIN_GUIDE.md)** - Build your own plugins
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute

### Plugin Documentation
- **[Stripe Plugin](plugins/Stripe.md)** - Complete Stripe integration guide
- **[GitHub Plugin](plugins/GitHub.md)** - GitHub API and webhook setup
- **[Shopify Plugin](plugins/Shopify.md)** - E-commerce data sync
- **[ID.me Plugin](plugins/IDme.md)** - Identity verification integration
- **[Realtime Plugin](plugins/Realtime.md)** - Socket.io WebSocket server
- **[Notifications Plugin](plugins/Notifications.md)** - Multi-channel messaging
- **[File Processing Plugin](plugins/FileProcessing.md)** - File uploads and processing
- **[Jobs Plugin](plugins/Jobs.md)** - Background job queue

### Roadmap
- **[Planned Plugins](PLANNED.md)** - Upcoming integrations (PayPal, Linear, Notion, Intercom, HubSpot, and 20+ more)

---

## 💡 Use Cases

### For SaaS Companies
```bash
# Track customer metrics across payment, support, and product usage
nself plugin install stripe intercom segment

# Query combined data
SELECT
    s.email,
    COUNT(DISTINCT i.id) as support_tickets,
    SUM(p.amount / 100.0) as total_revenue,
    s.created_at as customer_since
FROM stripe_customers s
LEFT JOIN intercom_conversations i ON i.email = s.email
LEFT JOIN stripe_payment_intents p ON p.customer_id = s.id
WHERE p.status = 'succeeded'
GROUP BY s.id, s.email, s.created_at;
```

### For E-Commerce
```bash
# Sync orders, inventory, and customer data
nself plugin install shopify stripe

# Analyze product performance
SELECT
    p.title,
    SUM(oi.quantity) as units_sold,
    SUM(oi.price * oi.quantity) as revenue,
    AVG(oi.price) as avg_price
FROM shopify_products p
JOIN shopify_order_items oi ON oi.product_id = p.id
JOIN shopify_orders o ON o.id = oi.order_id
WHERE o.financial_status = 'paid'
GROUP BY p.id, p.title
ORDER BY revenue DESC
LIMIT 20;
```

### For Development Teams
```bash
# Track deployments, PRs, and workflow success
nself plugin install github

# Calculate DORA metrics
SELECT
    DATE_TRUNC('week', w.created_at) as week,
    COUNT(DISTINCT w.id) as deployments,
    AVG(EXTRACT(EPOCH FROM (w.updated_at - w.created_at)) / 60) as avg_duration_min,
    SUM(CASE WHEN w.conclusion = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM github_workflow_runs w
WHERE w.name LIKE '%deploy%'
GROUP BY week
ORDER BY week DESC;
```

---

## 🔐 Security

Security is a first-class concern. All plugins implement:

- **✓ Webhook Signature Verification** - HMAC-SHA256 validation for all events
- **✓ SQL Injection Protection** - Parameterized queries throughout
- **✓ Type Safety** - Full TypeScript with strict mode
- **✓ Secure Credential Handling** - Environment-based config, no hardcoded secrets
- **✓ Rate Limiting** - Respect API limits automatically
- **✓ Audit Trails** - Complete event history in `webhook_events` tables

**Read the full security audit:** [Security Documentation](Security.md)

### Reporting Security Issues

If you discover a vulnerability:
1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainers
3. Allow 90 days for remediation before disclosure

---

## 🛠️ Plugin Commands

### Global Plugin Management

```bash
# List all available plugins
nself plugin list

# List installed plugins only
nself plugin list --installed

# Install a plugin
nself plugin install <name>

# Check for updates
nself plugin updates

# Update all plugins
nself plugin update

# Update specific plugin
nself plugin update <name>

# Remove a plugin
nself plugin remove <name>

# Remove plugin and delete all data
nself plugin remove <name> --delete-data
```

### Plugin-Specific Commands

Every plugin provides these standard commands:

```bash
# Initialize database schema
nself plugin <name> init

# Sync all data from service
nself plugin <name> sync

# Sync specific resources
nself plugin <name> sync --resources customers,invoices

# Incremental sync (only changed data)
nself plugin <name> sync --incremental

# Show sync status and statistics
nself plugin <name> status

# Start webhook server
nself plugin <name> server

# Start on custom port
nself plugin <name> server --port 3001

# Start in background
nself plugin <name> server --daemon
```

### Direct CLI Access

Plugins also install as standalone commands:

```bash
# Stripe
nself-stripe sync
nself-stripe customers list
nself-stripe subscriptions stats

# GitHub
nself-github sync
nself-github issues list --state open
nself-github prs list --repo owner/repo

# Shopify
nself-shopify sync
nself-shopify orders list --status paid
nself-shopify analytics top-products
```

---

## 🌐 REST API

Every plugin server provides a REST API for querying synced data:

### Common Endpoints

```bash
# Health check
GET /health

# Sync status
GET /api/status

# Trigger sync
POST /api/sync

# Webhook receiver
POST /webhook
```

### Resource Endpoints (Stripe Example)

```bash
# List customers
GET /api/customers

# List subscriptions
GET /api/subscriptions

# List invoices
GET /api/invoices

# Get MRR summary
GET /api/mrr

# List failed payments
GET /api/failed-payments
```

### Query Parameters

```bash
# Pagination
GET /api/customers?limit=100&offset=0

# Filtering
GET /api/subscriptions?status=active

# Sorting
GET /api/invoices?sort=created_at&order=desc

# Date ranges
GET /api/orders?from=2024-01-01&to=2024-12-31
```

---

## 📊 Environment Variables Reference

### Global (All Plugins)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `PORT` | | Server port (default varies by plugin) |
| `HOST` | | Server host (default: `0.0.0.0`) |
| `LOG_LEVEL` | | Logging level: `debug`, `info`, `warn`, `error` |

### Stripe Plugin

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_API_KEY` | ✓ | Stripe secret API key (starts with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | | Webhook signing secret (starts with `whsec_`) |

### GitHub Plugin

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✓ | Personal access token with repo access |
| `GITHUB_WEBHOOK_SECRET` | | Webhook signing secret |
| `GITHUB_ORG` | | Organization name to sync |
| `GITHUB_REPOS` | | Comma-separated list of repos |

### Shopify Plugin

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_SHOP_DOMAIN` | ✓ | Shop domain (e.g., `mystore.myshopify.com`) |
| `SHOPIFY_ACCESS_TOKEN` | ✓ | Admin API access token |
| `SHOPIFY_API_VERSION` | | API version (default: `2024-01`) |
| `SHOPIFY_WEBHOOK_SECRET` | | Webhook signing secret |

### ID.me Plugin

| Variable | Required | Description |
|----------|----------|-------------|
| `IDME_CLIENT_ID` | ✓ | OAuth client ID |
| `IDME_CLIENT_SECRET` | ✓ | OAuth client secret |
| `IDME_REDIRECT_URI` | ✓ | OAuth callback URL |
| `IDME_SCOPES` | | OAuth scopes (default: `openid,email,profile`) |
| `IDME_SANDBOX` | | Use sandbox mode (default: `false`) |
| `IDME_WEBHOOK_SECRET` | | Webhook signature secret |

### Infrastructure Plugins

See individual plugin documentation for detailed configuration:
- [Realtime Plugin](plugins/Realtime.md) - Redis, CORS, JWT settings
- [Notifications Plugin](plugins/Notifications.md) - Email, SMS, push provider configs
- [File Processing Plugin](plugins/FileProcessing.md) - Storage provider settings
- [Jobs Plugin](plugins/Jobs.md) - Redis, concurrency, retry settings

---

## 📍 Default Ports

| Plugin | Port | Protocol |
|--------|------|----------|
| Stripe | 3001 | HTTP |
| GitHub | 3002 | HTTP |
| Shopify | 3003 | HTTP |
| ID.me | 3010 | HTTP |
| Realtime | 3101 | WebSocket |
| Notifications | 3102 | HTTP |
| File Processing | 3104 | HTTP |
| Jobs | 3105 | HTTP |

**Running multiple plugins?** Use process managers like PM2:

```bash
# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'stripe',
      script: 'nself-stripe',
      args: 'server --port 3001'
    },
    {
      name: 'github',
      script: 'nself-github',
      args: 'server --port 3002'
    },
    {
      name: 'shopify',
      script: 'nself-shopify',
      args: 'server --port 3003'
    }
  ]
};

# Start all
pm2 start ecosystem.config.js
```

---

## 🚀 Performance

### Benchmarks

Query performance comparison (1M Stripe records):

| Operation | API Call | Local SQL | Speedup |
|-----------|----------|-----------|---------|
| List 100 customers | 850ms | 8ms | **106x faster** |
| Aggregate MRR | 5,200ms | 45ms | **115x faster** |
| Join customers + invoices | N/A (multiple calls) | 12ms | **∞** |
| Complex analytics | Rate limited | 120ms | **∞** |

### Sync Times

Initial sync performance (approximate):

| Plugin | Records | Time | Rate |
|--------|---------|------|------|
| Stripe | 10K | 8 min | ~20/sec |
| GitHub | 1K repos | 15 min | ~1/sec |
| Shopify | 50K products | 12 min | ~70/sec |

Incremental sync: **< 1 minute** for typical changes.

---

## 🤝 Community & Support

### Get Help

- **Documentation**: You're reading it! Check the [Plugin Guides](#plugin-documentation)
- **GitHub Issues**: [Report bugs](https://github.com/acamarata/nself-plugins/issues) or request features
- **nself CLI Issues**: [CLI-specific issues](https://github.com/acamarata/nself/issues)

### Contributing

We welcome contributions! See:
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Development Guide](DEVELOPMENT.md)** - Local development setup
- **[TypeScript Plugin Guide](TYPESCRIPT_PLUGIN_GUIDE.md)** - Build new plugins

### External Resources

- **Stripe**: [API Documentation](https://stripe.com/docs/api)
- **GitHub**: [REST API Docs](https://docs.github.com/en/rest)
- **Shopify**: [Admin API Docs](https://shopify.dev/docs/api)
- **ID.me**: [Developer Portal](https://developer.id.me/)
- **Socket.io**: [Documentation](https://socket.io/docs/)
- **BullMQ**: [Documentation](https://docs.bullmq.io/)

---

## 📋 Prerequisites

Before installing plugins:

- **nself CLI v0.4.8+** - Install: `curl -fsSL https://nself.org/install.sh | bash`
- **PostgreSQL 14+** - Running database instance
- **Node.js 18+** - For TypeScript plugins
- **Redis** (optional) - For realtime, jobs, and file-processing plugins

---

## 🗺️ Roadmap

See [PLANNED.md](PLANNED.md) for the complete roadmap including:

**Coming Soon:**
- PayPal, Square, Paddle (Payments)
- Linear, Notion, Airtable (Productivity)
- Intercom, Resend, SendGrid (Communication)
- Plaid, HubSpot, Segment (Analytics)
- Discord, Slack, Telegram (Chat)
- And 20+ more integrations

**Vote for your favorites** by opening a discussion on GitHub!

---

## 📄 License

Source-Available License. See [LICENSE](https://github.com/acamarata/nself-plugins/blob/main/LICENSE) for details.

**TL;DR:** Free to use and modify for personal/internal use. Contact us for commercial redistribution.

---

## 🎉 Start Syncing Now

```bash
# Install nself CLI
curl -fsSL https://nself.org/install.sh | bash

# View available plugins
nself plugin list

# Install your first plugin
nself plugin install stripe

# You're ready to go!
```

---

**Built with ❤️ by the nself team** • [GitHub](https://github.com/acamarata/nself-plugins) • [nself.org](https://nself.org)

*Last Updated: January 30, 2026 • Version 1.0.0 • Compatible with nself v0.4.8+*
