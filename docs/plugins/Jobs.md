# Jobs Plugin

BullMQ-based background job queue with priorities, scheduling, retry logic, and BullBoard dashboard for nself.

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

The Jobs plugin provides a production-ready background job processing system built on BullMQ and Redis. It supports multiple queues, job priorities, cron scheduling, exponential backoff retries, and a BullBoard web dashboard for monitoring.

- **4 Database Tables** - Jobs, results, failures, schedules
- **6 Analytics Views** - Active jobs, failed details, queue stats, type stats, recent failures, scheduled overview
- **3 Queues** - default, high-priority, low-priority
- **4 Priority Levels** - critical, high, normal, low
- **5 Pre-built Job Types** - send-email, http-request, database-backup, file-cleanup, custom
- **BullBoard Dashboard** - Web UI for queue monitoring and management

### Pre-built Job Types

| Type | Description |
|------|-------------|
| `send-email` | Email sending with attachments and CC/BCC support |
| `http-request` | HTTP requests with configurable retry on specific status codes |
| `database-backup` | PostgreSQL backup with optional compression and encryption |
| `file-cleanup` | Clean up completed/failed jobs or old files |
| `custom` | Custom jobs via Hasura Actions for business logic |

---

## Quick Start

```bash
# Install the plugin
nself plugin install jobs

# Configure environment
cp .env.example .env
# Edit .env with Redis URL

# Initialize and verify
nself plugin jobs init

# Start the BullBoard dashboard
nself plugin jobs server

# Start the worker (in another terminal)
nself plugin jobs worker
```

Visit the dashboard at `http://localhost:3105/dashboard`.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JOBS_REDIS_URL` | Yes | - | Redis connection string |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JOBS_DASHBOARD_ENABLED` | No | `true` | Enable BullBoard web dashboard |
| `JOBS_DASHBOARD_PORT` | No | `3105` | Dashboard HTTP port |
| `JOBS_DASHBOARD_PATH` | No | `/dashboard` | Dashboard URL path |
| `JOBS_DEFAULT_CONCURRENCY` | No | `5` | Jobs processed simultaneously per worker |
| `JOBS_RETRY_ATTEMPTS` | No | `3` | Maximum retry attempts |
| `JOBS_RETRY_DELAY` | No | `5000` | Initial retry delay in milliseconds |
| `JOBS_JOB_TIMEOUT` | No | `60000` | Job timeout in milliseconds |
| `JOBS_CLEAN_COMPLETED_AFTER` | No | `86400000` | Remove completed jobs after (ms, default 24h) |
| `JOBS_CLEAN_FAILED_AFTER` | No | `604800000` | Remove failed jobs after (ms, default 7 days) |

### Example .env File

```bash
# Required
JOBS_REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://nself:password@localhost:5432/nself

# Dashboard
JOBS_DASHBOARD_ENABLED=true
JOBS_DASHBOARD_PORT=3105

# Worker
JOBS_DEFAULT_CONCURRENCY=5
JOBS_RETRY_ATTEMPTS=3
JOBS_RETRY_DELAY=5000
JOBS_JOB_TIMEOUT=60000
```

---

## CLI Commands

### Plugin Management

```bash
# Initialize and verify Redis, database, and configuration
nself plugin jobs init

# View job statistics
nself plugin jobs stats

# Queue-specific stats
nself plugin jobs stats --queue default

# Last 48 hours of stats
nself plugin jobs stats --time 48

# Performance metrics
nself plugin jobs stats --performance

# Watch mode (auto-refresh)
nself plugin jobs stats --watch
```

### Server & Worker

```bash
# Start BullBoard dashboard server
nself plugin jobs server

# Start worker for default queue
nself plugin jobs worker

# Start worker for specific queue
nself plugin jobs worker high-priority

# Start with custom concurrency
JOBS_DEFAULT_CONCURRENCY=10 nself plugin jobs worker
```

### Retry Management

```bash
# Retry up to 10 failed jobs
nself plugin jobs retry

# Retry from specific queue
nself plugin jobs retry --queue default --limit 20

# Retry specific job type
nself plugin jobs retry --type send-email

# Retry specific job by ID
nself plugin jobs retry --id <uuid>

# Show retryable jobs without retrying
nself plugin jobs retry --show
```

### Scheduled Jobs

```bash
# List all schedules
nself plugin jobs schedule list

# Show schedule details
nself plugin jobs schedule show <name>

# Create a scheduled job
nself plugin jobs schedule create \
  --name daily-backup \
  --type database-backup \
  --cron "0 2 * * *" \
  --payload '{"database": "production", "destination": "/backups"}' \
  --desc "Daily production database backup"

# Enable/disable a schedule
nself plugin jobs schedule enable <name>
nself plugin jobs schedule disable <name>

# Delete a schedule
nself plugin jobs schedule delete <name>
```

---

## REST API

The plugin exposes a REST API alongside the BullBoard dashboard.

### Base URL

```
http://localhost:3105
```

### Endpoints

#### Health Check

```http
GET /health
```
Returns server health status.

#### Create Job

```http
POST /api/jobs
Content-Type: application/json

{
  "type": "send-email",
  "queue": "default",
  "payload": {
    "to": "user@example.com",
    "subject": "Test",
    "body": "Hello!"
  },
  "options": {
    "priority": "high",
    "maxRetries": 3,
    "delay": 5000
  }
}
```

