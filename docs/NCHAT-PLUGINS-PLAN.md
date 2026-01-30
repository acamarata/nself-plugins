# nself-chat Plugin Extraction Plan

**Date**: January 30, 2026
**Objective**: Extract 5 generic services from nself-chat into shareable nself plugins

---

## Plugins to Create

### 1. **idme** - ID.me Government Verification
**Port**: 3010
**Category**: authentication
**Description**: Government-grade identity verification for military, veterans, first responders, government employees, teachers, students, and nurses.

**Tables**:
- `idme_verifications` - User verification status
- `idme_groups` - Verification groups (military, veteran, etc.)
- `idme_badges` - Verification badges
- `idme_attributes` - User attributes (affiliation, branch, service era)

**Env Vars**:
- `IDME_CLIENT_ID` (required)
- `IDME_CLIENT_SECRET` (required)
- `IDME_REDIRECT_URI` (required)
- `IDME_SCOPES` (optional, default: openid,email,profile)
- `IDME_SANDBOX` (optional, default: false)

**Actions**:
- `init` - Initialize database schema
- `verify <user_id>` - Check user verification status
- `groups <user_id>` - List user's verification groups
- `test` - Test OAuth flow in sandbox

**Source**: nself-chat `src/lib/auth/providers/idme.ts` (330 lines)

---

### 2. **realtime** - Socket.io Real-Time Events
**Port**: 3101
**Category**: infrastructure
**Description**: Socket.io server with presence tracking, typing indicators, and room management. Scales horizontally with Redis adapter.

**Tables**:
- `realtime_connections` - Active WebSocket connections
- `realtime_rooms` - Chat rooms / channels
- `realtime_room_members` - Room membership
- `realtime_presence` - User presence (online/away/offline)
- `realtime_typing` - Typing indicators with expiration
- `realtime_events` - Event log for analytics

**Env Vars**:
- `REALTIME_PORT` (optional, default: 3101)
- `REALTIME_REDIS_URL` (required for multi-instance)
- `REALTIME_CORS_ORIGIN` (required)
- `REALTIME_MAX_CONNECTIONS` (optional, default: 10000)
- `REALTIME_PING_TIMEOUT` (optional, default: 60000)
- `REALTIME_PING_INTERVAL` (optional, default: 25000)

**Actions**:
- `init` - Initialize database schema
- `server` - Start Socket.io server
- `status` - Show connection statistics
- `rooms` - List active rooms
- `disconnect <socket_id>` - Force disconnect a socket

**Frontend SDK**: `@nself/realtime-client` npm package

**Source**: nself-chat `src/lib/socket/`, `src/lib/realtime/` (~80 event types)

---

### 3. **notifications** - Multi-Channel Notifications
**Port**: 3102
**Category**: infrastructure
**Description**: Send notifications via email, push, and SMS with template management, user preferences, delivery tracking, and retry logic.

**Tables**:
- `notification_templates` - Reusable templates with variables
- `notification_preferences` - User opt-in/out per channel/category
- `notifications` - Sent notifications log
- `notification_queue` - Delivery queue with retries
- `notification_providers` - Provider config (priority, credentials)
- `notification_batches` - Batch/digest tracking

**Env Vars**:
- `NOTIFICATIONS_EMAIL_ENABLED` (optional, default: true, uses nself email config)
- `NOTIFICATIONS_PUSH_PROVIDER` (optional: fcm, onesignal, webpush)
- `NOTIFICATIONS_PUSH_API_KEY` (required if push enabled)
- `NOTIFICATIONS_PUSH_SENDER_ID` (required for FCM)
- `NOTIFICATIONS_SMS_PROVIDER` (optional: twilio, plivo, sns)
- `NOTIFICATIONS_SMS_ACCOUNT_SID` (required if SMS via Twilio)
- `NOTIFICATIONS_SMS_AUTH_TOKEN` (required if SMS via Twilio)
- `NOTIFICATIONS_SMS_FROM` (required if SMS enabled)
- `NOTIFICATIONS_QUEUE_BACKEND` (optional: redis, postgres, default: redis)
- `NOTIFICATIONS_BATCH_INTERVAL` (optional, default: 86400 seconds)

