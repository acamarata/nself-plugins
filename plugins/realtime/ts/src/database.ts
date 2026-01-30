/**
 * Database operations for realtime plugin
 */

import pg from 'pg';
import type {
  Connection,
  Room,
  RoomMember,
  Presence,
  TypingIndicator,
  RealtimeEvent,
  DeviceInfo,
} from './types.js';

const { Pool } = pg;

export class Database {
  private pool: pg.Pool;

  constructor(config?: { host?: string; port?: number; database?: string; user?: string; password?: string; ssl?: boolean }) {
    const dbConfig = config ?? {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      database: process.env.POSTGRES_DB ?? 'nself',
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? '',
      ssl: process.env.POSTGRES_SSL === 'true',
    };

    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] || null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // -------------------------------------------------------------------------
  // Connections
  // -------------------------------------------------------------------------

  async createConnection(data: {
    socketId: string;
    userId?: string;
    sessionId?: string;
    transport: 'websocket' | 'polling';
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: DeviceInfo;
  }): Promise<Connection> {
    const result = await this.query<Connection>(
      `INSERT INTO realtime_connections (
        socket_id, user_id, session_id, status, transport,
        ip_address, user_agent, device_info
      ) VALUES ($1, $2, $3, 'connected', $4, $5, $6, $7)
      RETURNING *`,
      [
        data.socketId,
        data.userId || null,
        data.sessionId || null,
        data.transport,
        data.ipAddress || null,
        data.userAgent || null,
        data.deviceInfo ? JSON.stringify(data.deviceInfo) : null,
      ]
    );
    return result[0];
  }

