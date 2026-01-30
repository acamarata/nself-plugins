# Notifications Plugin

Production-ready multi-channel notification system with email, push, and SMS support for nself.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [CLI Commands](#cli-commands)
- [REST API](#rest-api)
- [Webhook Events](#webhook-events)
- [Database Schema](#database-schema)
- [Analytics Views](#analytics-views)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Notifications plugin provides a complete multi-channel notification system supporting email, push notifications, and SMS. It includes a template engine, user preferences, delivery tracking, retry logic, rate limiting, batch/digest support, and provider fallback.

- **6 Database Tables** - Templates, preferences, notifications, queue, providers, batches
- **5 Analytics Views** - Delivery rates, engagement, provider health, user summary, queue backlog
- **3 Channels** - Email, push notifications, SMS
- **11 Providers** - Resend, SendGrid, Mailgun, AWS SES, SMTP, FCM, OneSignal, Web Push, Twilio, Plivo, AWS SNS
- **Template Engine** - Handlebars-based templates with variable substitution
- **GraphQL Integration** - `sendNotification()` Hasura Action

### Supported Providers

| Channel | Providers |
|---------|-----------|
| Email | Resend, SendGrid, Mailgun, AWS SES, SMTP (Gmail, Office 365, etc.) |
| Push | FCM (Firebase), OneSignal, Web Push (VAPID) |
| SMS | Twilio, Plivo, AWS SNS |

---

## Quick Start

```bash
# Install the plugin
cd ~/Sites/nself-plugins/plugins/notifications
bash install.sh

# Install TypeScript dependencies
cd ts
npm install
npm run build

# Configure environment
cp .env.example .env
# Edit .env with provider credentials

# Initialize database schema
nself plugin notifications init

# Start API server (Terminal 1)
nself plugin notifications server

# Start queue worker (Terminal 2)
nself plugin notifications worker

# Send a test notification
nself plugin notifications test email user@example.com
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `NOTIFICATIONS_EMAIL_PROVIDER` | No | `resend` | Email provider (resend, sendgrid, mailgun, ses, smtp) |
| `NOTIFICATIONS_EMAIL_API_KEY` | No | - | Email provider API key |
| `NOTIFICATIONS_EMAIL_FROM` | No | `noreply@example.com` | Default sender email address |
| `NOTIFICATIONS_EMAIL_ENABLED` | No | `false` | Enable email channel |
| `NOTIFICATIONS_PUSH_PROVIDER` | No | - | Push provider (fcm, onesignal, webpush) |
| `NOTIFICATIONS_PUSH_API_KEY` | No | - | Push provider API key |
| `NOTIFICATIONS_SMS_PROVIDER` | No | - | SMS provider (twilio, plivo, sns) |
| `NOTIFICATIONS_SMS_ACCOUNT_SID` | No | - | Twilio account SID |
| `NOTIFICATIONS_SMS_AUTH_TOKEN` | No | - | Twilio/Plivo auth token |
| `NOTIFICATIONS_SMS_FROM` | No | - | SMS sender phone number |
| `NOTIFICATIONS_QUEUE_BACKEND` | No | `redis` | Queue backend (redis or postgres) |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `WORKER_CONCURRENCY` | No | `5` | Number of concurrent workers |
| `NOTIFICATIONS_RETRY_ATTEMPTS` | No | `3` | Maximum retry attempts |
| `NOTIFICATIONS_RETRY_DELAY` | No | `1000` | Initial retry delay (ms) |
| `NOTIFICATIONS_MAX_RETRY_DELAY` | No | `300000` | Maximum retry delay (ms) |
| `NOTIFICATIONS_BATCH_INTERVAL` | No | `86400` | Batch/digest interval in seconds |
| `PORT` | No | `3102` | HTTP server port |
| `NOTIFICATIONS_DRY_RUN` | No | `false` | Test mode (no actual sending) |
| `NOTIFICATIONS_ENCRYPT_CONFIG` | No | `false` | Encrypt provider configs at rest |
| `NOTIFICATIONS_ENCRYPTION_KEY` | No | - | 32-character encryption key |
| `NOTIFICATIONS_WEBHOOK_SECRET` | No | - | Secret for webhook signature verification |
| `NOTIFICATIONS_WEBHOOK_VERIFY` | No | `false` | Enable webhook signature verification |

### Example .env File

```bash
# Database
DATABASE_URL=postgresql://nself:password@localhost:5432/nself

# Email (Resend)
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_EMAIL_PROVIDER=resend
NOTIFICATIONS_EMAIL_API_KEY=re_xxxxxxxxxxxx
NOTIFICATIONS_EMAIL_FROM=notifications@example.com

# Queue
NOTIFICATIONS_QUEUE_BACKEND=redis
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5

# Server
PORT=3102
```

---

## CLI Commands

### Plugin Management

```bash
# Initialize and verify installation
nself plugin notifications init
```

### Template Management

```bash
# List all templates
nself plugin notifications template list

# Show template details
nself plugin notifications template show welcome_email

# Create new template
nself plugin notifications template create

# Update template
nself plugin notifications template update welcome_email

# Delete template
nself plugin notifications template delete old_template
```

### Testing

```bash
# Send test email
nself plugin notifications test email user@example.com

# Test a specific template
nself plugin notifications test template welcome_email user@example.com

# Check provider status
nself plugin notifications test providers

# Dry run (no actual sending)
NOTIFICATIONS_DRY_RUN=true nself plugin notifications test email user@example.com
```

### Statistics

```bash
# Overview
nself plugin notifications stats overview

# Delivery rates (last 30 days)
nself plugin notifications stats delivery 30

# Email engagement metrics
nself plugin notifications stats engagement 7

# Provider health
nself plugin notifications stats providers

# Top templates by usage
nself plugin notifications stats templates 20

# Recent failures
nself plugin notifications stats failures 50

# Hourly volume
nself plugin notifications stats hourly 24

# Export to JSON
nself plugin notifications stats export json stats.json

# Export to CSV
nself plugin notifications stats export csv notifications.csv
```

### Server & Worker

```bash
# Start HTTP server
nself plugin notifications server --port 3102 --host 0.0.0.0

# Start queue worker
nself plugin notifications worker --concurrency 10 --poll-interval 500
```

---

## REST API

The plugin exposes a REST API when the server is running.

### Base URL

```
http://localhost:3102
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/notifications/send` | Send a notification |
| `GET` | `/api/notifications/:id` | Get notification status |
| `GET` | `/api/templates` | List all templates |
| `GET` | `/api/templates/:name` | Get template by name |
| `POST` | `/api/preferences` | Update user preferences |
| `GET` | `/api/preferences/:user_id` | Get user preferences |
| `GET` | `/api/stats/delivery` | Delivery statistics |
| `GET` | `/api/stats/engagement` | Engagement metrics |
| `POST` | `/webhooks/notifications` | Webhook receiver for provider events |

### Send Notification

```http
POST /api/notifications/send
Content-Type: application/json

{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "channel": "email",
  "template": "welcome_email",
  "to": {
    "email": "user@example.com"
  },
  "variables": {
    "user_name": "John Doe",
    "app_name": "MyApp"
  }
}
```

Returns `{ success, notification_id, message }`.

### Get Notification Status

```http
GET /api/notifications/:id
```

Returns notification details including status (queued, sent, delivered, failed, bounced), timestamps (sent_at, delivered_at, opened_at), and channel information.

---

## Webhook Events

The plugin receives webhooks from notification providers to track delivery status.

### Inbound Provider Events

| Event | Description |
|-------|-------------|
| `delivery.succeeded` | Notification delivered successfully |
| `delivery.failed` | Delivery failed |
| `bounce` | Email bounced |
| `complaint` | Marked as spam |
| `open` | Email opened |
| `click` | Link clicked |
| `unsubscribe` | User unsubscribed |

Configure the webhook endpoint in your provider's dashboard:
```
POST https://your-domain.com/webhooks/notifications
```

Webhook signatures are verified when `NOTIFICATIONS_WEBHOOK_VERIFY=true` and `NOTIFICATIONS_WEBHOOK_SECRET` is set.

---

## Database Schema

### notification_templates

Reusable notification templates with Handlebars syntax.

```sql
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100),                 -- transactional, marketing, system
    channels JSONB DEFAULT '["email"]',    -- supported channels
    subject VARCHAR(500),                  -- email subject (Handlebars)
    body_text TEXT,                        -- plain text body
    body_html TEXT,                        -- HTML body (Handlebars)
    variables JSONB DEFAULT '[]',          -- expected variables
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_templates_name ON notification_templates(name);
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
```

### notification_preferences

User opt-in/out settings per channel and category.

```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL,          -- email, push, sms
    category VARCHAR(100),                 -- transactional, marketing, etc.
    enabled BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(50),                 -- immediate, daily, weekly, disabled
    quiet_hours JSONB,                     -- {start, end, timezone}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notification_preferences_user_channel
    ON notification_preferences(user_id, channel, category);
```

### notifications

Sent notification log with delivery tracking.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL,          -- email, push, sms
    template_name VARCHAR(255),
    to_address VARCHAR(500),               -- email, phone, device token
    subject VARCHAR(500),
    body TEXT,
    variables JSONB,
    status VARCHAR(50) NOT NULL,           -- queued, sent, delivered, failed, bounced
    provider VARCHAR(50),                  -- resend, sendgrid, twilio, etc.
    provider_id VARCHAR(255),              -- provider message ID
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

### notification_queue

Async processing queue for pending notifications.

```sql
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id),
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC, created_at ASC);
CREATE INDEX idx_notification_queue_retry ON notification_queue(next_retry_at);
```

### notification_providers

Provider configurations and status.

```sql
CREATE TABLE notification_providers (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,            -- resend, sendgrid, twilio, etc.
    channel VARCHAR(50) NOT NULL,          -- email, push, sms
    priority INTEGER DEFAULT 0,            -- higher = preferred
    config JSONB,                          -- provider-specific config (encrypted)
    enabled BOOLEAN DEFAULT TRUE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### notification_batches

Batch/digest tracking for grouped notifications.

```sql
CREATE TABLE notification_batches (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    interval_seconds INTEGER NOT NULL,
    config JSONB,                          -- {group_by, max_items}
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Analytics Views

### notification_delivery_rates

Delivery metrics by channel.

```sql
CREATE VIEW notification_delivery_rates AS
SELECT
    channel,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
    ROUND(COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2)
        AS delivery_rate_pct
FROM notifications
GROUP BY channel;
```

### notification_engagement

Email open and click rates.

```sql
CREATE VIEW notification_engagement AS
SELECT
    template_name,
    COUNT(*) AS total_sent,
    COUNT(opened_at) AS opened,
    COUNT(clicked_at) AS clicked,
    ROUND(COUNT(opened_at)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) AS open_rate_pct,
    ROUND(COUNT(clicked_at)::DECIMAL / NULLIF(COUNT(opened_at), 0) * 100, 2) AS click_rate_pct
FROM notifications
WHERE channel = 'email' AND status = 'delivered'
GROUP BY template_name
ORDER BY total_sent DESC;
```

### notification_provider_health

Provider status and reliability.

```sql
CREATE VIEW notification_provider_health AS
SELECT
    name,
    channel,
    enabled,
    priority,
    failure_count,
    last_success_at,
    last_failure_at
FROM notification_providers
ORDER BY channel, priority DESC;
```

### notification_user_summary

Per-user notification statistics.

```sql
CREATE VIEW notification_user_summary AS
SELECT
    user_id,
    COUNT(*) AS total_notifications,
    COUNT(*) FILTER (WHERE channel = 'email') AS email_count,
    COUNT(*) FILTER (WHERE channel = 'push') AS push_count,
    COUNT(*) FILTER (WHERE channel = 'sms') AS sms_count,
    MAX(created_at) AS last_notification_at
FROM notifications
GROUP BY user_id
ORDER BY total_notifications DESC;
```

### notification_queue_backlog

Current queue status.

```sql
CREATE VIEW notification_queue_backlog AS
SELECT
    COUNT(*) AS total_queued,
    COUNT(*) FILTER (WHERE locked_at IS NOT NULL) AS processing,
    COUNT(*) FILTER (WHERE locked_at IS NULL) AS pending,
    MIN(created_at) AS oldest_queued_at
FROM notification_queue
WHERE notification_id IN (
    SELECT id FROM notifications WHERE status = 'queued'
);
```

---

## Troubleshooting

### Common Issues

#### "Notifications Not Sending"

**Solutions:**
1. Check worker is running: `ps aux | grep notifications`
2. Check queue status: `nself plugin notifications stats overview`
3. Check provider status: `nself plugin notifications test providers`
4. View logs: `tail -f ~/.nself/logs/plugins/notifications/worker.log`

#### "High Failure Rate"

**Solutions:**
1. Check provider health: `SELECT * FROM notification_provider_health;`
2. Review recent failures: `nself plugin notifications stats failures 50`
3. Test provider directly: `nself plugin notifications test email test@example.com`

#### "Queue Backlog Growing"

**Solutions:**
1. Increase worker concurrency: `WORKER_CONCURRENCY=20 nself plugin notifications worker`
2. Check database connection pool for bottlenecks
3. Monitor provider rate limits

#### "Database Connection Failed"

```
Error: Connection refused
```

**Solutions:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### Rate Limits

Default per-user per-channel limits:

| Channel | Default Limit |
|---------|---------------|
| Email | 100 per hour |
| Push | 200 per hour |
| SMS | 20 per hour |

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug nself plugin notifications server
```

### Health Checks

```bash
# Check server health
curl http://localhost:3102/health

# Check delivery stats
curl http://localhost:3102/api/stats/delivery
```

---

## Support

- **GitHub Issues:** [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)

---

*Last Updated: January 2026*
*Plugin Version: 1.0.0*
