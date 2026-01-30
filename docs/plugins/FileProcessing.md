# File Processing Plugin

Comprehensive file processing with thumbnail generation, image optimization, video thumbnails, and virus scanning for nself.

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

The File Processing plugin provides a BullMQ-powered background processing pipeline for files. It generates thumbnails, optimizes images, extracts metadata, strips EXIF data, and scans for viruses. It works with any S3-compatible storage provider.

- **4 Database Tables** - Jobs, thumbnails, scans, metadata
- **5 Analytics Views** - Queue status, failures, security alerts, processing stats, thumbnail stats
- **6 Storage Providers** - MinIO, AWS S3, Google Cloud Storage, Cloudflare R2, Azure Blob, Backblaze B2
- **5 Processing Operations** - Thumbnail generation, image optimization, EXIF stripping, virus scanning, metadata extraction
- **Queue Processing** - BullMQ-powered background processing with configurable concurrency

### Processing Operations

| Operation | Description |
|-----------|-------------|
| Thumbnail Generation | Multiple sizes (100x100, 400x400, 1200x1200) via Sharp and ffmpeg |
| Image Optimization | Compress and optimize with quality control and progressive encoding |
| EXIF Stripping | Remove GPS, camera, software, and timestamp metadata |
| Virus Scanning | ClamAV-based malware detection with quarantine support |
| Metadata Extraction | Extract dimensions, codecs, duration, EXIF data |

---

## Quick Start

```bash
# Install the plugin
cd plugins/file-processing
./install.sh

# Configure environment
cp .env.example .env
# Edit .env with storage and database credentials

# Initialize database schema
nself plugin file-processing init

# Start the HTTP server (Terminal 1)
nself plugin file-processing server

# Start the background worker (Terminal 2)
nself plugin file-processing worker
```

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (for queue management)
- Sharp (installed via npm)
- ffmpeg (optional, for video thumbnails)
- ClamAV (optional, for virus scanning)

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `FILE_STORAGE_PROVIDER` | Yes | - | Storage provider (minio, s3, gcs, r2, azure, b2) |
| `FILE_STORAGE_BUCKET` | Yes | - | Storage bucket name |
| `FILE_STORAGE_ENDPOINT` | No | - | Storage endpoint URL (required for MinIO, R2, B2) |
| `FILE_STORAGE_ACCESS_KEY` | No | - | Storage access key |
| `FILE_STORAGE_SECRET_KEY` | No | - | Storage secret key |
| `FILE_STORAGE_REGION` | No | `us-east-1` | Storage region |
| `FILE_THUMBNAIL_SIZES` | No | `100,400,1200` | Comma-separated thumbnail sizes |
| `FILE_ENABLE_OPTIMIZATION` | No | `true` | Enable image optimization |
| `FILE_STRIP_EXIF` | No | `true` | Strip EXIF metadata from images |
| `FILE_MAX_SIZE` | No | `104857600` | Maximum file size in bytes (100MB) |
| `FILE_ENABLE_VIRUS_SCAN` | No | `false` | Enable ClamAV virus scanning |
| `CLAMAV_HOST` | No | `localhost` | ClamAV daemon host |
| `CLAMAV_PORT` | No | `3310` | ClamAV daemon port |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `FILE_QUEUE_CONCURRENCY` | No | `3` | Concurrent file processing jobs |
| `PORT` | No | `3104` | HTTP server port |
| `HOST` | No | `0.0.0.0` | Server bind host |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

### Storage Provider Configuration

**MinIO / S3-compatible:**
```bash
FILE_STORAGE_PROVIDER=minio
FILE_STORAGE_ENDPOINT=http://localhost:9000
FILE_STORAGE_ACCESS_KEY=minioadmin
FILE_STORAGE_SECRET_KEY=minioadmin
```

**AWS S3:**
```bash
FILE_STORAGE_PROVIDER=s3
FILE_STORAGE_REGION=us-east-1
FILE_STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
FILE_STORAGE_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Google Cloud Storage:**
```bash
FILE_STORAGE_PROVIDER=gcs
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Cloudflare R2:**
```bash
FILE_STORAGE_PROVIDER=r2
FILE_STORAGE_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
FILE_STORAGE_ACCESS_KEY=your_r2_access_key
FILE_STORAGE_SECRET_KEY=your_r2_secret_key
```

