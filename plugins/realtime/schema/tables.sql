-- =============================================================================
-- Realtime Plugin Schema
-- Tables for managing WebSocket connections, rooms, presence, and events
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Connections - Active WebSocket connections
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    socket_id VARCHAR(255) UNIQUE NOT NULL,          -- Socket.io connection ID
    user_id VARCHAR(255),                            -- Authenticated user ID (nullable for anonymous)
    session_id VARCHAR(255),                         -- Session identifier
    status VARCHAR(20) DEFAULT 'connected',          -- connected, disconnected, reconnecting
    transport VARCHAR(20),                           -- websocket, polling
    ip_address INET,                                 -- Client IP address
    user_agent TEXT,                                 -- Client user agent
    device_info JSONB,                               -- Device details (type, os, browser)
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_pong TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latency_ms INTEGER,                              -- Ping latency in milliseconds
    metadata JSONB DEFAULT '{}'                      -- Additional connection metadata
);

CREATE INDEX IF NOT EXISTS idx_realtime_connections_socket_id ON realtime_connections(socket_id);
CREATE INDEX IF NOT EXISTS idx_realtime_connections_user_id ON realtime_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_connections_status ON realtime_connections(status);
CREATE INDEX IF NOT EXISTS idx_realtime_connections_connected_at ON realtime_connections(connected_at);

-- =============================================================================
-- Rooms - Chat rooms, channels, or namespaces
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,               -- Room name/identifier
    type VARCHAR(50) DEFAULT 'channel',              -- channel, dm, group, broadcast
    visibility VARCHAR(20) DEFAULT 'public',         -- public, private, secret
    max_members INTEGER,                             -- Maximum allowed members (null = unlimited)
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',                     -- Room-specific settings
    metadata JSONB DEFAULT '{}',                     -- Additional room metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_rooms_name ON realtime_rooms(name);
CREATE INDEX IF NOT EXISTS idx_realtime_rooms_type ON realtime_rooms(type);
CREATE INDEX IF NOT EXISTS idx_realtime_rooms_is_active ON realtime_rooms(is_active);

-- =============================================================================
-- Room Members - User membership in rooms
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES realtime_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',               -- admin, moderator, member, guest
    is_muted BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_realtime_room_members_room_id ON realtime_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_realtime_room_members_user_id ON realtime_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_room_members_joined_at ON realtime_room_members(joined_at);

-- =============================================================================
-- Presence - User online/away/offline status
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'offline',            -- online, away, busy, offline
    custom_status TEXT,                              -- Custom status message
    custom_emoji VARCHAR(100),                       -- Status emoji
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,             -- Custom status expiration
    connections_count INTEGER DEFAULT 0,             -- Number of active connections
    metadata JSONB DEFAULT '{}',                     -- Additional presence data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_presence_user_id ON realtime_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_presence_status ON realtime_presence(status);
CREATE INDEX IF NOT EXISTS idx_realtime_presence_last_active ON realtime_presence(last_active);

