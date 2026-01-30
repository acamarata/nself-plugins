# Notifications Plugin for nself

Production-ready multi-channel notification system with email, push, and SMS support.

## Features

- **Multi-Channel Delivery** - Email, push notifications, and SMS
- **Template Engine** - Handlebars templates with variable substitution
- **User Preferences** - Opt-in/out per channel and category
- **Delivery Tracking** - Real-time status updates and engagement metrics
- **Retry Logic** - Exponential backoff for failed deliveries
- **Rate Limiting** - Per-user, per-channel limits
- **Batch/Digest** - Daily summaries and bulk sends
- **Provider Fallback** - Multiple providers with priority ordering
- **Queue Processing** - Async delivery with Redis or PostgreSQL backend
- **Analytics** - Delivery rates, engagement, provider health
- **GraphQL Actions** - `sendNotification()` mutation

## Supported Providers

### Email
- **Resend** (recommended) - Modern email API
- **SendGrid** - Enterprise email delivery
- **Mailgun** - Email automation
- **AWS SES** - Amazon Simple Email Service
- **SMTP** - Generic SMTP support (Gmail, Office 365, etc.)

### Push Notifications
- **FCM** (Firebase Cloud Messaging) - Google's push service
- **OneSignal** - Multi-platform push notifications
- **Web Push** - Browser push notifications (VAPID)

### SMS
- **Twilio** - SMS and voice API
- **Plivo** - Cloud communication platform
- **AWS SNS** - Amazon Simple Notification Service

## Installation

```bash
# Install the plugin
cd ~/Sites/nself-plugins/plugins/notifications
bash install.sh

# Install TypeScript dependencies
cd ts
npm install
npm run build
```

## Quick Start

### 1. Configure Provider

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nself

# Email (Resend example)
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_EMAIL_PROVIDER=resend
NOTIFICATIONS_EMAIL_API_KEY=re_xxxxxxxxxxxx
NOTIFICATIONS_EMAIL_FROM=notifications@example.com

# Queue
NOTIFICATIONS_QUEUE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

### 2. Initialize System

```bash
nself plugin notifications init
```

### 3. Start Services

```bash
# Terminal 1: Start API server
nself plugin notifications server

# Terminal 2: Start queue worker
nself plugin notifications worker
```

### 4. Send Test Notification

```bash
nself plugin notifications test email user@example.com
```

## Configuration

See [.env.example](.env.example) for all configuration options.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `NOTIFICATIONS_EMAIL_PROVIDER` | No | resend | Email provider (resend, sendgrid, mailgun, ses, smtp) |
| `NOTIFICATIONS_EMAIL_API_KEY` | No | - | Email provider API key |
| `NOTIFICATIONS_EMAIL_FROM` | No | noreply@example.com | Default sender email |
| `NOTIFICATIONS_PUSH_PROVIDER` | No | - | Push provider (fcm, onesignal, webpush) |
| `NOTIFICATIONS_PUSH_API_KEY` | No | - | Push provider API key |
| `NOTIFICATIONS_SMS_PROVIDER` | No | - | SMS provider (twilio, plivo, sns) |
| `NOTIFICATIONS_SMS_ACCOUNT_SID` | No | - | Twilio account SID |
| `NOTIFICATIONS_SMS_AUTH_TOKEN` | No | - | Twilio/Plivo auth token |
| `NOTIFICATIONS_SMS_FROM` | No | - | SMS sender phone number |
| `NOTIFICATIONS_QUEUE_BACKEND` | No | redis | Queue backend (redis or postgres) |
| `REDIS_URL` | No | redis://localhost:6379 | Redis connection string |
| `WORKER_CONCURRENCY` | No | 5 | Number of concurrent workers |
| `NOTIFICATIONS_RETRY_ATTEMPTS` | No | 3 | Max retry attempts |
| `NOTIFICATIONS_BATCH_INTERVAL` | No | 86400 | Batch interval in seconds |
| `PORT` | No | 3102 | HTTP server port |

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `notification_templates` | Reusable templates with Handlebars |
| `notification_preferences` | User opt-in/out settings |
| `notifications` | Sent notification log |
| `notification_queue` | Async processing queue |
| `notification_providers` | Provider configurations |
| `notification_batches` | Batch/digest tracking |

