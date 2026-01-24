# Shopify Plugin for nself

Complete Shopify e-commerce integration that syncs your store's products, orders, customers, inventory, and more to your local PostgreSQL database with real-time webhook support for instant updates.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [REST API](#rest-api)
- [Webhooks](#webhooks)
- [Database Schema](#database-schema)
- [Analytics Views](#analytics-views)
- [Use Cases](#use-cases)
- [TypeScript Implementation](#typescript-implementation)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Shopify plugin provides complete synchronization between your Shopify store and a local PostgreSQL database. It captures all aspects of your e-commerce operations including products, variants, collections, customers, orders, inventory, fulfillments, refunds, and more.

### Why Sync Shopify Data Locally?

1. **Faster Analytics** - Run complex SQL queries on your entire store history without API latency
2. **No API Rate Limits** - Query millions of orders without hitting Shopify's rate limits
3. **Cross-Platform Integration** - Join Shopify data with data from other services
4. **Custom Reporting** - Build custom dashboards and reports with SQL
5. **Headless Commerce** - Power headless frontends with your synced product catalog
6. **Real-Time Updates** - Webhooks keep your local data current as orders flow in
7. **Historical Analysis** - Track trends and patterns over your complete order history
8. **Backup & Recovery** - Your data is always accessible, even if Shopify is down

---

## Features

### Data Synchronization

| Resource | Synced Data | Incremental Sync |
|----------|-------------|------------------|
| Shop | Store metadata and settings | Yes |
| Products | Full catalog with images, metafields | Yes |
| Variants | SKU, price, inventory, weight | Yes |
| Collections | Smart and custom collections | Yes |
| Customers | Profiles, addresses, tags | Yes |
| Orders | Complete order history with line items | Yes |
| Order Items | Individual line items per order | Yes |
| Fulfillments | Shipment tracking data | Yes |
| Refunds | Refund transactions and adjustments | Yes |
| Transactions | Payment transactions | Yes |
| Inventory | Stock levels per location | Yes |
| Locations | Store locations/warehouses | Yes |
| Draft Orders | Unpaid draft orders | Yes |
| Abandoned Checkouts | Incomplete checkouts | Yes |
| Price Rules | Discount rules | Yes |
| Discount Codes | Generated discount codes | Yes |
| Gift Cards | Gift card balances | Yes |
| Metafields | Shop and resource metafields | Yes |

### Real-Time Webhooks

Supported webhook events for instant updates:

- `orders/create` - New order placed
- `orders/updated` - Order modified
- `orders/paid` - Payment received
- `orders/fulfilled` - Order shipped
- `orders/cancelled` - Order cancelled
- `orders/delete` - Order deleted
- `products/create` - New product created
- `products/update` - Product modified
- `products/delete` - Product deleted
- `customers/create` - New customer registered
- `customers/update` - Customer info changed
- `customers/delete` - Customer deleted
- `inventory_levels/update` - Stock level changed
- `inventory_levels/connect` - Inventory connected to location
- `inventory_levels/disconnect` - Inventory disconnected
- `fulfillments/create` - Shipment created
- `fulfillments/update` - Shipment updated
- `refunds/create` - Refund issued
- `collections/create` - Collection created
- `collections/update` - Collection modified
- `collections/delete` - Collection deleted
- `shop/update` - Store settings changed
- `draft_orders/create` - Draft order created
- `draft_orders/update` - Draft order modified
- `draft_orders/delete` - Draft order deleted
- `order_transactions/create` - Transaction recorded
- `checkouts/create` - Checkout started
- `checkouts/update` - Checkout modified
- `checkouts/delete` - Checkout completed/abandoned
- `themes/create`, `themes/update`, `themes/delete`, `themes/publish`
- `app/uninstalled` - App removed from store

---

## Installation

### Via nself CLI

```bash
# Install the plugin
nself plugin install shopify

# Verify installation
nself plugin status shopify
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/acamarata/nself-plugins.git
cd nself-plugins/plugins/shopify/ts

# Install dependencies
npm install

# Build
npm run build

# Link for CLI access
npm link
```

---

## Configuration

### Environment Variables

Create a `.env` file in the plugin directory or add to your project's `.env`:

```bash
# Required - Your Shopify store domain
# Format: your-store.myshopify.com (NOT the custom domain)
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com

# Required - Admin API access token
# Generate via: Settings > Apps > Develop apps > Create an app
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required - PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/nself

# Optional - API version (default: 2024-01)
SHOPIFY_API_VERSION=2024-01

# Optional - Webhook signing secret
# Get from: Settings > Notifications > Webhooks
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Optional - Server configuration
PORT=3003
HOST=0.0.0.0

# Optional - Sync interval in seconds (default: 3600)
SHOPIFY_SYNC_INTERVAL=3600
```

### Creating a Shopify App for API Access

1. Go to your Shopify Admin
2. Navigate to **Settings** > **Apps and sales channels**
3. Click **Develop apps** > **Create an app**
4. Name your app (e.g., "nself Sync")
5. Configure **Admin API access scopes**:

| Scope | Purpose |
|-------|---------|
| `read_products` | Product and variant data |
| `read_product_listings` | Published products |
| `read_inventory` | Inventory levels |
| `read_locations` | Store locations |
| `read_customers` | Customer data |
| `read_orders` | Order history |
| `read_all_orders` | Older orders beyond 60 days |
| `read_draft_orders` | Draft orders |
| `read_checkouts` | Abandoned checkouts |
| `read_fulfillments` | Shipment data |
| `read_price_rules` | Discount rules |
| `read_discounts` | Discount codes |
| `read_gift_cards` | Gift card data |
| `read_metafields` | Metafield data |

6. Install the app
7. Generate and copy the **Admin API access token**

---

## Usage

### Initialize Database Schema

```bash
# Create all required tables
nself-shopify init

# Or via nself CLI
nself plugin shopify init
```

### Sync Data

```bash
# Sync all data from Shopify
nself-shopify sync

# Sync specific resources
nself-shopify sync --resources products,orders,customers

# Incremental sync (only changes since last sync)
nself-shopify sync --incremental

# Sync orders from a specific date
nself-shopify sync --resources orders --since 2024-01-01
```

### Start Webhook Server

```bash
# Start the server
nself-shopify server

# Custom port
nself-shopify server --port 3003

# The server exposes:
# - POST /webhook - Shopify webhook endpoint
# - GET /health - Health check
# - GET /api/* - REST API endpoints
```

---

## CLI Commands

### Product Commands

```bash
# List all products
nself-shopify products list

# List with variants
nself-shopify products list --variants

# Search products
nself-shopify products search "t-shirt"

# Get product details
nself-shopify products get <product_id>

# List product variants
nself-shopify products variants <product_id>

# Low stock products
nself-shopify products low-stock --threshold 10
```

### Order Commands

```bash
# List recent orders
nself-shopify orders list

# Filter by status
nself-shopify orders list --status paid
nself-shopify orders list --status fulfilled
nself-shopify orders list --status unfulfilled

# Filter by date range
nself-shopify orders list --since 2024-01-01 --until 2024-12-31

# Get order details
nself-shopify orders get <order_id>

# View order line items
nself-shopify orders items <order_id>

# Daily sales summary
nself-shopify orders daily

# Export orders
nself-shopify orders export --format csv --output orders.csv
```

### Customer Commands

```bash
# List customers
nself-shopify customers list

# Search customers
nself-shopify customers search "john@example.com"

# Get customer details
nself-shopify customers get <customer_id>

# Customer order history
nself-shopify customers orders <customer_id>

# Top customers by spend
nself-shopify customers top --limit 20
```

### Collection Commands

```bash
# List all collections
nself-shopify collections list

# List products in a collection
nself-shopify collections products <collection_id>
```

### Inventory Commands

```bash
# List inventory levels
nself-shopify inventory list

# Filter by location
nself-shopify inventory list --location <location_id>

# Low stock alerts
nself-shopify inventory low-stock --threshold 5

# Inventory by product
nself-shopify inventory product <product_id>
```

### Analytics Commands

```bash
# Daily sales summary
nself-shopify analytics daily-sales

# Top products by revenue
nself-shopify analytics top-products --limit 10

# Customer lifetime value
nself-shopify analytics customer-value --limit 20

# Monthly revenue
nself-shopify analytics monthly

# Fulfillment metrics
nself-shopify analytics fulfillment
```

### Webhook Commands

```bash
# List recent webhook events
nself-shopify webhooks list

# Filter by topic
nself-shopify webhooks list --topic orders/create

# Retry failed events
nself-shopify webhooks retry <event_id>
```

### Status Command

```bash
# Show sync status and statistics
nself-shopify status

# Output:
# Shop: your-store.myshopify.com
# Products: 1,234 (5,678 variants)
# Customers: 45,678
# Orders: 123,456
# Total Revenue: $2,345,678.90
# Inventory Items: 7,890
# Last Sync: 2026-01-24 12:00:00
```

---

## REST API

The plugin exposes a REST API when running in server mode.

### Endpoints

#### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "shop": "your-store.myshopify.com"
}
```

#### Sync Trigger

```http
POST /api/sync
Content-Type: application/json

{
  "resources": ["products", "orders", "customers"],
  "incremental": true
}
```

Response:
```json
{
  "results": [
    { "resource": "products", "synced": 1234, "duration": 5678 },
    { "resource": "orders", "synced": 456, "duration": 12345 },
    { "resource": "customers", "synced": 789, "duration": 3456 }
  ]
}
```

#### Sync Status

```http
GET /api/status
```

Response:
```json
{
  "shop": "your-store.myshopify.com",
  "stats": {
    "products": 1234,
    "variants": 5678,
    "customers": 45678,
    "orders": 123456,
    "collections": 45,
    "inventory_items": 7890
  },
  "last_sync": "2026-01-24T12:00:00Z"
}
```

#### Shop Information

```http
GET /api/shop
```

Response:
```json
{
  "id": 12345678,
  "name": "My Store",
  "domain": "my-store.myshopify.com",
  "email": "store@example.com",
  "currency": "USD",
  "timezone": "America/New_York",
  "plan_name": "Shopify Plus"
}
```

#### Products

```http
GET /api/products
GET /api/products?limit=50&offset=0
GET /api/products?collection_id=123
GET /api/products?status=active
GET /api/products/:id
GET /api/products/:id/variants
GET /api/products/:id/inventory
```

#### Customers

```http
GET /api/customers
GET /api/customers?limit=50&offset=0
GET /api/customers?email=john@example.com
GET /api/customers/:id
GET /api/customers/:id/orders
```

#### Orders

```http
GET /api/orders
GET /api/orders?limit=50&offset=0
GET /api/orders?status=paid
GET /api/orders?since=2024-01-01
GET /api/orders?customer_id=123
GET /api/orders/:id
GET /api/orders/:id/items
GET /api/orders/:id/fulfillments
GET /api/orders/:id/refunds
```

#### Collections

```http
GET /api/collections
GET /api/collections/:id
GET /api/collections/:id/products
```

#### Inventory

```http
GET /api/inventory
GET /api/inventory?location_id=123
GET /api/inventory?product_id=456
GET /api/inventory/low-stock?threshold=10
```

#### Locations

```http
GET /api/locations
GET /api/locations/:id
GET /api/locations/:id/inventory
```

#### Analytics

```http
GET /api/analytics/daily-sales
GET /api/analytics/daily-sales?start=2024-01-01&end=2024-12-31
GET /api/analytics/top-products?limit=10
GET /api/analytics/customer-value?limit=20
GET /api/analytics/monthly-revenue
```

---

## Webhooks

### Webhook Setup

1. Go to your Shopify Admin
2. Navigate to **Settings** > **Notifications** > **Webhooks**
3. Click **Create webhook**
4. Configure:
   - **Event**: Select the event type
   - **Format**: JSON
   - **URL**: `https://your-domain.com/webhook`
5. Copy the webhook signing secret to `SHOPIFY_WEBHOOK_SECRET`

Alternatively, register webhooks programmatically through the Shopify API.

### Webhook Endpoint

```http
POST /webhook
X-Shopify-Topic: orders/create
X-Shopify-Hmac-Sha256: base64_signature
X-Shopify-Shop-Domain: your-store.myshopify.com
X-Shopify-Webhook-Id: uuid

{
  "id": 12345,
  ...
}
```

### Signature Verification

The plugin verifies all incoming webhooks using HMAC-SHA256 with Base64 encoding:

```typescript
import crypto from 'crypto';

function verifyShopifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Event Handling

Each webhook event is:
1. Verified for signature
2. Stored in `shopify_webhook_events` table
3. Processed by appropriate handler
4. Used to update synced data in real-time

---

## Database Schema

### Tables

#### shopify_shops

```sql
CREATE TABLE shopify_shops (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    domain VARCHAR(255) NOT NULL,
    myshopify_domain VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address1 VARCHAR(255),
    address2 VARCHAR(255),
    city VARCHAR(255),
    province VARCHAR(255),
    province_code VARCHAR(10),
    country VARCHAR(100),
    country_code VARCHAR(10),
    zip VARCHAR(20),
    currency VARCHAR(10) DEFAULT 'USD',
    money_format VARCHAR(100),
    timezone VARCHAR(100),
    plan_name VARCHAR(100),
    plan_display_name VARCHAR(100),
    shop_owner VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_products

```sql
CREATE TABLE shopify_products (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body_html TEXT,
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    handle VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    template_suffix VARCHAR(255),
    published_scope VARCHAR(100),
    tags TEXT,
    image JSONB,
    images JSONB DEFAULT '[]',
    options JSONB DEFAULT '[]',
    metafields JSONB DEFAULT '[]',
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_variants

```sql
CREATE TABLE shopify_variants (
    id BIGINT PRIMARY KEY,
    product_id BIGINT REFERENCES shopify_products(id) ON DELETE CASCADE,
    title VARCHAR(255),
    sku VARCHAR(255),
    barcode VARCHAR(255),
    price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    position INTEGER DEFAULT 1,
    option1 VARCHAR(255),
    option2 VARCHAR(255),
    option3 VARCHAR(255),
    taxable BOOLEAN DEFAULT TRUE,
    tax_code VARCHAR(100),
    weight DECIMAL(10, 4),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    inventory_item_id BIGINT,
    inventory_quantity INTEGER DEFAULT 0,
    inventory_policy VARCHAR(50) DEFAULT 'deny',
    inventory_management VARCHAR(100),
    fulfillment_service VARCHAR(100) DEFAULT 'manual',
    requires_shipping BOOLEAN DEFAULT TRUE,
    image_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_customers

```sql
CREATE TABLE shopify_customers (
    id BIGINT PRIMARY KEY,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    accepts_marketing BOOLEAN DEFAULT FALSE,
    accepts_marketing_updated_at TIMESTAMP WITH TIME ZONE,
    marketing_opt_in_level VARCHAR(100),
    orders_count INTEGER DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0,
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exemptions JSONB DEFAULT '[]',
    tags TEXT,
    note TEXT,
    state VARCHAR(100) DEFAULT 'enabled',
    verified_email BOOLEAN DEFAULT FALSE,
    currency VARCHAR(10),
    default_address JSONB,
    addresses JSONB DEFAULT '[]',
    metafields JSONB DEFAULT '[]',
    last_order_id BIGINT,
    last_order_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_orders

```sql
CREATE TABLE shopify_orders (
    id BIGINT PRIMARY KEY,
    order_number INTEGER,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    customer_id BIGINT REFERENCES shopify_customers(id) ON DELETE SET NULL,
    financial_status VARCHAR(100),
    fulfillment_status VARCHAR(100),
    cancel_reason VARCHAR(100),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    confirmed BOOLEAN DEFAULT TRUE,
    test BOOLEAN DEFAULT FALSE,
    currency VARCHAR(10) DEFAULT 'USD',
    subtotal_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2),
    total_tax DECIMAL(12, 2),
    total_discounts DECIMAL(12, 2),
    total_shipping DECIMAL(12, 2),
    total_weight INTEGER,
    taxes_included BOOLEAN DEFAULT FALSE,
    tax_lines JSONB DEFAULT '[]',
    discount_codes JSONB DEFAULT '[]',
    discount_applications JSONB DEFAULT '[]',
    note TEXT,
    note_attributes JSONB DEFAULT '[]',
    tags TEXT,
    gateway VARCHAR(100),
    payment_gateway_names JSONB DEFAULT '[]',
    processing_method VARCHAR(100),
    source_name VARCHAR(100),
    source_identifier VARCHAR(255),
    source_url VARCHAR(2048),
    landing_site VARCHAR(2048),
    referring_site VARCHAR(2048),
    browser_ip VARCHAR(50),
    buyer_accepts_marketing BOOLEAN DEFAULT FALSE,
    billing_address JSONB,
    shipping_address JSONB,
    shipping_lines JSONB DEFAULT '[]',
    fulfillments JSONB DEFAULT '[]',
    refunds JSONB DEFAULT '[]',
    checkout_token VARCHAR(255),
    cart_token VARCHAR(255),
    token VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_order_items

```sql
CREATE TABLE shopify_order_items (
    id BIGINT PRIMARY KEY,
    order_id BIGINT REFERENCES shopify_orders(id) ON DELETE CASCADE,
    product_id BIGINT,
    variant_id BIGINT,
    title VARCHAR(255),
    variant_title VARCHAR(255),
    sku VARCHAR(255),
    vendor VARCHAR(255),
    name VARCHAR(511),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2),
    total_discount DECIMAL(10, 2) DEFAULT 0,
    fulfillment_status VARCHAR(100),
    fulfillable_quantity INTEGER DEFAULT 0,
    fulfillment_service VARCHAR(100),
    grams INTEGER DEFAULT 0,
    requires_shipping BOOLEAN DEFAULT TRUE,
    taxable BOOLEAN DEFAULT TRUE,
    gift_card BOOLEAN DEFAULT FALSE,
    properties JSONB DEFAULT '[]',
    tax_lines JSONB DEFAULT '[]',
    discount_allocations JSONB DEFAULT '[]',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### shopify_inventory

```sql
CREATE TABLE shopify_inventory (
    inventory_item_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    available INTEGER DEFAULT 0,
    on_hand INTEGER DEFAULT 0,
    incoming INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    committed INTEGER DEFAULT 0,
    damaged INTEGER DEFAULT 0,
    quality_control INTEGER DEFAULT 0,
    safety_stock INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (inventory_item_id, location_id)
);
```

#### shopify_webhook_events

```sql
CREATE TABLE shopify_webhook_events (
    id VARCHAR(255) PRIMARY KEY,
    topic VARCHAR(100) NOT NULL,
    shop_id BIGINT,
    shop_domain VARCHAR(255),
    data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Additional Tables

- `shopify_collections` - Product collections
- `shopify_locations` - Store locations/warehouses
- `shopify_fulfillments` - Fulfillment/shipment records
- `shopify_refunds` - Refund transactions
- `shopify_transactions` - Payment transactions
- `shopify_draft_orders` - Draft orders
- `shopify_checkouts` - Abandoned checkouts
- `shopify_price_rules` - Discount rules
- `shopify_discount_codes` - Discount codes
- `shopify_gift_cards` - Gift card records
- `shopify_metafields` - Resource metafields

---

## Analytics Views

Pre-built SQL views for common e-commerce analytics:

### shopify_sales_overview

```sql
CREATE VIEW shopify_sales_overview AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS order_count,
    SUM(total_price) AS revenue,
    AVG(total_price) AS avg_order_value,
    SUM(total_discounts) AS total_discounts,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM shopify_orders
WHERE financial_status = 'paid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### shopify_top_products

```sql
CREATE VIEW shopify_top_products AS
SELECT
    p.id,
    p.title,
    p.vendor,
    p.product_type,
    COUNT(DISTINCT oi.order_id) AS order_count,
    SUM(oi.quantity) AS units_sold,
    SUM(oi.quantity * oi.price) AS revenue
FROM shopify_products p
JOIN shopify_order_items oi ON oi.product_id = p.id
JOIN shopify_orders o ON oi.order_id = o.id
WHERE o.financial_status = 'paid'
GROUP BY p.id, p.title, p.vendor, p.product_type
ORDER BY revenue DESC;
```

### shopify_low_inventory

```sql
CREATE VIEW shopify_low_inventory AS
SELECT
    p.id AS product_id,
    p.title AS product_title,
    v.id AS variant_id,
    v.title AS variant_title,
    v.sku,
    i.available,
    i.on_hand,
    l.name AS location
FROM shopify_inventory i
JOIN shopify_variants v ON v.inventory_item_id = i.inventory_item_id
JOIN shopify_products p ON v.product_id = p.id
JOIN shopify_locations l ON i.location_id = l.id
WHERE i.available < 10
ORDER BY i.available ASC;
```

### shopify_customer_value

```sql
CREATE VIEW shopify_customer_value AS
SELECT
    c.id,
    c.email,
    c.first_name,
    c.last_name,
    c.orders_count,
    c.total_spent,
    CASE
        WHEN c.total_spent >= 1000 THEN 'VIP'
        WHEN c.total_spent >= 500 THEN 'Premium'
        WHEN c.total_spent >= 100 THEN 'Regular'
        ELSE 'New'
    END AS customer_tier,
    c.created_at AS customer_since
FROM shopify_customers c
ORDER BY c.total_spent DESC;
```

### shopify_monthly_revenue

```sql
CREATE VIEW shopify_monthly_revenue AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS order_count,
    SUM(total_price) AS revenue,
    AVG(total_price) AS avg_order_value,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM shopify_orders
WHERE financial_status = 'paid'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

---

## Use Cases

### 1. Real-Time Inventory Management

Keep inventory in sync across systems:

```sql
-- Current inventory levels by product
SELECT
    p.title,
    v.sku,
    SUM(i.available) AS total_available,
    SUM(i.on_hand) AS total_on_hand
FROM shopify_inventory i
JOIN shopify_variants v ON v.inventory_item_id = i.inventory_item_id
JOIN shopify_products p ON v.product_id = p.id
GROUP BY p.title, v.sku
ORDER BY total_available ASC;
```

### 2. Customer Segmentation

Identify high-value customers:

```sql
-- Top 100 customers by lifetime value
SELECT
    email,
    first_name,
    last_name,
    orders_count,
    total_spent,
    created_at AS customer_since
FROM shopify_customers
WHERE orders_count > 0
ORDER BY total_spent DESC
LIMIT 100;
```

### 3. Sales Analytics

Track performance over time:

```sql
-- Daily sales for the last 30 days
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS orders,
    SUM(total_price) AS revenue
FROM shopify_orders
WHERE financial_status = 'paid'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 4. Product Performance

Analyze what's selling:

```sql
-- Best sellers this month
SELECT
    p.title,
    p.vendor,
    SUM(oi.quantity) AS units_sold,
    SUM(oi.quantity * oi.price) AS revenue
FROM shopify_order_items oi
JOIN shopify_products p ON oi.product_id = p.id
JOIN shopify_orders o ON oi.order_id = o.id
WHERE o.financial_status = 'paid'
  AND o.created_at > DATE_TRUNC('month', NOW())
GROUP BY p.id, p.title, p.vendor
ORDER BY revenue DESC
LIMIT 20;
```

### 5. Abandoned Checkout Recovery

Track abandoned carts:

```sql
-- Recent abandoned checkouts
SELECT
    email,
    total_price,
    created_at,
    abandoned_checkout_url
FROM shopify_checkouts
WHERE completed_at IS NULL
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY total_price DESC;
```

---

## TypeScript Implementation

The plugin is built with TypeScript for type safety and maintainability.

### Key Files

| File | Purpose |
|------|---------|
| `types.ts` | All type definitions for Shopify resources |
| `client.ts` | Shopify API client with pagination and rate limiting |
| `database.ts` | PostgreSQL operations with upsert support |
| `sync.ts` | Orchestrates full and incremental syncs |
| `webhooks.ts` | Webhook event handlers |
| `server.ts` | Fastify HTTP server |
| `cli.ts` | Commander.js CLI |

### API Client Example

```typescript
export class ShopifyClient {
  private http: HttpClient;
  private rateLimiter: RateLimiter;

  constructor(shopDomain: string, accessToken: string, apiVersion: string) {
    this.http = new HttpClient({
      baseUrl: `https://${shopDomain}/admin/api/${apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    // Shopify allows 2 requests/second per app
    this.rateLimiter = new RateLimiter(2);
  }

  async listProducts(): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let pageInfo: string | undefined;

    do {
      await this.rateLimiter.acquire();

      const params = pageInfo
        ? { page_info: pageInfo, limit: '250' }
        : { limit: '250' };

      const response = await this.http.get<{ products: any[] }>(
        '/products.json',
        params
      );

      products.push(...response.products.map(this.mapProduct));

      // Handle cursor-based pagination
      const linkHeader = response.headers?.get('link');
      pageInfo = this.extractNextPageInfo(linkHeader);
    } while (pageInfo);

    return products;
  }
}
```

### Rate Limiting

Shopify has strict rate limits (2 requests/second for Admin API):

```typescript
const rateLimiter = new RateLimiter(2);

// Before each API call
await rateLimiter.acquire();
const response = await shopifyApi.call();
```

---

## Troubleshooting

### Common Issues

#### Rate Limiting

```
Error: 429 Too Many Requests
```

**Solution**: The plugin includes built-in rate limiting. If you still hit limits:
- Use incremental sync instead of full sync
- Increase the sync interval
- Check for other apps using your API quota

#### Access Token Invalid

```
Error: 401 [API] Invalid API key or access token
```

**Solution**:
1. Verify your access token is correct
2. Check that the app is still installed
3. Regenerate the access token if needed

#### Webhook Signature Invalid

```
Error: Webhook signature verification failed
```

**Solution**:
1. Verify `SHOPIFY_WEBHOOK_SECRET` matches the secret from Shopify
2. Ensure the raw request body is used for verification (not parsed JSON)
3. Check that no proxy is modifying the request

#### Missing Orders

```
Only seeing orders from the last 60 days
```

**Solution**: Request the `read_all_orders` scope to access older orders. This requires Shopify approval for production apps.

#### API Version Mismatch

```
Error: API version not supported
```

**Solution**: Update `SHOPIFY_API_VERSION` to a supported version. Check [Shopify's API versioning docs](https://shopify.dev/docs/api/usage/versioning).

### Debug Mode

Enable debug logging for troubleshooting:

```bash
DEBUG=shopify:* nself-shopify sync
```

### Support

- [GitHub Issues](https://github.com/acamarata/nself-plugins/issues)
- [Shopify API Documentation](https://shopify.dev/docs/api)
- [Shopify Partners Community](https://community.shopify.com/c/shopify-apis-and-sdks/bd-p/shopify-apis-and-technology)
