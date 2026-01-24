# Stripe Plugin for nself

Sync Stripe billing data to PostgreSQL with real-time webhook support.

## Features

- **Full Data Sync** - Customers, products, prices, subscriptions, invoices, payments
- **Real-time Webhooks** - 24+ webhook event handlers
- **REST API** - Query synced data via HTTP endpoints
- **CLI Tools** - Command-line interface for management
- **Analytics Views** - MRR, customer summary, recent activity

## Installation

### TypeScript Implementation

```bash
# Install shared utilities first
cd shared
npm install
npm run build
cd ..

# Install the Stripe plugin
cd plugins/stripe/ts
npm install
npm run build
```

## Configuration

Create a `.env` file in `plugins/stripe/ts/`:

```bash
# Required
STRIPE_API_KEY=sk_live_your_api_key
DATABASE_URL=postgresql://user:pass@localhost:5432/nself

# Optional (for webhooks)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server options
PORT=3001
HOST=0.0.0.0
```

### Getting Stripe Credentials

1. Go to [Stripe Dashboard > API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your Secret Key (starts with `sk_live_` or `sk_test_`)
3. For webhooks, create an endpoint and copy the signing secret

## Usage

### CLI Commands

```bash
# Initialize database schema
npx nself-stripe init

# Sync all data
npx nself-stripe sync

# Sync specific resources
npx nself-stripe sync --resources customers,subscriptions

# Start webhook server
npx nself-stripe server --port 3001

# Show sync status
npx nself-stripe status

# List data
npx nself-stripe customers --limit 50
npx nself-stripe subscriptions --status active
npx nself-stripe invoices --status paid
npx nself-stripe products
npx nself-stripe prices
```

### REST API

Start the server and access endpoints at `http://localhost:3001`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/webhook` | Stripe webhook receiver |
| POST | `/api/sync` | Trigger data sync |
| GET | `/api/status` | Get sync status |
| GET | `/api/customers` | List customers |
| GET | `/api/customers/:id` | Get customer |
| GET | `/api/subscriptions` | List subscriptions |
| GET | `/api/subscriptions/:id` | Get subscription |
| GET | `/api/invoices` | List invoices |
| GET | `/api/products` | List products |
| GET | `/api/prices` | List prices |
| GET | `/api/mrr` | Get MRR summary |
| GET | `/api/webhook-events` | List webhook events |

## Webhook Setup

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/webhook`
4. Select events to listen for (or use "All events")
5. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### Supported Webhook Events

| Event | Description |
|-------|-------------|
| `customer.created` | New customer created |
| `customer.updated` | Customer data changed |
| `customer.deleted` | Customer deleted |
| `product.created` | New product created |
| `product.updated` | Product changed |
| `product.deleted` | Product deleted |
| `price.created` | New price created |
| `price.updated` | Price changed |
| `price.deleted` | Price deleted |
| `subscription.created` | New subscription started |
| `subscription.updated` | Subscription changed |
| `subscription.deleted` | Subscription cancelled |
| `invoice.created` | New invoice generated |
| `invoice.updated` | Invoice updated |
| `invoice.paid` | Invoice paid successfully |
| `invoice.payment_failed` | Payment failed |
| `invoice.finalized` | Invoice finalized |
| `payment_intent.created` | Payment intent created |
| `payment_intent.succeeded` | Payment successful |
| `payment_intent.payment_failed` | Payment failed |
| `payment_intent.canceled` | Payment canceled |
| `payment_method.attached` | Payment method attached |
| `payment_method.detached` | Payment method detached |
| `payment_method.updated` | Payment method updated |

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `stripe_customers` | Customer profiles with metadata |
| `stripe_products` | Product catalog |
| `stripe_prices` | Product pricing (one-time and recurring) |
| `stripe_subscriptions` | Subscription details and status |
| `stripe_invoices` | Invoice history with line items |
| `stripe_payment_intents` | Payment attempts and status |
| `stripe_payment_methods` | Saved payment methods |
| `stripe_webhook_events` | Webhook event log |

### Analytics Views

```sql
-- Active subscriptions with customer info
SELECT * FROM stripe_active_subscriptions;

-- Monthly recurring revenue
SELECT * FROM stripe_mrr;

-- Recent failed payments
SELECT * FROM stripe_failed_payments;
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_API_KEY` | Yes | - | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | No | - | Webhook signing secret |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3001 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |

## Architecture

```
plugins/stripe/ts/
├── src/
│   ├── types.ts        # Stripe-specific type definitions
│   ├── client.ts       # Stripe API client wrapper
│   ├── database.ts     # Database operations
│   ├── sync.ts         # Full sync service
│   ├── webhooks.ts     # Webhook event handlers
│   ├── config.ts       # Configuration loading
│   ├── server.ts       # Fastify HTTP server
│   ├── cli.ts          # Commander.js CLI
│   └── index.ts        # Module exports
├── package.json
└── tsconfig.json
```

## Development

```bash
# Watch mode
npm run watch

# Type checking
npm run typecheck

# Development server
npm run dev
```

## Support

- [GitHub Issues](https://github.com/acamarata/nself-plugins/issues)
- [Stripe API Documentation](https://stripe.com/docs/api)
