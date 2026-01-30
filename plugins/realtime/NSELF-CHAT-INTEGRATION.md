# Integrating Realtime Plugin with nself-chat

This guide shows how to integrate the realtime plugin with nself-chat.

## Prerequisites

- nself-chat project running
- Realtime plugin installed and running
- Redis running on localhost:6379
- PostgreSQL database accessible

## Installation

### 1. Install Realtime Plugin

```bash
cd ~/Sites/nself-plugins/plugins/realtime
bash install.sh
```

### 2. Configure Environment

Add to nself-chat `.env.local`:

```bash
# Realtime WebSocket URL
NEXT_PUBLIC_REALTIME_URL=http://localhost:3101
NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:3101
```

Add to realtime plugin `.env`:

```bash
REALTIME_REDIS_URL=redis://localhost:6379
REALTIME_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
DATABASE_URL=postgresql://user:password@localhost:5432/nself
REALTIME_PORT=3101
REALTIME_JWT_SECRET=your-jwt-secret-from-nself-chat
REALTIME_ENABLE_PRESENCE=true
REALTIME_ENABLE_TYPING=true
```

### 3. Start Realtime Server

```bash
cd ~/Sites/nself-plugins/plugins/realtime
nself plugin realtime init
nself plugin realtime server start
```

## Client Integration in nself-chat

### 1. Install Socket.io Client

```bash
cd ~/Sites/nself-chat
pnpm add socket.io-client
```

### 2. Create Realtime Hook

Create `src/hooks/use-realtime.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/auth-context';

export function useRealtime() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, getToken } = useAuth();

  useEffect(() => {
    if (!user) return;

    const token = getToken();
    const newSocket = io(process.env.NEXT_PUBLIC_REALTIME_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Realtime] Connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Realtime] Disconnected');
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('[Realtime] Server confirmed:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  const joinRoom = useCallback((roomName: string) => {
    socket?.emit('room:join', { roomName }, (response) => {
      if (response.success) {
        console.log('[Realtime] Joined room:', roomName);
      }
    });
  }, [socket]);

  const leaveRoom = useCallback((roomName: string) => {
    socket?.emit('room:leave', { roomName });
  }, [socket]);

  const sendMessage = useCallback((roomName: string, content: string) => {
    socket?.emit('message:send', { roomName, content }, (response) => {
      if (!response.success) {
        console.error('[Realtime] Failed to send message:', response.error);
      }
    });
  }, [socket]);

  const startTyping = useCallback((roomName: string) => {
    socket?.emit('typing:start', { roomName });
  }, [socket]);

  const stopTyping = useCallback((roomName: string) => {
    socket?.emit('typing:stop', { roomName });
  }, [socket]);

  const updatePresence = useCallback((status: 'online' | 'away' | 'busy' | 'offline', customStatus?: string) => {
    socket?.emit('presence:update', {
      status,
      customStatus: customStatus ? { text: customStatus } : undefined,
    });
  }, [socket]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    updatePresence,
  };
}
```

### 3. Create Realtime Provider

Create `src/providers/realtime-provider.tsx`:

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useRealtime } from '@/hooks/use-realtime';
import type { Socket } from 'socket.io-client';

interface RealtimeContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomName: string) => void;
  leaveRoom: (roomName: string) => void;
  sendMessage: (roomName: string, content: string) => void;
  startTyping: (roomName: string) => void;
  stopTyping: (roomName: string) => void;
  updatePresence: (status: 'online' | 'away' | 'busy' | 'offline', customStatus?: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const realtime = useRealtime();

  return (
    <RealtimeContext.Provider value={realtime}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within RealtimeProvider');
  }
  return context;
}
```

### 4. Add Provider to Layout

Update `src/app/layout.tsx`:

```typescript
import { RealtimeProvider } from '@/providers/realtime-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <NhostProvider>
          <AppConfigProvider>
            <ThemeProvider>
              <ApolloProvider>
                <AuthProvider>
                  <RealtimeProvider>
                    {children}
                  </RealtimeProvider>
                </AuthProvider>
              </ApolloProvider>
            </ThemeProvider>
          </AppConfigProvider>
        </NhostProvider>
      </body>
    </html>
  );
}
```

### 5. Use in Chat Components

Update `src/components/chat/message-list.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRealtimeContext } from '@/providers/realtime-provider';