**Actions**:
- `init` - Initialize database schema
- `server` - Start notification API server
- `worker` - Start delivery worker
- `template create` - Create notification template
- `template list` - List templates
- `test` - Send test notification
- `stats` - Show delivery statistics

**GraphQL Actions**:
- `sendNotification(userId, template, data)` - Send single notification
- `sendBulkNotifications(userIds, template, data)` - Send to multiple users

**Source**: nself-chat `src/lib/notifications/`

---

### 4. **file-processing** - File Thumbnails & Optimization
**Port**: 3104
**Category**: infrastructure
**Description**: Process uploaded files with thumbnail generation, image optimization, video thumbnails, virus scanning, and EXIF stripping. Works with existing MinIO/S3 storage.

**Tables**:
- `file_processing_jobs` - Processing queue
- `file_thumbnails` - Generated thumbnail metadata
- `file_scans` - Virus scan results
- `file_metadata` - EXIF and file metadata

**Env Vars**:
- `FILE_STORAGE_PROVIDER` (required: minio, s3, gcs, r2, b2, azure)
- `FILE_STORAGE_ENDPOINT` (required for MinIO/S3)
- `FILE_STORAGE_BUCKET` (required)
- `FILE_STORAGE_ACCESS_KEY` (required)
- `FILE_STORAGE_SECRET_KEY` (required)
- `FILE_THUMBNAIL_SIZES` (optional, default: 100x100,400x400,1200x1200)
- `FILE_ENABLE_VIRUS_SCAN` (optional, default: false)
- `FILE_ENABLE_OPTIMIZATION` (optional, default: true)
- `FILE_MAX_SIZE` (optional, default: 100MB)
- `FILE_ALLOWED_TYPES` (optional, default: image/*,video/*,application/pdf)

**Actions**:
- `init` - Initialize database schema
- `server` - Start file processing API
- `worker` - Start processing worker
- `process <file_id>` - Process a file
- `cleanup` - Remove orphaned files
- `scan` - Run virus scanner on all files
- `stats` - Show processing statistics

**Processing Pipeline**:
1. File upload triggers job creation
2. Worker picks up job
3. Generate thumbnails (AVIF, WebP, JPEG fallback)
4. Optimize images (compress, strip EXIF)
5. Virus scan (if enabled)
6. Update database with results

**Source**: nself-chat `src/lib/media/`, `src/lib/upload/`

---

### 5. **jobs** - Background Job Queue
**Port**: 3105
**Category**: infrastructure
**Description**: BullMQ-based background job queue with priorities, scheduling, retry logic, and BullBoard dashboard.

**Tables**:
- `jobs` - Job metadata
- `job_results` - Job outputs and errors
- `job_schedules` - Cron schedules
- `job_failures` - Failed job attempts

**Env Vars**:
- `JOBS_REDIS_URL` (required)
- `JOBS_DASHBOARD_ENABLED` (optional, default: true)
- `JOBS_DEFAULT_CONCURRENCY` (optional, default: 5)
- `JOBS_RETRY_ATTEMPTS` (optional, default: 3)
- `JOBS_RETRY_DELAY` (optional, default: 5000ms)
- `JOBS_JOB_TIMEOUT` (optional, default: 60000ms)

**Actions**:
- `init` - Initialize database schema
- `server` - Start API + BullBoard dashboard
- `worker <queue>` - Start job worker
- `schedule add` - Add cron schedule
- `schedule list` - List schedules
- `retry <job_id>` - Retry failed job
- `stats` - Show queue statistics

**Pre-Built Job Types**:
- `send-email` - Generic email sender
- `http-request` - HTTP webhook caller
- `database-backup` - Database backup runner
- `file-cleanup` - Orphaned file cleanup
- `cache-clear` - Cache clearing

**Custom Jobs**: Register via Hasura Actions (CS_1)

**Dashboard**: `http://localhost:3105/dashboard`

**Source**: nself-chat `src/lib/offline/`, analytics, moderation queues

---

## Plugin Structure (Each Plugin)

```
plugins/<name>/
├── plugin.json           # Manifest
├── README.md             # Documentation
├── install.sh            # Installation script
├── uninstall.sh          # Cleanup script
├── schema/
│   └── tables.sql        # Database schema
├── actions/
│   ├── init.sh           # Initialize database
│   ├── server.sh         # Start server
│   └── ...               # Plugin-specific actions
├── webhooks/             # (if applicable)
│   ├── handler.sh
│   └── events/
└── ts/                   # TypeScript implementation
    ├── src/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── client.ts     # External API client (if needed)
    │   ├── database.ts   # Database operations
    │   ├── server.ts     # Fastify/Hono HTTP server
    │   ├── cli.ts        # CLI commands
    │   └── config.ts     # Configuration
    ├── package.json
    ├── tsconfig.json
    └── .env.example
```

---

## Implementation Order

### Phase 1: Infrastructure Plugins (Week 1)
1. **realtime** - Most requested, used by 80% of real-time apps
2. **file-processing** - Critical for any app with uploads
3. **jobs** - Foundation for async work

### Phase 2: Communication Plugins (Week 2)
4. **notifications** - Every app needs notifications
5. **idme** - Specialized but complete implementation exists

---

## Testing Strategy

Each plugin will include:

1. **Unit Tests** (`ts/src/__tests__/`)
   - Service logic
   - Database operations
   - API endpoints

2. **Integration Tests**
   - End-to-end workflow
   - Multi-instance scaling (realtime, jobs)
   - Failure scenarios

3. **Example App** (`examples/<name>-demo/`)
   - Minimal Next.js app demonstrating usage
   - Shows all features
   - Can be deployed to Vercel

---

## Documentation

Each plugin README.md includes:

1. **Quick Start** - Install, configure, run in 5 minutes
2. **Configuration** - All env vars with descriptions
3. **Database Schema** - Table descriptions
4. **API Reference** - All endpoints with examples
5. **CLI Commands** - All actions with examples
6. **Frontend Integration** - How to use from Next.js/React
7. **Deployment** - Production considerations
8. **Troubleshooting** - Common issues

---

## Success Criteria

Each plugin must:

1. ✅ Install with `nself plugin install <name>`
2. ✅ Work with just env var configuration (no code changes)
3. ✅ Include complete TypeScript implementation
4. ✅ Have database schema with indexes
5. ✅ Provide CLI for management
6. ✅ Include comprehensive README
7. ✅ Work independently (no nchat-specific code)
8. ✅ Be tested with example app

---

## After Plugin Creation

Once all 5 plugins are created and tested:

1. **Update nself-chat**:
   - Remove CS_2, CS_3, CS_5, CS_6 from `.backend/.env.dev`
   - Add plugin installations:
     ```bash
     nself plugin install realtime
     nself plugin install notifications
     nself plugin install file-processing
     nself plugin install jobs
     nself plugin install idme
     ```
   - Update frontend to use plugin endpoints
   - Remove extracted code from `src/lib/`

2. **Update nself-plugins**:
   - Add all 5 plugins to `registry.json`
   - Update README with new plugins
   - Create announcement blog post
   - Submit to nself plugin registry

3. **Community Rollout**:
   - Announce on nself Discord
   - Create tutorial videos
   - Write blog posts for each plugin
   - Get feedback and iterate

---

**Goal**: Transform nself-chat from monolithic demo into a showcase of composable plugins, demonstrating the true power of the nself ecosystem! 🚀
