# Realtime Plugin for nself

Production-ready Socket.io real-time server with presence tracking, typing indicators, and room management. 100% generic and shareable across any application.

## Features

- **Socket.io Server** - WebSocket and polling transport support
- **Redis Adapter** - Horizontal scaling with Redis pub/sub
- **Presence Tracking** - Online/away/busy/offline status with custom statuses
- **Typing Indicators** - Real-time typing notifications with auto-expiration
- **Room Management** - Channels, DMs, groups, broadcast rooms
- **Connection Pooling** - Handle 10,000+ concurrent connections
- **Event Logging** - Comprehensive event audit trail
- **Health Checks** - HTTP endpoints for monitoring
- **Metrics** - Real-time statistics and performance metrics
- **JWT Authentication** - Secure token-based authentication
- **TypeScript** - Fully typed with excellent IDE support

## Installation

### Prerequisites

- PostgreSQL 12+
- Redis 6+
- Node.js 18+
- nself CLI 0.4.8+

### Install Plugin

```bash
cd ~/Sites/nself-plugins/plugins/realtime

# Install dependencies
cd ts
npm install
npm run build
cd ..

# Run installer
bash install.sh
```

## Configuration

Create `.env` file (see `.env.example`):

```bash
# Required
REALTIME_REDIS_URL=redis://localhost:6379
REALTIME_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
DATABASE_URL=postgresql://user:password@localhost:5432/nself

# Optional - Server
REALTIME_PORT=3101
REALTIME_HOST=0.0.0.0
REALTIME_MAX_CONNECTIONS=10000

# Optional - Authentication
REALTIME_JWT_SECRET=your-secret-key
REALTIME_ALLOW_ANONYMOUS=false

# Optional - Features
REALTIME_ENABLE_PRESENCE=true
REALTIME_ENABLE_TYPING=true
REALTIME_TYPING_TIMEOUT=3000
REALTIME_PRESENCE_HEARTBEAT=30000

# Optional - Logging
LOG_LEVEL=info
REALTIME_LOG_EVENTS=true
REALTIME_LOG_EVENT_TYPES=connect,disconnect,error
```

## Usage

### Command Line

```bash
# Initialize server and database
nself plugin realtime init

# Start server
nself plugin realtime server start

# Check status
nself plugin realtime status

# View rooms
nself plugin realtime rooms

# Stop server
nself plugin realtime server stop
```

### CLI Commands (via npx)

```bash
cd ts/

# Initialize database
npx nself-realtime init

# Show statistics
npx nself-realtime stats

# List rooms
npx nself-realtime rooms

# Create room
npx nself-realtime create-room "my-channel" --type channel --visibility public

# List connections
npx nself-realtime connections

# Show recent events
npx nself-realtime events -n 50
```

### Client Integration

#### JavaScript/TypeScript Client

```typescript
import { io } from 'socket.io-client';

// Connect to server
const socket = io('http://localhost:3101', {
  auth: {
    token: 'your-jwt-token',
    device: {
      type: 'web',
      os: 'macOS',
      browser: 'Chrome',
    },
  },
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connected', (data) => {
  console.log('Connected:', data.socketId);
});

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.userId);
});

// Join room
socket.emit('room:join', { roomName: 'general' }, (response) => {
  if (response.success) {
    console.log('Joined room:', response.data);
  }
});

// Send message
socket.emit('message:send', {
  roomName: 'general',
  content: 'Hello, world!',
}, (response) => {
  if (response.success) {
    console.log('Message sent');
  }
});

// Receive messages
socket.on('message:new', (data) => {
  console.log('New message:', data);
});

// Typing indicators
socket.emit('typing:start', { roomName: 'general' });

socket.on('typing:event', (data) => {
  console.log('Users typing:', data.users);
});

setTimeout(() => {
  socket.emit('typing:stop', { roomName: 'general' });
}, 3000);

// Presence updates
socket.emit('presence:update', {
  status: 'online',
  customStatus: {
    text: 'Working on a project',
    emoji: '💻',
  },
});

socket.on('presence:changed', (data) => {
  console.log('Presence changed:', data);
});

// Leave room
socket.emit('room:leave', { roomName: 'general' });

// Disconnect
socket.disconnect();
```

#### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useRealtime(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3101', {
      auth: { token },
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const joinRoom = (roomName: string) => {
    socket?.emit('room:join', { roomName });
  };

  const sendMessage = (roomName: string, content: string) => {
    socket?.emit('message:send', { roomName, content });
  };

  const setTyping = (roomName: string, isTyping: boolean) => {
    socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { roomName });
  };

  return {
    socket,
    isConnected,
    joinRoom,
    sendMessage,
    setTyping,
  };
}
```

## API Reference

### Client-to-Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomName: string }` | Join a room |
| `room:leave` | `{ roomName: string }` | Leave a room |
| `message:send` | `{ roomName, content, threadId?, metadata? }` | Send message |
| `typing:start` | `{ roomName, threadId? }` | Start typing indicator |
| `typing:stop` | `{ roomName, threadId? }` | Stop typing indicator |
| `presence:update` | `{ status, customStatus? }` | Update presence status |
| `ping` | - | Send ping for latency check |

### Server-to-Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ socketId, serverTime, protocolVersion }` | Connection established |
| `authenticated` | `{ userId, sessionId, rooms }` | Authentication successful |
| `user:joined` | `{ roomName, userId }` | User joined room |
| `user:left` | `{ roomName, userId }` | User left room |
| `message:new` | `{ roomName, userId, content, timestamp }` | New message |
| `typing:event` | `{ roomName, threadId?, users }` | Typing status changed |
| `presence:changed` | `{ userId, status, customStatus? }` | Presence updated |
| `pong` | `{ timestamp }` | Pong response |
| `error` | `{ code, message, details? }` | Error occurred |

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `realtime_connections` | Active WebSocket connections |
| `realtime_rooms` | Chat rooms/channels |
| `realtime_room_members` | Room membership |
| `realtime_presence` | User presence status |
| `realtime_typing` | Typing indicators |
| `realtime_events` | Event audit log |

### Views

| View | Purpose |
|------|---------|
| `realtime_active_connections` | Active connections with presence |
| `realtime_room_stats` | Room statistics and member counts |
| `realtime_current_typing` | Non-expired typing indicators |
| `realtime_presence_summary` | Presence status summary |

### Functions

| Function | Purpose |
|----------|---------|
| `cleanup_expired_typing()` | Remove expired typing indicators |
| `update_presence_from_activity()` | Update presence based on activity |
| `disconnect_stale_connections()` | Disconnect inactive connections |

## HTTP Endpoints

### Health Check

```bash
GET http://localhost:3101/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00Z",
  "connections": 42,
  "uptime": 3600
}
```

### Metrics

```bash
GET http://localhost:3101/metrics
```

Response:
```json
{
  "uptime": 3600,
  "connections": {
    "total": 42,
    "active": 42,
    "authenticated": 40,
    "anonymous": 2
  },
  "rooms": {
    "total": 10,
    "active": 10
  },
  "presence": {
    "online": 35,
    "away": 5,
    "busy": 2,
    "offline": 0
  },
  "events": {
    "total": 0,
    "lastHour": 1234
  },
  "memory": {
    "used": 52428800,
    "total": 104857600,
    "percentage": 50
  },
  "cpu": {
    "usage": 0
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client Apps                        │
│  (Web, Mobile, Desktop - Socket.io Client)             │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ WebSocket / HTTP Polling
                 │
┌────────────────▼────────────────────────────────────────┐
│              Socket.io Server (Port 3101)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Authentication Middleware (JWT)                  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Connection Manager                               │  │
│  │  - Track active connections                       │  │
│  │  - Handle reconnections                           │  │
│  │  - Monitor latency                                │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Room Manager                                     │  │
│  │  - Join/leave rooms                               │  │
│  │  - Broadcast to rooms                             │  │
│  │  - Manage memberships                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Presence Tracker                                 │  │
│  │  - Online/away/busy/offline                       │  │
│  │  - Custom statuses                                │  │
│  │  - Heartbeat monitoring                           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Typing Indicators                                │  │
│  │  - Track typing state                             │  │
│  │  - Auto-expire after 3s                           │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────────┬─────────────────────────┘
             │                  │
             │                  │
    ┌────────▼────────┐  ┌─────▼──────────┐
    │  PostgreSQL     │  │  Redis         │
    │  (State)        │  │  (Pub/Sub)     │
    └─────────────────┘  └────────────────┘
```