export function MessageList({ channelId }: { channelId: string }) {
  const { socket, isConnected, joinRoom, leaveRoom } = useRealtimeContext();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!isConnected || !channelId) return;

    // Join room
    joinRoom(channelId);

    // Listen for new messages
    socket?.on('message:new', (data) => {
      if (data.roomName === channelId) {
        setMessages(prev => [...prev, data]);
      }
    });

    return () => {
      leaveRoom(channelId);
    };
  }, [isConnected, channelId, socket, joinRoom, leaveRoom]);

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.userId}</strong>: {msg.content}
        </div>
      ))}
    </div>
  );
}
```

Update `src/components/chat/message-input.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRealtimeContext } from '@/providers/realtime-provider';

export function MessageInput({ channelId }: { channelId: string }) {
  const [content, setContent] = useState('');
  const { sendMessage, startTyping, stopTyping } = useRealtimeContext();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if (e.target.value) {
      startTyping(channelId);
    } else {
      stopTyping(channelId);
    }
  }, [channelId, startTyping, stopTyping]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    sendMessage(channelId, content);
    setContent('');
    stopTyping(channelId);
  }, [channelId, content, sendMessage, stopTyping]);

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={content}
        onChange={handleChange}
        placeholder="Type a message..."
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

### 6. Presence Indicator Component

Create `src/components/presence/presence-indicator.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRealtimeContext } from '@/providers/realtime-provider';

interface PresenceData {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
}

export function PresenceIndicator({ userId }: { userId: string }) {
  const { socket } = useRealtimeContext();
  const [presence, setPresence] = useState<PresenceData | null>(null);

  useEffect(() => {
    socket?.on('presence:changed', (data: PresenceData) => {
      if (data.userId === userId) {
        setPresence(data);
      }
    });
  }, [socket, userId]);

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${statusColors[presence?.status || 'offline']}`} />
      {presence?.customStatus && (
        <span className="text-xs text-gray-500">{presence.customStatus}</span>
      )}
    </div>
  );
}
```

### 7. Typing Indicator Component

Create `src/components/chat/typing-indicator.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRealtimeContext } from '@/providers/realtime-provider';

interface TypingUser {
  userId: string;
  startedAt: Date;
}

export function TypingIndicator({ channelId }: { channelId: string }) {
  const { socket } = useRealtimeContext();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    socket?.on('typing:event', (data) => {
      if (data.roomName === channelId) {
        setTypingUsers(data.users);
      }
    });
  }, [socket, channelId]);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map(u => u.userId).join(', ');
  const text = typingUsers.length === 1 ? 'is typing...' : 'are typing...';

  return (
    <div className="text-sm text-gray-500 italic">
      {names} {text}
    </div>
  );
}
```

## Database Sync

The realtime plugin uses its own tables. To link with nself-chat users:

```sql
-- Create view to link realtime presence with nself-chat users
CREATE OR REPLACE VIEW nchat_user_presence AS
SELECT
  u.id,
  u.display_name,
  u.avatar_url,
  p.status,
  p.custom_status,
  p.last_active,
  p.connections_count
FROM nchat_users u
LEFT JOIN realtime_presence p ON u.id::text = p.user_id;
```

## Testing

1. Start realtime server:
```bash
nself plugin realtime server start
```

2. Check health:
```bash
curl http://localhost:3101/health
```

3. Start nself-chat:
```bash
cd ~/Sites/nself-chat
pnpm dev
```

4. Open browser and check console for:
```
[Realtime] Connected
[Realtime] Server confirmed: { socketId: '...', ... }
```

## Monitoring

View realtime status from nself-chat admin:

```bash
nself plugin realtime status
```

Shows:
- Active connections
- Unique users
- Active rooms
- Presence breakdown
- Recent events

## Troubleshooting

### Connection fails
- Check CORS origin in realtime `.env`
- Verify JWT secret matches
- Check firewall allows port 3101

### Messages not delivering
- Check room membership
- Verify user is authenticated
- Check event logs: `nself plugin realtime server logs`

### High latency
- Check Redis connection
- Monitor with: `npx nself-realtime stats`
- Enable debug logs: `LOG_LEVEL=debug`

## Production Deployment

For production:

1. Use environment variables:
```bash
NODE_ENV=production
REALTIME_JWT_SECRET=<strong-secret>
REALTIME_ALLOW_ANONYMOUS=false
```

2. Deploy behind nginx:
```nginx
location /realtime/ {
    proxy_pass http://localhost:3101/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

3. Use systemd service:
```bash
sudo systemctl enable realtime
sudo systemctl start realtime
```

## Next Steps

- Add presence zones for channels
- Implement read receipts
- Add voice call signaling
- Create admin dashboard
- Add metrics to monitoring

## Support

See main [README.md](./README.md) for full documentation.