Creates a new job in the specified queue.

#### Get Job

```http
GET /api/jobs/:id
```
Returns job details including status, progress, result, and failure history.

#### Statistics

```http
GET /api/stats
```
Returns queue-level statistics: waiting, active, completed, failed, and delayed counts.

#### Dashboard

```http
GET /dashboard
```
BullBoard web UI for monitoring queues, inspecting jobs, retrying failures, and pausing/resuming queues.

---

## Webhook Events

N/A - internal service. The Jobs plugin processes background tasks internally. Job completion callbacks are handled through the BullMQ event system rather than external webhooks.

---

## Database Schema

### jobs

Core job metadata and status tracking.

```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    type VARCHAR(100) NOT NULL,            -- send-email, http-request, etc.
    queue VARCHAR(100) DEFAULT 'default',
    status VARCHAR(50) NOT NULL,           -- pending, active, completed, failed, delayed
    priority INTEGER DEFAULT 0,
    payload JSONB NOT NULL,
    progress INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    delay_ms BIGINT DEFAULT 0,
    timeout_ms BIGINT DEFAULT 60000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_queue ON jobs(queue);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);
```

### job_results

Successful job outputs.

```sql
CREATE TABLE job_results (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    result JSONB,
    duration_ms INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_results_job ON job_results(job_id);
```

### job_failures

Failed job attempts with stack traces.

```sql
CREATE TABLE job_failures (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    attempt_number INTEGER NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_failures_job ON job_failures(job_id);
CREATE INDEX idx_job_failures_failed ON job_failures(failed_at DESC);
```

### job_schedules

Cron-based recurring job definitions.

```sql
CREATE TABLE job_schedules (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    queue VARCHAR(100) DEFAULT 'default',
    cron_expression VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_schedules_enabled ON job_schedules(enabled);
CREATE INDEX idx_job_schedules_next ON job_schedules(next_run_at);
```

---

## Analytics Views

### jobs_active

Currently running jobs.

```sql
CREATE VIEW jobs_active AS
SELECT id, type, queue, priority, payload, started_at, attempts
FROM jobs
WHERE status = 'active'
ORDER BY started_at ASC;
```

### jobs_failed_details

Failed jobs with error details.

```sql
CREATE VIEW jobs_failed_details AS
SELECT
    j.id, j.type, j.queue, j.attempts, j.max_attempts,
    f.error_message, f.error_stack, f.failed_at
FROM jobs j
JOIN job_failures f ON j.id = f.job_id
WHERE j.status = 'failed'
ORDER BY f.failed_at DESC;
```

### queue_stats

Queue-level statistics.

```sql
CREATE VIEW queue_stats AS
SELECT
    queue,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE status = 'delayed') AS delayed
FROM jobs
GROUP BY queue;
```

### job_type_stats

Job statistics grouped by type.

```sql
CREATE VIEW job_type_stats AS
SELECT
    type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    AVG(r.duration_ms) AS avg_duration_ms
FROM jobs j
LEFT JOIN job_results r ON j.id = r.job_id
GROUP BY type
ORDER BY total DESC;
```

### recent_failures

Failures from the last 24 hours.

```sql
CREATE VIEW recent_failures AS
SELECT j.id, j.type, j.queue, f.error_message, f.failed_at
FROM jobs j
JOIN job_failures f ON j.id = f.job_id
WHERE f.failed_at > NOW() - INTERVAL '24 hours'
ORDER BY f.failed_at DESC;
```

### scheduled_jobs_overview

Overview of all scheduled recurring jobs.

```sql
CREATE VIEW scheduled_jobs_overview AS
SELECT name, type, queue, cron_expression, description, enabled, last_run_at, next_run_at
FROM job_schedules
ORDER BY enabled DESC, next_run_at ASC;
```

---

## Troubleshooting

### Common Issues

#### "Redis Connection Issues"

```
Error: Redis connection to localhost:6379 failed
```

**Solutions:**
1. Test Redis: `redis-cli -h localhost -p 6379 ping`
2. Verify `JOBS_REDIS_URL` in `.env`

#### "Database Issues"

```
Error: relation "jobs" does not exist
```

**Solution:** Initialize the database schema.

```bash
nself plugin jobs init
```

#### "Jobs Not Processing"

**Solutions:**
1. Check if worker is running: `ps aux | grep "nself plugin jobs worker"`
2. Check worker logs: `tail -f ~/.nself/logs/plugins/jobs/worker.log`
3. Verify queue has jobs: `redis-cli llen bull:default:waiting`

#### "Failed Jobs Not Retrying"

**Solutions:**
1. Check retry configuration: `nself plugin jobs stats`
2. View retryable jobs: `nself plugin jobs retry --show`
3. Manual retry: `nself plugin jobs retry --limit 50`

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug nself plugin jobs worker
```

### Health Checks

```bash
# Check server health
curl http://localhost:3105/health

# Check statistics
curl http://localhost:3105/api/stats

# View dashboard
open http://localhost:3105/dashboard
```

---

## Support

- **GitHub Issues:** [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)

---

*Last Updated: January 2026*
*Plugin Version: 1.0.0*
