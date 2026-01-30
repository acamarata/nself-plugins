# ID.me Plugin

OAuth authentication with government-grade identity verification for military, veterans, first responders, government employees, teachers, students, and nurses for nself.

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

The ID.me plugin provides a complete OAuth 2.0 integration with ID.me for government-grade identity verification. It supports 7 verification groups and stores verification records, badges, and attributes in PostgreSQL.

- **5 Database Tables** - Verifications, groups, badges, attributes, webhook events
- **3 Analytics Views** - Verified users, group summary, recent verifications
- **7 Verification Groups** - Military, Veteran, First Responder, Government, Teacher, Student, Nurse
- **Complete OAuth 2.0** - Authorization, token exchange, refresh
- **Badge Management** - Visual badges for verified groups
- **Sandbox Mode** - Test with ID.me sandbox environment

### Verification Groups

| Group | Scopes | Attributes |
|-------|--------|------------|
| Military | `military` | branch, rank, status, affiliation |
| Veteran | `veteran` | branch, service_era, rank, affiliation |
| First Responder | `first_responder` | department, role |
| Government | `government` | agency, level |
| Teacher | `teacher` | school, subject |
| Student | `student` | school, graduation_year |
| Nurse | `nurse` | specialty, license |

---

## Quick Start

```bash
# 1. Register your application at developers.id.me

# 2. Install the plugin
cd plugins/idme
./install.sh

# 3. Configure environment
cp .env.example .env
# Edit .env with your ID.me credentials

# 4. Install TypeScript dependencies
cd ts
npm install
npm run build

# 5. Initialize database schema
nself plugin idme init

# 6. Start HTTP server
nself plugin idme server --port 3010

# 7. Test configuration
nself plugin idme test
```

### Prerequisites

