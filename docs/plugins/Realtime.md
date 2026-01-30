# Realtime Plugin

Production-ready Socket.io real-time server with presence tracking, typing indicators, and room management for nself.

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

The Realtime plugin provides a Socket.io-based WebSocket server with full presence tracking, typing indicators, and room management. It supports horizontal scaling via Redis pub/sub and stores all state in PostgreSQL.

- **6 Database Tables** - Connections, rooms, members, presence, typing, events
- **4 Analytics Views** - Active connections, room stats, current typing, presence summary
- **JWT Authentication** - Secure token-based authentication
- **Redis Adapter** - Horizontal scaling across multiple server instances
- **10,000+ Connections** - High-concurrency connection pooling
- **Event Logging** - Comprehensive audit trail for all events

### Key Capabilities

| Capability | Description |
|------------|-------------|
| Presence Tracking | Online/away/busy/offline status with custom statuses |
| Typing Indicators | Real-time typing notifications with auto-expiration |
| Room Management | Channels, DMs, groups, broadcast rooms |
| Metrics | Real-time statistics and performance monitoring |

---

## Quick Start

```bash
# Install the plugin
nself plugin install realtime

# Configure environment
echo "REALTIME_REDIS_URL=redis://localhost:6379" >> .env
echo "REALTIME_CORS_ORIGIN=http://localhost:3000" >> .env
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/nself" >> .env

# Initialize database schema
nself plugin realtime init

# Start the server
nself plugin realtime server start
```

### Prerequisites

- PostgreSQL 12+
- Redis 6+
- Node.js 18+
- nself CLI 0.4.8+

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REALTIME_REDIS_URL` | Yes | - | Redis connection string |
| `REALTIME_CORS_ORIGIN` | Yes | - | Comma-separated allowed CORS origins |
| `REALTIME_PORT` | No | `3101` | Socket.io server port |
| `REALTIME_HOST` | No | `0.0.0.0` | Server bind host |
| `REALTIME_MAX_CONNECTIONS` | No | `10000` | Maximum concurrent connections |
| `REALTIME_JWT_SECRET` | No | - | JWT secret for authentication |
| `REALTIME_ALLOW_ANONYMOUS` | No | `false` | Allow unauthenticated connections |
| `REALTIME_ENABLE_PRESENCE` | No | `true` | Enable presence tracking |
| `REALTIME_ENABLE_TYPING` | No | `true` | Enable typing indicators |
| `REALTIME_TYPING_TIMEOUT` | No | `3000` | Typing indicator timeout (ms) |
| `REALTIME_PRESENCE_HEARTBEAT` | No | `30000` | Presence heartbeat interval (ms) |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `REALTIME_LOG_EVENTS` | No | `true` | Log events to database |
| `REALTIME_LOG_EVENT_TYPES` | No | `connect,disconnect,error` | Event types to log |

### Example .env File

```bash
# Required
REALTIME_REDIS_URL=redis://localhost:6379
REALTIME_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
DATABASE_URL=postgresql://nself:password@localhost:5432/nself

# Authentication
REALTIME_JWT_SECRET=your-secret-key
REALTIME_ALLOW_ANONYMOUS=false

# Features
REALTIME_ENABLE_PRESENCE=true
REALTIME_ENABLE_TYPING=true
REALTIME_TYPING_TIMEOUT=3000

# Server
REALTIME_PORT=3101
LOG_LEVEL=info
```

---

## CLI Commands

### Plugin Management

```bash
# Initialize database schema and verify configuration
nself plugin realtime init

# Check plugin status
nself plugin realtime status

# View statistics
nself plugin realtime stats
```

### Server Management

```bash
# Start the Socket.io server
nself plugin realtime server start

# Stop the server
nself plugin realtime server stop

# View server logs
nself plugin realtime server logs 100
```

### Room Management

```bash
# List all rooms
nself plugin realtime rooms

# Create a room
nself plugin realtime create-room "my-channel" --type channel --visibility public
```

### Connection Management

```bash
# List active connections
nself plugin realtime connections

# Show recent events
nself plugin realtime events -n 50
```

---

## REST API

The plugin exposes HTTP endpoints alongside the Socket.io server.

### Base URL

```
http://localhost:3101
```

### Endpoints

#### Health & Metrics

```http
GET /health
```
Returns server health status including connection count and uptime.

```http
GET /metrics
```
Returns detailed metrics: connection counts (total, authenticated, anonymous), room counts, presence summary, event totals, and memory/CPU usage.

### Socket.io Events

#### Client-to-Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomName: string }` | Join a room |
| `room:leave` | `{ roomName: string }` | Leave a room |
| `message:send` | `{ roomName, content, threadId?, metadata? }` | Send a message to a room |
| `typing:start` | `{ roomName, threadId? }` | Start typing indicator |
| `typing:stop` | `{ roomName, threadId? }` | Stop typing indicator |
| `presence:update` | `{ status, customStatus? }` | Update presence status |
| `ping` | - | Latency check |