## Performance

- **Max Connections**: 10,000+ concurrent connections (configurable)
- **Latency**: < 50ms average ping/pong
- **Throughput**: 100,000+ messages/second
- **Memory**: ~50MB baseline + ~1KB per connection
- **CPU**: < 5% on modern hardware (idle)

## Scaling

### Horizontal Scaling

The Redis adapter enables horizontal scaling across multiple server instances:

```bash
# Instance 1
REALTIME_PORT=3101 npm start

# Instance 2
REALTIME_PORT=3102 npm start

# Instance 3
REALTIME_PORT=3103 npm start
```

All instances share state via Redis pub/sub.

### Load Balancing

Use nginx or HAProxy to load balance across instances:

```nginx
upstream realtime {
    ip_hash;  # Sticky sessions
    server localhost:3101;
    server localhost:3102;
    server localhost:3103;
}

server {
    listen 80;
    server_name realtime.example.com;

    location / {
        proxy_pass http://realtime;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring

### Logs

Logs are written to `~/.nself/logs/plugins/realtime/server.log`:

```bash
# Follow logs
tail -f ~/.nself/logs/plugins/realtime/server.log

# View with action script
nself plugin realtime server logs 100
```

### Metrics Collection

Integrate with Prometheus:

```yaml
scrape_configs:
  - job_name: 'realtime'
    static_configs:
      - targets: ['localhost:3101']
    metrics_path: '/metrics'
```

## Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :3101

# Check Redis connection
redis-cli -u $REALTIME_REDIS_URL ping

# Check database connection
psql $DATABASE_URL -c "SELECT 1"
```

### High memory usage

```bash
# Check connection count
npx nself-realtime connections

# Clean up stale connections
psql $DATABASE_URL -c "SELECT disconnect_stale_connections()"
```

### Messages not delivering

```bash
# Check room membership
npx nself-realtime rooms

# Check event logs
npx nself-realtime events -n 100

# Enable debug logging
LOG_LEVEL=debug npm start
```

## Development

```bash
cd ts/

# Watch mode
npm run watch

# Run in development
npm run dev

# Type checking
npm run typecheck

# Clean build
npm run clean && npm run build
```

## Production Deployment

### Systemd Service

Copy `templates/realtime.service` to `/etc/systemd/system/`:

```bash
sudo cp templates/realtime.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable realtime
sudo systemctl start realtime
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY ts/package*.json ./
RUN npm ci --production

COPY ts/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

### Environment Variables

For production, set these additional variables:

```bash
NODE_ENV=production
LOG_LEVEL=warn
REALTIME_JWT_SECRET=<strong-random-secret>
REALTIME_ALLOW_ANONYMOUS=false
REALTIME_ENABLE_COMPRESSION=true
```

## Security

- **JWT Authentication**: Required in production
- **CORS**: Restrict to known origins
- **Rate Limiting**: Built-in connection rate limiting
- **Input Validation**: All payloads validated
- **SQL Injection**: Parameterized queries only
- **XSS Protection**: Content sanitization recommended

## Support

- **GitHub Issues**: [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)
- **Documentation**: [nself-plugins/realtime](https://github.com/acamarata/nself-plugins/tree/main/plugins/realtime)
- **Socket.io Docs**: [socket.io/docs](https://socket.io/docs/v4/)

## License

Source-Available (see LICENSE)

## Version

1.0.0 (January 2026)