- Node.js 20+
- PostgreSQL
- ID.me developer account ([developers.id.me](https://developers.id.me))

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `IDME_CLIENT_ID` | Yes | - | ID.me OAuth client ID |
| `IDME_CLIENT_SECRET` | Yes | - | ID.me OAuth client secret |
| `IDME_REDIRECT_URI` | Yes | - | OAuth callback URL (must match ID.me dashboard) |
| `IDME_SCOPES` | No | `openid,email,profile` | Comma-separated OAuth scopes |
| `IDME_SANDBOX` | No | `false` | Use ID.me sandbox environment (api.idmelabs.com) |
| `IDME_WEBHOOK_SECRET` | No | - | Secret for webhook signature verification |
| `PORT` | No | `3010` | HTTP server port |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

### OAuth Scopes

| Scope | Required | Description |
|-------|----------|-------------|
| `openid` | Yes | OpenID Connect |
| `email` | Yes | User's email address |
| `profile` | Yes | Basic profile information |
| `military` | No | Active duty military verification |
| `veteran` | No | Military veteran verification |
| `first_responder` | No | First responder verification (police, fire, EMT) |
| `government` | No | Government employee verification |
| `teacher` | No | Teacher/educator verification |
| `student` | No | Student verification |
| `nurse` | No | Nurse/healthcare worker verification |

### Example .env File

```bash
# Required
IDME_CLIENT_ID=your_client_id
IDME_CLIENT_SECRET=your_client_secret
IDME_REDIRECT_URI=https://your-domain.com/callback/idme
DATABASE_URL=postgresql://nself:password@localhost:5432/nself

# Scopes (include the groups you want to verify)
IDME_SCOPES=openid,email,profile,military,veteran

# Optional
IDME_SANDBOX=false
IDME_WEBHOOK_SECRET=your_webhook_secret
PORT=3010
```

---

## CLI Commands

### Plugin Management

```bash
# Initialize OAuth configuration and database schema
nself plugin idme init

# Generate authorization URL for OAuth flow
nself plugin idme init auth

# Test configuration (config, database, API connectivity)
nself plugin idme test
```

### Verification

```bash
# Check verification status for a user
nself plugin idme verify user@example.com
```

### Group Management

```bash
# List all verification groups
nself plugin idme groups list

# Show users in a specific group
nself plugin idme groups type military
```

### Testing

```bash
# Test configuration
nself plugin idme test config

# Test database connectivity
nself plugin idme test database

# Test API connectivity
nself plugin idme test api

# Run all tests
nself plugin idme test
```

### Server

```bash
# Start HTTP server
nself plugin idme server --port 3010
```

---

## REST API

The plugin exposes an HTTP server for OAuth callbacks, webhooks, and API queries.

### Base URL

```
http://localhost:3010
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/auth/idme` | Start OAuth flow (redirects to ID.me) |
| `GET` | `/callback/idme` | OAuth callback handler |
| `POST` | `/webhook/idme` | Webhook receiver for verification events |
| `GET` | `/api/verifications/:userId` | Get verification status for a user |

### OAuth Flow

1. Redirect users to `/auth/idme` to begin the OAuth flow
2. Users authenticate with ID.me and grant permissions
3. ID.me redirects back to `/callback/idme` with an authorization code
4. The callback handler automatically:
   - Exchanges the authorization code for an access token
   - Fetches user profile data
   - Fetches verification groups
   - Stores all data in the database

### Get Verification Status

```http
GET /api/verifications/:userId
```

Returns the user's verification status including verified groups, badges, and attributes.

---

## Webhook Events

ID.me sends webhooks for verification lifecycle events. Configure your webhook URL in the ID.me developer dashboard.

### Supported Events

| Event | Description |
|-------|-------------|
| `verification.created` | New verification record created |
| `verification.updated` | Verification status updated |
| `verification.completed` | Verification completed successfully |
| `verification.failed` | Verification failed |
| `group.verified` | User verified for a specific group |
| `group.revoked` | Group verification revoked |
| `attribute.updated` | User attribute updated |

### Webhook Setup

1. Set `IDME_WEBHOOK_SECRET` in your `.env` file
2. Configure webhook URL in ID.me dashboard: `https://your-domain.com/webhook/idme`
3. Select verification events to receive
4. Webhooks are verified using HMAC-SHA256 signature

---

## Database Schema

### idme_verifications

Main verification records with OAuth tokens.

```sql
CREATE TABLE idme_verifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,                 -- your application user ID
    idme_user_id VARCHAR(255) NOT NULL,    -- ID.me user ID
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    access_token TEXT,                     -- encrypted in production
    refresh_token TEXT,                    -- encrypted in production
    token_expires_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),                    -- pending, verified, failed, expired
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_idme_verifications_user ON idme_verifications(user_id);
CREATE INDEX idx_idme_verifications_idme_user ON idme_verifications(idme_user_id);
CREATE INDEX idx_idme_verifications_email ON idme_verifications(email);
CREATE INDEX idx_idme_verifications_status ON idme_verifications(status);
```

### idme_groups

Verification group membership.

```sql
CREATE TABLE idme_groups (
    id UUID PRIMARY KEY,
    verification_id UUID REFERENCES idme_verifications(id),
    user_id UUID NOT NULL,
    group_type VARCHAR(50) NOT NULL,       -- military, veteran, first_responder, government, teacher, student, nurse
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_idme_groups_user ON idme_groups(user_id);
CREATE INDEX idx_idme_groups_type ON idme_groups(group_type);
CREATE INDEX idx_idme_groups_verified ON idme_groups(verified);
```

### idme_badges

Visual badges for verified groups.

```sql
CREATE TABLE idme_badges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    group_type VARCHAR(50) NOT NULL,
    badge_name VARCHAR(255),
    icon VARCHAR(50),
    color VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_idme_badges_user ON idme_badges(user_id);
CREATE INDEX idx_idme_badges_active ON idme_badges(active);
```

### idme_attributes

Additional verified attributes (branch, rank, school, etc.).

```sql
CREATE TABLE idme_attributes (
    id UUID PRIMARY KEY,
    verification_id UUID REFERENCES idme_verifications(id),
    user_id UUID NOT NULL,
    attribute_name VARCHAR(100) NOT NULL,  -- branch, rank, school, department, etc.
    attribute_value TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_idme_attributes_user ON idme_attributes(user_id);
CREATE INDEX idx_idme_attributes_name ON idme_attributes(attribute_name);
```

### idme_webhook_events

Webhook event audit log.

```sql
CREATE TABLE idme_webhook_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    signature VARCHAR(255),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_idme_webhook_events_type ON idme_webhook_events(event_type);
CREATE INDEX idx_idme_webhook_events_processed ON idme_webhook_events(processed);
CREATE INDEX idx_idme_webhook_events_received ON idme_webhook_events(received_at DESC);
```

---

## Analytics Views

### idme_verified_users

All verified users with their groups and badges.

```sql
CREATE VIEW idme_verified_users AS
SELECT
    v.user_id,
    v.email,
    v.first_name,
    v.last_name,
    v.verified,
    v.verified_at,
    v.status,
    ARRAY_AGG(DISTINCT g.group_type) FILTER (WHERE g.verified = TRUE) AS verified_groups,
    COUNT(DISTINCT g.id) FILTER (WHERE g.verified = TRUE) AS group_count,
    COUNT(DISTINCT b.id) FILTER (WHERE b.active = TRUE) AS badge_count
FROM idme_verifications v
LEFT JOIN idme_groups g ON v.id = g.verification_id
LEFT JOIN idme_badges b ON v.user_id = b.user_id
GROUP BY v.user_id, v.email, v.first_name, v.last_name, v.verified, v.verified_at, v.status
ORDER BY v.verified_at DESC;
```

### idme_group_summary

Verification counts by group type.

```sql
CREATE VIEW idme_group_summary AS
SELECT
    group_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
    COUNT(*) FILTER (WHERE verified = FALSE) AS pending
FROM idme_groups
GROUP BY group_type
ORDER BY verified DESC;
```

### idme_recent_verifications

Verifications from the last 30 days.

```sql
CREATE VIEW idme_recent_verifications AS
SELECT
    v.user_id,
    v.email,
    v.first_name,
    v.last_name,
    v.status,
    v.verified_at,
    ARRAY_AGG(DISTINCT g.group_type) FILTER (WHERE g.verified = TRUE) AS groups
FROM idme_verifications v
LEFT JOIN idme_groups g ON v.id = g.verification_id
WHERE v.created_at > NOW() - INTERVAL '30 days'
GROUP BY v.user_id, v.email, v.first_name, v.last_name, v.status, v.verified_at
ORDER BY v.created_at DESC;
```

---

## Troubleshooting

### Common Issues

#### "Invalid redirect_uri"

```
Error: The redirect_uri is not valid for this application
```

**Solution:** Ensure `IDME_REDIRECT_URI` matches exactly what is registered in the ID.me developer dashboard. The URL must be identical, including trailing slashes and protocol.

#### "Invalid client credentials"

```
Error: Client authentication failed
```

**Solution:** Verify `IDME_CLIENT_ID` and `IDME_CLIENT_SECRET` are correct. Ensure you are using the right credentials for the environment (sandbox vs production).

#### "relation idme_verifications does not exist"

```
Error: relation "idme_verifications" does not exist
```

**Solution:** Run the installer to create tables.

```bash
cd plugins/idme
./install.sh
```

Or initialize via CLI:

```bash
nself plugin idme init
```

#### "Database Connection Failed"

```
Error: Connection refused
```

**Solutions:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`

#### "Invalid webhook signature"

```
Error: Webhook signature verification failed
```

**Solution:** Ensure `IDME_WEBHOOK_SECRET` matches the secret configured in the ID.me webhook settings.

### Sandbox Mode

Enable sandbox mode for testing without real verification:

```bash
IDME_SANDBOX=true
```

This uses the ID.me test environment at `api.idmelabs.com`.

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug nself plugin idme server --port 3010
```

### Health Checks

```bash
# Check server health
curl http://localhost:3010/health

# Test all components
nself plugin idme test
```

---

## Support

- **GitHub Issues:** [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)
- **ID.me Developer Portal:** [developers.id.me](https://developers.id.me)

---

*Last Updated: January 2026*
*Plugin Version: 1.0.0*