  async updateConnection(socketId: string, data: Partial<Connection>): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.latency_ms !== undefined) {
      updates.push(`latency_ms = $${paramIndex++}`);
      values.push(data.latency_ms);
    }
    if (data.user_id !== undefined) {
      updates.push(`user_id = $${paramIndex++}`);
      values.push(data.user_id);
    }

    if (updates.length === 0) return;

    values.push(socketId);
    await this.query(
      `UPDATE realtime_connections SET ${updates.join(', ')} WHERE socket_id = $${paramIndex}`,
      values
    );
  }

  async disconnectConnection(socketId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_connections
       SET status = 'disconnected', disconnected_at = NOW()
       WHERE socket_id = $1`,
      [socketId]
    );
  }

  async updatePing(socketId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_connections SET last_ping = NOW() WHERE socket_id = $1`,
      [socketId]
    );
  }

  async updatePong(socketId: string, latencyMs: number): Promise<void> {
    await this.query(
      `UPDATE realtime_connections
       SET last_pong = NOW(), latency_ms = $2
       WHERE socket_id = $1`,
      [socketId, latencyMs]
    );
  }

  async getActiveConnections(): Promise<Connection[]> {
    return this.query<Connection>(
      `SELECT * FROM realtime_connections WHERE status = 'connected'`
    );
  }

  async getConnectionCount(): Promise<number> {
    const result = await this.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM realtime_connections WHERE status = 'connected'`
    );
    return parseInt(result?.count || '0', 10);
  }

  // -------------------------------------------------------------------------
  // Rooms
  // -------------------------------------------------------------------------

  async createRoom(data: {
    name: string;
    type?: string;
    visibility?: string;
    maxMembers?: number;
  }): Promise<Room> {
    const result = await this.query<Room>(
      `INSERT INTO realtime_rooms (name, type, visibility, max_members)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [data.name, data.type || 'channel', data.visibility || 'public', data.maxMembers || null]
    );
    return result[0];
  }

  async getRoomByName(name: string): Promise<Room | null> {
    return this.queryOne<Room>(
      `SELECT * FROM realtime_rooms WHERE name = $1 AND is_active = TRUE`,
      [name]
    );
  }

  async getRoomById(id: string): Promise<Room | null> {
    return this.queryOne<Room>(
      `SELECT * FROM realtime_rooms WHERE id = $1 AND is_active = TRUE`,
      [id]
    );
  }

  async getAllRooms(): Promise<Room[]> {
    return this.query<Room>(`SELECT * FROM realtime_rooms WHERE is_active = TRUE`);
  }

  async deleteRoom(name: string): Promise<void> {
    await this.query(`UPDATE realtime_rooms SET is_active = FALSE WHERE name = $1`, [name]);
  }

  // -------------------------------------------------------------------------
  // Room Members
  // -------------------------------------------------------------------------

  async addRoomMember(roomId: string, userId: string, role: string = 'member'): Promise<void> {
    await this.query(
      `INSERT INTO realtime_room_members (room_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = NOW()`,
      [roomId, userId, role]
    );
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    await this.query(
      `DELETE FROM realtime_room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    return this.query<RoomMember>(
      `SELECT * FROM realtime_room_members WHERE room_id = $1`,
      [roomId]
    );
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    return this.query<Room>(
      `SELECT r.* FROM realtime_rooms r
       JOIN realtime_room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1 AND r.is_active = TRUE`,
      [userId]
    );
  }

  async updateMemberLastSeen(roomId: string, userId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_room_members SET last_seen = NOW()
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  }

  // -------------------------------------------------------------------------
  // Presence
  // -------------------------------------------------------------------------

  async upsertPresence(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    customStatus?: { text: string; emoji?: string; expiresAt?: Date }
  ): Promise<Presence> {
    const result = await this.query<Presence>(
      `INSERT INTO realtime_presence (
        user_id, status, custom_status, custom_emoji, expires_at, last_heartbeat
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        status = $2,
        custom_status = $3,
        custom_emoji = $4,
        expires_at = $5,
        last_heartbeat = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        status,
        customStatus?.text || null,
        customStatus?.emoji || null,
        customStatus?.expiresAt || null,
      ]
    );
    return result[0];
  }

  async updatePresenceHeartbeat(userId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_presence
       SET last_heartbeat = NOW(), last_active = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  async incrementConnectionCount(userId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_presence
       SET connections_count = connections_count + 1, status = 'online'
       WHERE user_id = $1`,
      [userId]
    );
  }

  async decrementConnectionCount(userId: string): Promise<void> {
    await this.query(
      `UPDATE realtime_presence
       SET connections_count = GREATEST(connections_count - 1, 0)
       WHERE user_id = $1`,
      [userId]
    );
  }

  async getPresence(userId: string): Promise<Presence | null> {
    return this.queryOne<Presence>(
      `SELECT * FROM realtime_presence WHERE user_id = $1`,
      [userId]
    );
  }

  async getAllPresence(): Promise<Presence[]> {
    return this.query<Presence>(`SELECT * FROM realtime_presence`);
  }

  // -------------------------------------------------------------------------
  // Typing Indicators
  // -------------------------------------------------------------------------

  async setTyping(roomId: string, userId: string, threadId?: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 3000); // 3 seconds
    await this.query(
      `INSERT INTO realtime_typing (room_id, user_id, thread_id, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_id, user_id, thread_id) DO UPDATE
       SET started_at = NOW(), expires_at = $4`,
      [roomId, userId, threadId || null, expiresAt]
    );
  }

  async clearTyping(roomId: string, userId: string, threadId?: string): Promise<void> {
    await this.query(
      `DELETE FROM realtime_typing
       WHERE room_id = $1 AND user_id = $2 AND thread_id IS NOT DISTINCT FROM $3`,
      [roomId, userId, threadId || null]
    );
  }

  async getTypingUsers(roomId: string, threadId?: string): Promise<TypingIndicator[]> {
    return this.query<TypingIndicator>(
      `SELECT * FROM realtime_typing
       WHERE room_id = $1 AND thread_id IS NOT DISTINCT FROM $2 AND expires_at > NOW()`,
      [roomId, threadId || null]
    );
  }

  async cleanExpiredTyping(): Promise<void> {
    await this.query(`DELETE FROM realtime_typing WHERE expires_at < NOW()`);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  async logEvent(data: {
    eventType: string;
    socketId?: string;
    userId?: string;
    roomId?: string;
    payload?: unknown;
    ipAddress?: string;
  }): Promise<void> {
    await this.query(
      `INSERT INTO realtime_events (
        event_type, socket_id, user_id, room_id, payload, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.eventType,
        data.socketId || null,
        data.userId || null,
        data.roomId || null,
        data.payload ? JSON.stringify(data.payload) : null,
        data.ipAddress || null,
      ]
    );
  }

  async getRecentEvents(limit: number = 100): Promise<RealtimeEvent[]> {
    return this.query<RealtimeEvent>(
      `SELECT * FROM realtime_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  async getStats(): Promise<{
    connections: number;
    authenticatedConnections: number;
    rooms: number;
    presence: { online: number; away: number; busy: number; offline: number };
    eventsLastHour: number;
  }> {
    const [connections, authenticated, rooms, presence, events] = await Promise.all([
      this.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM realtime_connections WHERE status = 'connected'`
      ),
      this.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM realtime_connections
         WHERE status = 'connected' AND user_id IS NOT NULL`
      ),
      this.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM realtime_rooms WHERE is_active = TRUE`
      ),
      this.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM realtime_presence GROUP BY status`
      ),
      this.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM realtime_events
         WHERE created_at > NOW() - INTERVAL '1 hour'`
      ),
    ]);

    const presenceMap = presence.reduce((acc, p) => {
      acc[p.status as keyof typeof acc] = parseInt(p.count, 10);
      return acc;
    }, { online: 0, away: 0, busy: 0, offline: 0 });

    return {
      connections: parseInt(connections?.count || '0', 10),
      authenticatedConnections: parseInt(authenticated?.count || '0', 10),
      rooms: parseInt(rooms?.count || '0', 10),
      presence: presenceMap,
      eventsLastHour: parseInt(events?.count || '0', 10),
    };
  }
}