**Azure Blob Storage:**
```bash
FILE_STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

**Backblaze B2:**
```bash
FILE_STORAGE_PROVIDER=b2
FILE_STORAGE_ENDPOINT=https://s3.us-west-000.backblazeb2.com
FILE_STORAGE_ACCESS_KEY=your_key_id
FILE_STORAGE_SECRET_KEY=your_application_key
```

---

## CLI Commands

### Plugin Management

```bash
# Initialize database schema
nself plugin file-processing init

# View processing statistics
nself plugin file-processing stats

# Clean up old jobs (default 30 days)
nself plugin file-processing cleanup [--days 30]
```

### Processing

```bash
# Process a file immediately
nself plugin file-processing process <file-id> <file-path>
```

### Server & Worker

```bash
# Start HTTP server
nself plugin file-processing server

# Start background worker
nself plugin file-processing worker
```

---

## REST API

The plugin exposes a REST API when the server is running.

### Base URL

```
http://localhost:3104
```

### Endpoints

#### Health Check

```http
GET /health
```
Returns server health status.

#### Create Processing Job

```http
POST /api/jobs
Content-Type: application/json

{
  "fileId": "file_123",
  "filePath": "uploads/photo.jpg",
  "fileName": "photo.jpg",
  "fileSize": 1024000,
  "mimeType": "image/jpeg",
  "operations": ["thumbnail", "optimize", "metadata"],
  "priority": 5,
  "webhookUrl": "https://myapp.com/webhooks/file-processed",
  "webhookSecret": "secret_key",
  "callbackData": { "userId": "user_123" }
}
```

Returns `{ jobId, status, estimatedDuration }`.

#### Get Job Status

```http
GET /api/jobs/:jobId
```
Returns job details including status, thumbnails, metadata, and scan results.

#### List Jobs

```http
GET /api/jobs?status=completed&limit=50&offset=0
```
List jobs with optional status filter and pagination.

#### Processing Statistics

```http
GET /api/stats
```
Returns counts by status (pending, processing, completed, failed), average duration, total processed, thumbnails generated, and storage used.

---

## Webhook Events

When a processing job completes, the plugin sends an HTTP POST to the configured `webhookUrl` with an `X-Signature` header (HMAC-SHA256) for verification.

### Webhook Payload

| Event | Description |
|-------|-------------|
| `job.completed` | File processing completed successfully |
| `job.failed` | File processing failed |

```json
{
  "event": "job.completed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "fileId": "file_123",
  "status": "completed",
  "thumbnails": [
    { "width": 100, "height": 100, "url": "https://storage/thumbnails/thumb_100.jpg" }
  ],
  "metadata": { "width": 3000, "height": 2000, "format": "JPEG" },
  "scan": { "clean": true },
  "optimization": { "originalSize": 1024000, "optimizedSize": 512000 },
  "durationMs": 2847,
  "callbackData": { "userId": "user_123" }
}
```

---

## Database Schema

### file_processing_jobs

Processing queue and job history.

```sql
CREATE TABLE file_processing_jobs (
    id UUID PRIMARY KEY,
    file_id VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(255),
    operations JSONB DEFAULT '[]',         -- ["thumbnail", "optimize", "metadata"]
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL,           -- pending, processing, completed, failed
    webhook_url TEXT,
    webhook_secret VARCHAR(255),
    callback_data JSONB,
    duration_ms INTEGER,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_file_processing_jobs_status ON file_processing_jobs(status);
CREATE INDEX idx_file_processing_jobs_file ON file_processing_jobs(file_id);
CREATE INDEX idx_file_processing_jobs_created ON file_processing_jobs(created_at DESC);
```

### file_thumbnails

Generated thumbnail metadata and URLs.

```sql
CREATE TABLE file_thumbnails (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES file_processing_jobs(id),
    file_id VARCHAR(255) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    format VARCHAR(50),                    -- jpeg, png, webp
    size BIGINT,
    url TEXT NOT NULL,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_thumbnails_job ON file_thumbnails(job_id);
CREATE INDEX idx_file_thumbnails_file ON file_thumbnails(file_id);
```

### file_scans

Virus scan results.

```sql
CREATE TABLE file_scans (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES file_processing_jobs(id),
    file_id VARCHAR(255) NOT NULL,
    clean BOOLEAN NOT NULL,
    threats JSONB DEFAULT '[]',
    scanner VARCHAR(50),                   -- clamav
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_scans_file ON file_scans(file_id);
CREATE INDEX idx_file_scans_clean ON file_scans(clean);
```

### file_metadata

Extracted EXIF and file metadata.

```sql
CREATE TABLE file_metadata (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES file_processing_jobs(id),
    file_id VARCHAR(255) NOT NULL,
    width INTEGER,
    height INTEGER,
    format VARCHAR(50),
    color_space VARCHAR(50),
    exif JSONB,
    gps JSONB,
    duration_seconds DECIMAL,
    codecs JSONB,
    frame_rate DECIMAL,
    exif_stripped BOOLEAN DEFAULT FALSE,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_metadata_file ON file_metadata(file_id);
```

---

## Analytics Views

### file_processing_queue

Pending jobs ordered by priority.

```sql
CREATE VIEW file_processing_queue AS
SELECT id, file_id, file_name, priority, operations, created_at
FROM file_processing_jobs
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC;
```

### file_processing_failures

Failed jobs requiring attention.

```sql
CREATE VIEW file_processing_failures AS
SELECT id, file_id, file_name, error, created_at, completed_at
FROM file_processing_jobs
WHERE status = 'failed'
ORDER BY completed_at DESC;
```

### file_security_alerts

Infected files detected by virus scanning.

```sql
CREATE VIEW file_security_alerts AS
SELECT s.file_id, s.threats, s.scanned_at, j.file_name, j.file_path
FROM file_scans s
JOIN file_processing_jobs j ON s.job_id = j.id
WHERE s.clean = FALSE
ORDER BY s.scanned_at DESC;
```

### file_processing_stats

Processing statistics aggregated by status.

```sql
CREATE VIEW file_processing_stats AS
SELECT
    status,
    COUNT(*) AS job_count,
    AVG(duration_ms) AS avg_duration_ms,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
FROM file_processing_jobs
GROUP BY status;
```

### thumbnail_generation_stats

Thumbnail generation statistics.

```sql
CREATE VIEW thumbnail_generation_stats AS
SELECT
    width,
    height,
    format,
    COUNT(*) AS count,
    AVG(size) AS avg_size
FROM file_thumbnails
GROUP BY width, height, format
ORDER BY count DESC;
```

---

## Troubleshooting

### Common Issues

#### "Sharp installation fails"

```
Error: sharp: Installation error
```

**Solution:** Force rebuild Sharp.

```bash
cd plugins/file-processing/ts
npm rebuild sharp
```

#### "ffmpeg not found"

```
Error: ffmpeg not found in PATH
```

**Solution:** Install ffmpeg.

```bash
# macOS
brew install ffmpeg

# Linux (Debian/Ubuntu)
sudo apt-get install ffmpeg

# Verify installation
which ffmpeg
```

#### "ClamAV not running"

```
Error: ECONNREFUSED connecting to ClamAV
```

**Solutions:**
1. Start ClamAV: `brew services start clamav` (macOS) or `sudo systemctl start clamav-daemon` (Linux)
2. Test connection: `telnet localhost 3310`
3. Disable scanning if not needed: `FILE_ENABLE_VIRUS_SCAN=false`

#### "Redis Connection Error"

```
Error: Redis connection to localhost:6379 failed
```

**Solution:** Verify Redis is running.

```bash
redis-cli ping
# Should return: PONG
```

#### "Database Connection Error"

```
Error: Connection refused
```

**Solutions:**
1. Verify PostgreSQL is running
2. Test connection: `psql $DATABASE_URL -c "SELECT 1"`
3. Check schema exists: `psql $DATABASE_URL -c "\dt file_*"`

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug nself plugin file-processing server
```

### Health Checks

```bash
# Check server health
curl http://localhost:3104/health

# Check processing stats
curl http://localhost:3104/api/stats
```

---

## Support

- **GitHub Issues:** [nself-plugins/issues](https://github.com/acamarata/nself-plugins/issues)

---

*Last Updated: January 2026*
*Plugin Version: 1.0.0*