-- =============================================================================
-- Typing Indicators - Who is typing in which room
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_typing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES realtime_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),                          -- Optional thread/reply context
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,    -- Auto-expire after 3 seconds
    UNIQUE(room_id, user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_realtime_typing_room_id ON realtime_typing(room_id);
CREATE INDEX IF NOT EXISTS idx_realtime_typing_user_id ON realtime_typing(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_typing_expires_at ON realtime_typing(expires_at);

-- =============================================================================
-- Events - Event log for debugging and analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,                -- connect, disconnect, message, typing, etc.
    socket_id VARCHAR(255),
    user_id VARCHAR(255),
    room_id UUID REFERENCES realtime_rooms(id) ON DELETE SET NULL,
    payload JSONB DEFAULT '{}',                      -- Event data
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_events_event_type ON realtime_events(event_type);
CREATE INDEX IF NOT EXISTS idx_realtime_events_socket_id ON realtime_events(socket_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_user_id ON realtime_events(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_room_id ON realtime_events(room_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at);

-- =============================================================================
-- Views for common queries
-- =============================================================================

-- Active connections with user presence
CREATE OR REPLACE VIEW realtime_active_connections AS
SELECT
    c.id,
    c.socket_id,
    c.user_id,
    c.status,
    c.transport,
    c.connected_at,
    c.latency_ms,
    p.status AS user_status,
    p.custom_status,
    p.custom_emoji
FROM realtime_connections c
LEFT JOIN realtime_presence p ON c.user_id = p.user_id
WHERE c.status = 'connected'
  AND c.disconnected_at IS NULL
ORDER BY c.connected_at DESC;

-- Room statistics
CREATE OR REPLACE VIEW realtime_room_stats AS
SELECT
    r.id,
    r.name,
    r.type,
    COUNT(DISTINCT rm.user_id) AS member_count,
    COUNT(DISTINCT c.socket_id) AS active_connections,
    MAX(rm.last_seen) AS last_activity,
    r.created_at
FROM realtime_rooms r
LEFT JOIN realtime_room_members rm ON r.id = rm.room_id
LEFT JOIN realtime_connections c ON rm.user_id = c.user_id AND c.status = 'connected'
WHERE r.is_active = TRUE
GROUP BY r.id, r.name, r.type, r.created_at
ORDER BY active_connections DESC, member_count DESC;

-- Current typing indicators (non-expired)
CREATE OR REPLACE VIEW realtime_current_typing AS
SELECT
    t.room_id,
    r.name AS room_name,
    t.user_id,
    t.thread_id,
    t.started_at,
    t.expires_at
FROM realtime_typing t
JOIN realtime_rooms r ON t.room_id = r.id
WHERE t.expires_at > NOW()
ORDER BY t.started_at DESC;

-- User presence summary
CREATE OR REPLACE VIEW realtime_presence_summary AS
SELECT
    status,
    COUNT(*) AS user_count,
    COUNT(CASE WHEN last_heartbeat > NOW() - INTERVAL '1 minute' THEN 1 END) AS recent_activity
FROM realtime_presence
GROUP BY status
ORDER BY user_count DESC;

-- =============================================================================
-- Functions for automatic cleanup
-- =============================================================================

-- Clean up expired typing indicators
CREATE OR REPLACE FUNCTION cleanup_expired_typing()
RETURNS void AS $$
BEGIN
    DELETE FROM realtime_typing
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update presence status based on activity
CREATE OR REPLACE FUNCTION update_presence_from_activity()
RETURNS void AS $$
BEGIN
    -- Set users to 'away' if inactive for 5 minutes
    UPDATE realtime_presence
    SET status = 'away', updated_at = NOW()
    WHERE status = 'online'
      AND last_active < NOW() - INTERVAL '5 minutes'
      AND last_active > NOW() - INTERVAL '30 minutes';

    -- Set users to 'offline' if inactive for 30 minutes
    UPDATE realtime_presence
    SET status = 'offline', updated_at = NOW()
    WHERE status IN ('online', 'away')
      AND last_active < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Disconnect stale connections
CREATE OR REPLACE FUNCTION disconnect_stale_connections()
RETURNS void AS $$
BEGIN
    UPDATE realtime_connections
    SET status = 'disconnected', disconnected_at = NOW()
    WHERE status = 'connected'
      AND last_pong < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update room updated_at timestamp
CREATE OR REPLACE FUNCTION update_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_timestamp
BEFORE UPDATE ON realtime_rooms
FOR EACH ROW
EXECUTE FUNCTION update_room_timestamp();

-- Update presence timestamp
CREATE OR REPLACE FUNCTION update_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_presence_timestamp
BEFORE UPDATE ON realtime_presence
FOR EACH ROW
EXECUTE FUNCTION update_presence_timestamp();
