/**
 * Database client for notification operations
 */

import { Pool, PoolClient } from 'pg';
import { config } from './config.js';
import {
  Notification,
  NotificationTemplate,
  NotificationPreference,
  NotificationProvider,
  QueueItem,
  CreateNotificationInput,
} from './types.js';

export class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // =============================================================================
  // Templates
  // =============================================================================

  async getTemplate(name: string): Promise<NotificationTemplate | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM notification_templates WHERE name = $1 AND active = true',
        [name]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM notification_templates WHERE active = true ORDER BY category, name'
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // =============================================================================
  // Notifications
  // =============================================================================

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO notification_messages (
          user_id, template_name, channel, category,
          recipient_email, recipient_phone, recipient_push_token,
          subject, body_text, body_html, priority,
          scheduled_at, metadata, tags, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
        RETURNING *`,
        [
          input.user_id,
          input.template_name,
          input.channel,
          input.category || 'transactional',
          input.recipient_email,
          input.recipient_phone,
          input.recipient_push_token,
          input.subject,
          input.body_text,
          input.body_html,
          input.priority || 5,
          input.scheduled_at,
          JSON.stringify(input.metadata || {}),
          JSON.stringify(input.tags || []),
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getNotification(id: string): Promise<Notification | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM notification_messages WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateNotificationStatus(
    id: string,
    status: string,
    updates: Partial<Notification> = {}
  ): Promise<void> {
    const client = await this.getClient();
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);

      let query = 'UPDATE notification_messages SET status = $1, updated_at = NOW()';
      const params: any[] = [status];

      fields.forEach((field, index) => {
        query += `, ${field} = $${index + 2}`;
        params.push(values[index]);
      });

      query += ' WHERE id = $' + (params.length + 1);
      params.push(id);

      await client.query(query, params);
    } finally {
      client.release();
    }
  }

  // =============================================================================
  // Queue
  // =============================================================================

  async addToQueue(notificationId: string, priority: number = 5): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `INSERT INTO notification_queue (notification_id, status, priority, next_attempt_at)
         VALUES ($1, 'pending', $2, NOW())
         ON CONFLICT (notification_id) DO NOTHING`,
        [notificationId, priority]
      );
    } finally {
      client.release();
    }
  }

  async getNextQueueItem(): Promise<QueueItem | null> {
    const client = await this.getClient();
    try {
      // Get and lock the next pending item
      const result = await client.query(
        `UPDATE notification_queue
         SET status = 'processing', processing_started_at = NOW(), updated_at = NOW()
         WHERE id = (
           SELECT id FROM notification_queue
           WHERE status = 'pending'
             AND next_attempt_at <= NOW()
             AND attempts < max_attempts
           ORDER BY priority ASC, next_attempt_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateQueueItem(id: string, status: string, error?: string): Promise<void> {
    const client = await this.getClient();
    try {
      if (status === 'completed') {
        await client.query(
          `UPDATE notification_queue
           SET status = $1, processing_completed_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [status, id]
        );
      } else if (status === 'failed') {
        await client.query(
          `UPDATE notification_queue
           SET status = 'pending',
               attempts = attempts + 1,
               last_error = $1,
               next_attempt_at = NOW() + (attempts * interval '1 second'),
               updated_at = NOW()
           WHERE id = $2`,
          [error, id]
        );
      }
    } finally {
      client.release();
    }
  }

  // =============================================================================
  // Preferences
  // =============================================================================

  async getUserPreference(
    userId: string,
    channel: string,
    category: string
  ): Promise<NotificationPreference | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM notification_preferences
         WHERE user_id = $1 AND channel = $2 AND category = $3`,
        [userId, channel, category]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async checkUserCanReceive(
    userId: string,
    channel: string,
    category: string
  ): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT get_user_notification_preference($1, $2, $3) AS enabled`,
        [userId, channel, category]
      );
      return result.rows[0]?.enabled || true;
    } finally {
      client.release();
    }
  }

  async checkRateLimit(
    userId: string,
    channel: string,
    windowSeconds: number,
    maxCount: number
  ): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT check_notification_rate_limit($1, $2, $3, $4) AS allowed`,
        [userId, channel, windowSeconds, maxCount]
      );
      return result.rows[0]?.allowed || false;
    } finally {
      client.release();
    }
  }

  // =============================================================================
  // Providers
  // =============================================================================

  async getEnabledProviders(type: string): Promise<NotificationProvider[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM notification_providers
         WHERE type = $1 AND enabled = true
         ORDER BY priority ASC`,
        [type]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateProviderHealth(
    name: string,
    success: boolean,
    response?: any
  ): Promise<void> {
    const client = await this.getClient();
    try {
      if (success) {
        await client.query(
          `UPDATE notification_providers
           SET success_count = success_count + 1,
               last_success_at = NOW(),
               health_status = 'healthy',
               updated_at = NOW()
           WHERE name = $1`,
          [name]
        );
      } else {
        await client.query(
          `UPDATE notification_providers
           SET failure_count = failure_count + 1,
               last_failure_at = NOW(),
               health_status = CASE
                 WHEN failure_count > 10 THEN 'unhealthy'
                 WHEN failure_count > 5 THEN 'degraded'
                 ELSE health_status
               END,
               updated_at = NOW()
           WHERE name = $1`,
          [name]
        );
      }
    } finally {
      client.release();
    }
  }

  // =============================================================================
  // Statistics
  // =============================================================================

  async getDeliveryStats(days: number = 7): Promise<any[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM notification_delivery_rates
         WHERE date >= NOW() - INTERVAL '1 day' * $1
         ORDER BY date DESC`,
        [days]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getEngagementStats(days: number = 7): Promise<any[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM notification_engagement
         WHERE date >= NOW() - INTERVAL '1 day' * $1
         ORDER BY date DESC`,
        [days]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
export const db = new DatabaseClient();