### Views

- `notification_delivery_rates` - Delivery metrics by channel
- `notification_engagement` - Email open/click rates
- `notification_provider_health` - Provider status
- `notification_user_summary` - Per-user stats
- `notification_queue_backlog` - Queue status

## CLI Commands

### Initialize

```bash
nself plugin notifications init
```

Verify installation and configuration.

### Templates

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

# Test template
nself plugin notifications test template welcome_email user@example.com

# Check provider status
nself plugin notifications test providers
```

### Statistics

```bash
# Overview
nself plugin notifications stats overview

# Delivery rates (last 30 days)
nself plugin notifications stats delivery 30

# Email engagement
nself plugin notifications stats engagement 7

# Provider health
nself plugin notifications stats providers

# Top templates
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

## HTTP API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/notifications/send` | Send notification |
| GET | `/api/notifications/:id` | Get notification status |
| GET | `/api/templates` | List templates |
| GET | `/api/templates/:name` | Get template |
| POST | `/api/preferences` | Update user preferences |
| GET | `/api/preferences/:user_id` | Get user preferences |
| GET | `/api/stats/delivery` | Delivery statistics |
| GET | `/api/stats/engagement` | Engagement metrics |
| POST | `/webhooks/notifications` | Webhook receiver |

### Send Notification

```bash
curl -X POST http://localhost:3102/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

Response:

```json
{
  "success": true,
  "notification_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Notification queued for delivery"
}
```

### Get Notification Status

```bash
curl http://localhost:3102/api/notifications/550e8400-e29b-41d4-a716-446655440000
```

Response:

```json
{
  "notification": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "delivered",
    "channel": "email",
    "template_name": "welcome_email",
    "sent_at": "2026-01-30T12:00:00Z",
    "delivered_at": "2026-01-30T12:00:05Z",
    "opened_at": "2026-01-30T14:30:00Z"
  }
}
```

## GraphQL Integration

### Hasura Actions

The plugin provides a `sendNotification` mutation:

```graphql
mutation SendWelcomeEmail($userId: uuid!, $email: String!) {
  sendNotification(
    user_id: $userId
    channel: email
    template: "welcome_email"
    to: { email: $email }
    variables: { user_name: "John", app_name: "MyApp" }
  ) {
    success
    notification_id
    error
  }
}
```

## Templates

### Default Templates

The plugin comes with 4 pre-installed templates:

1. **welcome_email** - New user welcome
2. **password_reset** - Password reset link
3. **email_verification** - Email verification link
4. **password_changed** - Password change notification

### Template Variables

Templates use Handlebars syntax:

```html
<h1>Welcome, {{user_name}}!</h1>
<p>Thank you for joining {{app_name}}.</p>
<a href="{{verify_url}}">Verify Email</a>
```

### Creating Templates

Via CLI:

```bash
nself plugin notifications template create
```

Via SQL:

```sql
INSERT INTO notification_templates (name, category, channels, subject, body_html)
VALUES (
  'order_confirmation',
  'transactional',
  '["email"]'::jsonb,
  'Order #{{order_number}} Confirmed',
  '<h1>Order Confirmed</h1><p>Order #{{order_number}} for ${{total}} has been confirmed.</p>'
);
```

## User Preferences

### Setting Preferences

Users can opt-in/out per channel and category:

```sql
INSERT INTO notification_preferences (user_id, channel, category, enabled, frequency)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'email',
  'marketing',
  false,  -- Opt-out of marketing emails
  'disabled'
);
```

### Quiet Hours

Respect user quiet hours:

```sql
UPDATE notification_preferences
SET quiet_hours = '{"start": "22:00", "end": "08:00", "timezone": "America/Los_Angeles"}'::jsonb
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'
  AND channel = 'push';
