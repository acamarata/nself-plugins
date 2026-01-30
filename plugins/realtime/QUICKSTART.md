# Realtime Plugin - Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

```bash
# Check you have required services
redis-cli ping  # Should return PONG
psql $DATABASE_URL -c "SELECT 1"  # Should return 1
```

## Installation

```bash
cd ~/Sites/nself-plugins/plugins/realtime

# Install and build
bash install.sh
```

## Configuration

```bash
# Copy example config
cp .env.example .env

# Edit required variables
nano .env
```

Minimum required:
```bash
REALTIME_REDIS_URL=redis://localhost:6379
REALTIME_CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/nself
```

## Start Server

```bash
# Initialize database
nself plugin realtime init

# Start server
nself plugin realtime server start

# Check status
nself plugin realtime status
```

You should see:
- Server running on port 3101
- WebSocket endpoint at `ws://localhost:3101`
- Health check at `http://localhost:3101/health`

## Test Connection

### Using wscat

```bash
npm install -g wscat

wscat -c "ws://localhost:3101"
```

### Using curl (health check)

```bash
curl http://localhost:3101/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00Z",
  "connections": 0,
  "uptime": 10
}
```

## Client Example

Create `test.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Realtime Test</title>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
</head>
<body>
    <h1>Realtime Test</h1>
    <div id="status">Connecting...</div>
    <div id="messages"></div>

    <script>
        const socket = io('http://localhost:3101');

        socket.on('connected', (data) => {
            document.getElementById('status').textContent = 'Connected: ' + data.socketId;

            // Join room
            socket.emit('room:join', { roomName: 'general' }, (response) => {
                console.log('Joined room:', response);
            });
        });

        socket.on('message:new', (data) => {
            const div = document.createElement('div');
            div.textContent = `${data.userId}: ${data.content}`;
            document.getElementById('messages').appendChild(div);
        });

        // Send test message after 2 seconds
        setTimeout(() => {
            socket.emit('message:send', {
                roomName: 'general',
                content: 'Hello from browser!'
            });
        }, 2000);
    </script>
</body>
</html>
```

Open in browser and check console.

## CLI Commands

```bash
# View statistics
cd ts && npx nself-realtime stats

# List rooms
npx nself-realtime rooms

# Create new room
npx nself-realtime create-room "my-channel"

# View active connections
npx nself-realtime connections

# View recent events
npx nself-realtime events
```

## Common Issues

### Server won't start

```bash
# Check logs
nself plugin realtime server logs

# Check if port is in use
lsof -i :3101

# Kill existing process
kill $(lsof -t -i:3101)
```

### Can't connect from client

```bash
# Check CORS configuration in .env
REALTIME_CORS_ORIGIN=http://localhost:3000

# Restart server after config change
nself plugin realtime server restart
```

### Redis connection error

```bash
# Test Redis
redis-cli -u $REALTIME_REDIS_URL ping

# Start Redis if not running
redis-server
```

## Next Steps

1. Read the full [README.md](./README.md)
2. Explore the [database schema](./schema/tables.sql)
3. Check out the [TypeScript types](./ts/src/types.ts)
4. Review [client examples](./README.md#client-integration)

## Production Deployment

For production, set these environment variables:

```bash
NODE_ENV=production
LOG_LEVEL=warn
REALTIME_JWT_SECRET=<generate-strong-secret>
REALTIME_ALLOW_ANONYMOUS=false
```

And install as a systemd service:

```bash
sudo cp templates/realtime.service /etc/systemd/system/
sudo systemctl enable realtime
sudo systemctl start realtime
```

## Support

- Issues: https://github.com/acamarata/nself-plugins/issues
- Documentation: [README.md](./README.md)
