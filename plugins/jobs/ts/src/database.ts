/**
 * Database Module
 * PostgreSQL integration for job persistence and tracking
 */

import pkg from 'pg';
const { Pool } = pkg;
import { createLogger } from '@nself/plugin-utils';
import type { JobsConfig, JobRecord, JobResultRecord, JobFailureRecord, JobScheduleRecord } from './types.js';

const logger = createLogger('jobs:database');

export class JobsDatabase {
  private pool: InstanceType<typeof Pool>;
  private config: JobsConfig;

  constructor(config: JobsConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  // Job operations
  async createJob(job: Partial<JobRecord>): Promise<JobRecord> {
    const result = await this.query<JobRecord>(
      `INSERT INTO jobs_tasks (
        bullmq_id, queue_name, job_type, priority, status, payload, options,
        scheduled_for, retry_count, max_retries, retry_delay, metadata, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        job.bullmq_id,
        job.queue_name,
        job.job_type,
        job.priority,
        job.status || 'waiting',
        JSON.stringify(job.payload || {}),
        JSON.stringify(job.options || {}),
        job.scheduled_for,
        job.retry_count || 0,
        job.max_retries || this.config.retryAttempts,
        job.retry_delay || this.config.retryDelay,
        JSON.stringify(job.metadata || {}),
        job.tags || [],
      ]
    );
    return result[0];
  }

  async updateJobStatus(jobId: string, status: string, extra?: Partial<JobRecord>): Promise<void> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [jobId, status];
    let paramIndex = 3;

    if (extra?.progress !== undefined) {
      updates.push(`progress = $${paramIndex++}`);
      params.push(extra.progress);
    }

    if (extra?.worker_id !== undefined) {
      updates.push(`worker_id = $${paramIndex++}`);
      params.push(extra.worker_id);
    }

    if (extra?.process_id !== undefined) {
      updates.push(`process_id = $${paramIndex++}`);
      params.push(extra.process_id);
    }

    await this.query(
      `UPDATE jobs_tasks SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }

  async getJobByBullMQId(bullmqId: string): Promise<JobRecord | null> {
    const result = await this.query<JobRecord>(
      'SELECT * FROM jobs_tasks WHERE bullmq_id = $1',
      [bullmqId]
    );
    return result[0] || null;
  }

  async saveJobResult(jobId: string, result: unknown, durationMs: number): Promise<void> {
    await this.query(
      `INSERT INTO job_results (job_id, result, duration_ms)
       VALUES ($1, $2, $3)`,
      [jobId, JSON.stringify(result), durationMs]
    );
  }

  async saveJobFailure(
    jobId: string,
    error: Error,
    attemptNumber: number,
    willRetry: boolean,
    retryAt?: Date
  ): Promise<void> {
    await this.query(
      `INSERT INTO job_failures (
        job_id, error_message, error_stack, attempt_number, will_retry, retry_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [jobId, error.message, error.stack || null, attemptNumber, willRetry, retryAt || null]
    );
  }

  async incrementRetryCount(jobId: string): Promise<void> {
    await this.query(
      'UPDATE jobs_tasks SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1',
      [jobId]
    );
  }

  // Schedule operations
  async createSchedule(schedule: Partial<JobScheduleRecord>): Promise<JobScheduleRecord> {
    const result = await this.query<JobScheduleRecord>(
      `INSERT INTO job_schedules (
        name, description, job_type, queue_name, payload, options,
        cron_expression, timezone, enabled, max_runs, end_date, metadata, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        schedule.name,
        schedule.description || null,
        schedule.job_type,
        schedule.queue_name || 'default',
        JSON.stringify(schedule.payload || {}),
        JSON.stringify(schedule.options || {}),
        schedule.cron_expression,
        schedule.timezone || 'UTC',
        schedule.enabled !== false,
        schedule.max_runs || null,
        schedule.end_date || null,
        JSON.stringify(schedule.metadata || {}),
        schedule.tags || [],
      ]
    );
    return result[0];
  }

  async getSchedules(enabled?: boolean): Promise<JobScheduleRecord[]> {
    if (enabled !== undefined) {
      return this.query<JobScheduleRecord>(
        'SELECT * FROM job_schedules WHERE enabled = $1 ORDER BY next_run_at',
        [enabled]
      );
    }
    return this.query<JobScheduleRecord>('SELECT * FROM job_schedules ORDER BY next_run_at');
  }

  async updateScheduleRun(scheduleId: string, jobId: string): Promise<void> {
    await this.query(
      `UPDATE job_schedules SET
        last_run_at = NOW(),
        last_job_id = $2,
        total_runs = total_runs + 1,
        updated_at = NOW()
       WHERE id = $1`,
      [scheduleId, jobId]
    );
  }

  async updateScheduleSuccess(scheduleId: string): Promise<void> {
    await this.query(
      'UPDATE job_schedules SET successful_runs = successful_runs + 1 WHERE id = $1',
      [scheduleId]
    );
  }

  async updateScheduleFailure(scheduleId: string): Promise<void> {
    await this.query(
      'UPDATE job_schedules SET failed_runs = failed_runs + 1 WHERE id = $1',
      [scheduleId]
    );
  }

  async updateNextRun(scheduleId: string, nextRun: Date): Promise<void> {
    await this.query(
      'UPDATE job_schedules SET next_run_at = $2 WHERE id = $1',
      [scheduleId, nextRun]
    );
  }

  // Stats
  async getStats() {
    const [queueStats, typeStats, counts] = await Promise.all([
      this.query('SELECT * FROM queue_stats ORDER BY queue_name'),
      this.query('SELECT * FROM job_type_stats ORDER BY total_jobs DESC LIMIT 20'),
      this.query<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        total: number;
      }>(`SELECT
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM jobs_tasks`),
    ]);

    return {
      ...counts[0],
      queues: queueStats,
      job_types: typeStats,
    };
  }
}