```

## Rate Limiting

Automatic rate limiting per user per channel:

- **Email**: 100 per hour (configurable)
- **Push**: 200 per hour
- **SMS**: 20 per hour

Rate limits are checked before queueing notifications.

## Retry Logic

Failed notifications are automatically retried with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: +1 second
- Attempt 3: +2 seconds
- Attempt 4: +4 seconds
- Max delay: 5 minutes

Configure via environment variables:

```bash
NOTIFICATIONS_RETRY_ATTEMPTS=3
NOTIFICATIONS_RETRY_DELAY=1000
NOTIFICATIONS_MAX_RETRY_DELAY=300000
```

## Batch/Digest Notifications

Send daily summaries instead of individual notifications:

```sql
INSERT INTO notification_batches (name, category, interval_seconds, config)
VALUES (
  'daily_digest',
  'marketing',
  86400,  -- 24 hours
  '{"group_by": "user_id", "max_items": 10}'::jsonb
);
```

## Monitoring

### Health Check

```bash
curl http://localhost:3102/health
```

### Statistics

View real-time statistics:

```bash
nself plugin notifications stats overview
```

### Provider Health

Monitor provider status:

```sql
SELECT * FROM notification_provider_health;
```

### Queue Backlog

Check queue status:

```sql
SELECT * FROM notification_queue_backlog;
```

## Webhooks

### Delivery Events

The plugin can receive webhooks from providers:

```bash
POST /webhooks/notifications
```

Supported events:

- `delivery.succeeded` - Notification delivered
- `delivery.failed` - Delivery failed
- `bounce` - Email bounced
- `complaint` - Marked as spam
- `open` - Email opened
- `click` - Link clicked
- `unsubscribe` - User unsubscribed

## Security

### Encrypt Provider Configs

Store sensitive credentials encrypted:

```bash
NOTIFICATIONS_ENCRYPT_CONFIG=true
NOTIFICATIONS_ENCRYPTION_KEY=your-32-character-encryption-key
```

### Webhook Verification

Verify webhook signatures:

```bash
NOTIFICATIONS_WEBHOOK_SECRET=your-webhook-secret
NOTIFICATIONS_WEBHOOK_VERIFY=true
```

## Development

### Build

```bash
cd ts
npm install
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Type Check

```bash
npm run typecheck
```

### Dry Run

Test without actually sending:

```bash
NOTIFICATIONS_DRY_RUN=true nself plugin notifications test email user@example.com
```

## Troubleshooting

### Notifications Not Sending

1. Check worker is running:
   ```bash
   ps aux | grep notifications
   ```

2. Check queue:
   ```bash
   nself plugin notifications stats overview
   ```

3. Check provider status:
   ```bash
   nself plugin notifications test providers
   ```

4. View logs:
   ```bash
   tail -f ~/.nself/logs/plugins/notifications/worker.log
   ```

### High Failure Rate

1. Check provider health:
   ```sql
   SELECT * FROM notification_provider_health;
   ```

2. Review recent failures:
   ```bash
   nself plugin notifications stats failures 50
   ```

3. Test provider directly:
   ```bash
   nself plugin notifications test email test@example.com
   ```

### Queue Backlog Growing

1. Increase worker concurrency:
   ```bash
   WORKER_CONCURRENCY=20 nself plugin notifications worker
   ```

2. Check database connection pool

3. Monitor provider rate limits

## Architecture

```
┌─────────────────┐
│   Application   │
│   (GraphQL)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Notifications  │
│     Plugin      │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌─────────┐
│ Queue  │ │Database │
└───┬────┘ └─────────┘
    │
    ↓
┌─────────┐
│ Worker  │
└────┬────┘
     │
  ┌──┴──┬──────┬──────┐
  ↓     ↓      ↓      ↓
Email  Push   SMS   ...
```

## License

Source-Available (see [LICENSE](../../LICENSE))

## Support

- [GitHub Issues](https://github.com/acamarata/nself-plugins/issues)
- [Documentation](https://github.com/acamarata/nself-plugins)