#### Server-to-Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ socketId, serverTime, protocolVersion }` | Connection established |
| `authenticated` | `{ userId, sessionId, rooms }` | Authentication successful |
| `user:joined` | `{ roomName, userId }` | User joined a room |
| `user:left` | `{ roomName, userId }` | User left a room |
| `message:new` | `{ roomName, userId, content, timestamp }` | New message received |
| `typing:event` | `{ roomName, threadId?, users }` | Typing status changed |
| `presence:changed` | `{ userId, status, customStatus? }` | Presence updated |
| `pong` | `{ timestamp }` | Pong response |
| `error` | `{ code, message, details? }` | Error occurred |

---

## Webhook Events

N/A - internal service. The Realtime plugin does not receive external webhooks. It is an event-driven system using Socket.io for real-time communication between clients and the server.

---

## Database Schema

### realtime_connections

Tracks active WebSocket connections.

```sql
CREATE TABLE realtime_connections (
    id UUID PRIMARY KEY,
    socket_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    device JSONB,                          -- {type, os, browser}
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);
```

### realtime_rooms

Chat rooms and channels.

```sql
CREATE TABLE realtime_rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50),                      -- channel, dm, group, broadcast
    visibility VARCHAR(50),                -- public, private
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
```

### realtime_room_members

Room membership tracking.

```sql
CREATE TABLE realtime_room_members (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES realtime_rooms(id),
    user_id VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE
);
```

### realtime_presence

User presence status.

```sql
CREATE TABLE realtime_presence (
    user_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,           -- online, away, busy, offline
    custom_status JSONB,                   -- {text, emoji}
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### realtime_typing

Typing indicator state.

```sql
CREATE TABLE realtime_typing (
    id UUID PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### realtime_events

Event audit log.

```sql
CREATE TABLE realtime_events (
    id UUID PRIMARY KEY,
    type VARCHAR(100) NOT NULL,            -- connect, disconnect, message, error, etc.
    user_id VARCHAR(255),
    room_name VARCHAR(255),
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_realtime_events_type ON realtime_events(type);
CREATE INDEX idx_realtime_events_created ON realtime_events(created_at DESC);
```

---

## Analytics Views

### realtime_active_connections

Active connections with presence information.

```sql
CREATE VIEW realtime_active_connections AS
SELECT
    c.socket_id,
    c.user_id,
    c.device,
    c.connected_at,
    c.last_activity,
    p.status AS presence_status,
    p.custom_status
FROM realtime_connections c
LEFT JOIN realtime_presence p ON c.user_id = p.user_id
WHERE c.disconnected_at IS NULL
ORDER BY c.connected_at DESC;
```

### realtime_room_stats

Room statistics and member counts.

```sql
CREATE VIEW realtime_room_stats AS
SELECT
    r.name,
    r.type,
    r.visibility,
    COUNT(rm.id) AS member_count,
    r.created_at
FROM realtime_rooms r
LEFT JOIN realtime_room_members rm ON r.id = rm.room_id AND rm.left_at IS NULL
GROUP BY r.id, r.name, r.type, r.visibility, r.created_at
ORDER BY member_count DESC;
```

### realtime_current_typing

Non-expired typing indicators.

```sql
CREATE VIEW realtime_current_typing AS
SELECT
    room_name,
    user_id,
    thread_id,
    started_at
FROM realtime_typing
WHERE expires_at > NOW()
ORDER BY room_name, started_at;
```

### realtime_presence_summary

Summary of presence status counts.

```sql
CREATE VIEW realtime_presence_summary AS
SELECT
    status,
    COUNT(*) AS user_count
FROM realtime_presence
WHERE last_seen > NOW() - INTERVAL '1 hour'
GROUP BY status
ORDER BY user_count DESC;
```

---

## Troubleshooting

### Common Issues

#### "Server won't start"

```
Error: EADDRINUSE: address already in use
```

**Solution:** Check if the port is already in use.

```bash
lsof -i :3101
```

#### "Redis Connection Failed"

```
Error: Redis connection to localhost:6379 failed
```

**Solutions:**
1. Verify Redis is running: `redis-cli -u $REALTIME_REDIS_URL ping`
2. Check `REALTIME_REDIS_URL` is set correctly in `.env`

#### "Database Connection Failed"

```
Error: Connection refused
```

**Solutions:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`

#### "High Memory Usage"

**Solutions:**
1. Check connection count: `nself plugin realtime connections`
2. Clean up stale connections: `psql $DATABASE_URL -c "SELECT disconnect_stale_connections()"`
3. Lower `REALTIME_MAX_CONNECTIONS` if needed

#### "Messages Not Delivering"

**Solutions:**
1. Check room membership: `nself plugin realtime rooms`
2. Check event logs: `nself plugin realtime events -n 100`
3. Enable debug logging: `LOG_LEVEL=debug npm start`

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug nself plugin realtime server start
```

### Health Checks

```bash
# Check server health
curl http://localhost:3101/health

# Check detailed metrics
curl http://localhost:3101/metrics
```

---

## Support

- **GitHub Issues:** [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)
- **Socket.io Documentation:** [socket.io/docs](https://socket.io/docs/v4/)

---

*Last Updated: January 2026*
*Plugin Version: 1.0.0*
