# GitHub Plugin for nself

Comprehensive GitHub integration that syncs repositories, issues, pull requests, commits, releases, and workflow data to your local PostgreSQL database with real-time webhook support.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [REST API](#rest-api)
- [Webhooks](#webhooks)
- [Database Schema](#database-schema)
- [Analytics Views](#analytics-views)
- [Use Cases](#use-cases)
- [TypeScript Implementation](#typescript-implementation)
- [Troubleshooting](#troubleshooting)

---

## Overview

The GitHub plugin provides complete synchronization between GitHub and your local database. It captures all aspects of your GitHub workflow including repositories, issues, pull requests, commits, releases, deployments, and GitHub Actions workflow runs.

### Why Sync GitHub Data Locally?

1. **Faster Queries** - Query your entire GitHub history without API calls or rate limits
2. **Cross-Repository Analytics** - Aggregate data across all repos in a single SQL query
3. **Custom Dashboards** - Build engineering metrics dashboards with your synced data
4. **Offline Access** - Your GitHub data is always available, even without internet
5. **Real-Time Updates** - Webhooks keep your local data in sync as changes happen
6. **Historical Analysis** - Track trends over time with full historical data

---

## Features

### Data Synchronization

| Resource | Synced Data | Incremental Sync |
|----------|-------------|------------------|
| Repositories | All metadata, settings, topics | Yes |
| Issues | Full issue data with labels, assignees | Yes |
| Pull Requests | PR data, reviews, comments | Yes |
| Commits | Commit history with diffs | Yes |
| Releases | Release versions with assets | Yes |
| Branches | Branch list and protection rules | Yes |
| Tags | Tag list with commit refs | Yes |
| Milestones | Milestone tracking | Yes |
| Labels | All repository labels | Yes |
| Workflow Runs | GitHub Actions run history | Yes |
| Workflow Jobs | Individual job details | Yes |
| Check Suites | Check suite results | Yes |
| Check Runs | Individual check results | Yes |
| Deployments | Deployment history | Yes |
| Teams | Organization team data | Yes |
| Collaborators | Repository collaborators | Yes |

### Real-Time Webhooks

Supported webhook events for instant updates:

- `push` - Code pushed to any branch
- `pull_request` - PR opened, closed, merged, synchronized
- `pull_request_review` - PR review submitted, approved, rejected
- `pull_request_review_comment` - Comments on PR diffs
- `issues` - Issue created, updated, labeled, closed
- `issue_comment` - Comments on issues and PRs
- `release` - New release published
- `workflow_run` - GitHub Actions workflow completed
- `workflow_job` - Individual job completed
- `check_suite` - Check suite completed
- `check_run` - Individual check completed
- `deployment` - New deployment created
- `deployment_status` - Deployment status changed
- `create` - Branch or tag created
- `delete` - Branch or tag deleted
- `repository` - Repository created, deleted, settings changed
- `star` - Repository starred/unstarred
- `fork` - Repository forked
- `branch_protection_rule` - Branch protection changed
- `label` - Label created, updated, deleted
- `milestone` - Milestone created, updated, deleted
- `team` - Team created, updated, deleted
- `member` - Collaborator added/removed
- `commit_comment` - Comment on a commit

---

## Installation

### Via nself CLI

```bash
# Install the plugin
nself plugin install github

# Verify installation
nself plugin status github
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/acamarata/nself-plugins.git
cd nself-plugins/plugins/github/ts

# Install dependencies
npm install

# Build
npm run build

# Link for CLI access
npm link
```

---

## Configuration

### Environment Variables

Create a `.env` file in the plugin directory or add to your project's `.env`:

```bash
# Required - GitHub Personal Access Token
# Generate at: https://github.com/settings/tokens
# Required scopes: repo, read:org, workflow, read:user
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required - PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/nself

# Optional - Webhook signing secret
# Get from: Repository Settings > Webhooks > Edit > Secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Optional - Organization to sync (syncs all accessible repos if not set)
GITHUB_ORG=your-organization

# Optional - Specific repos to sync (comma-separated)
# Format: owner/repo,owner/repo2
GITHUB_REPOS=acamarata/nself,acamarata/nself-plugins

# Optional - Server configuration
PORT=3002
HOST=0.0.0.0

# Optional - Sync interval in seconds (default: 3600)
GITHUB_SYNC_INTERVAL=3600
```

### GitHub Token Permissions

When creating a Personal Access Token (PAT), enable these scopes:

| Scope | Purpose |
|-------|---------|
| `repo` | Full access to repositories (issues, PRs, commits) |
| `read:org` | Read organization data (teams, members) |
| `workflow` | Access to GitHub Actions workflow data |
| `read:user` | Read user profile data |
| `admin:repo_hook` | Required for webhook management |

For fine-grained PATs, select:
- **Repository access**: All repositories or specific ones
- **Permissions**: Issues (read), Pull requests (read), Contents (read), Metadata (read), Workflows (read), Deployments (read)

---

## Usage

### Initialize Database Schema

```bash
# Create all required tables
nself-github init

# Or via nself CLI
nself plugin github init
```

### Sync Data

```bash
# Sync all data from GitHub
nself-github sync

# Sync specific resources
nself-github sync --resources repos,issues,prs

# Incremental sync (only changes since last sync)
nself-github sync --incremental

# Sync a specific repository
nself-github sync --repo acamarata/nself
```

### Start Webhook Server

```bash
# Start the server
nself-github server

# Custom port
nself-github server --port 3002

# The server exposes:
# - POST /webhook - GitHub webhook endpoint
# - GET /health - Health check
# - GET /api/* - REST API endpoints
```

---

## CLI Commands

### Repository Commands

```bash
# List all synced repositories
nself-github repos list

# List with details
nself-github repos list --details

# Search repositories
nself-github repos search "keyword"

# Get repository details
nself-github repos get owner/repo

# Show repository statistics
nself-github repos stats owner/repo
```

### Issue Commands

```bash
# List all issues
nself-github issues list

# Filter by state
nself-github issues list --state open
nself-github issues list --state closed

# Filter by repository
nself-github issues list --repo owner/repo

# Filter by labels
nself-github issues list --labels bug,urgent

# Filter by assignee
nself-github issues list --assignee username

# Get issue details
nself-github issues get owner/repo 123
```

### Pull Request Commands

```bash
# List all pull requests
nself-github prs list

# Filter by state
nself-github prs list --state open
nself-github prs list --state merged
nself-github prs list --state closed

# Filter by repository
nself-github prs list --repo owner/repo

# Filter by author
nself-github prs list --author username

# Get PR details
nself-github prs get owner/repo 456
```

### Release Commands

```bash
# List all releases
nself-github releases list

# Filter by repository
nself-github releases list --repo owner/repo

# Get latest release
nself-github releases latest owner/repo
```

### Workflow Commands

```bash
# List workflow runs
nself-github actions list

# Filter by status
nself-github actions list --status success
nself-github actions list --status failure

# Filter by repository
nself-github actions list --repo owner/repo

# Get run details
nself-github actions get 12345678
```

### Status Command

```bash
# Show sync status and statistics
nself-github status

# Output:
# Repositories: 25
# Issues: 1,234 (456 open)
# Pull Requests: 789 (23 open)
# Commits: 45,678
# Releases: 156
# Workflow Runs: 3,456
# Last Sync: 2026-01-24 12:00:00
```

---

## REST API

The plugin exposes a REST API when running in server mode.

### Endpoints

#### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

#### Sync Trigger

```http
POST /api/sync
Content-Type: application/json

{
  "resources": ["repos", "issues", "prs"],
  "incremental": true
}
```

Response:
```json
{
  "results": [
    { "resource": "repos", "synced": 25, "duration": 1234 },
    { "resource": "issues", "synced": 156, "duration": 5678 },
    { "resource": "prs", "synced": 45, "duration": 2345 }
  ]
}
```

#### Sync Status

```http
GET /api/status
```

Response:
```json
{
  "stats": {
    "repositories": 25,
    "issues": 1234,
    "pull_requests": 789,
    "commits": 45678,
    "releases": 156,
    "workflow_runs": 3456,
    "deployments": 234
  },
  "last_sync": "2026-01-24T12:00:00Z"
}
```

#### Repositories

```http
GET /api/repositories
GET /api/repositories?limit=50&offset=0
GET /api/repositories/:owner/:repo
GET /api/repositories/:owner/:repo/issues
GET /api/repositories/:owner/:repo/pull-requests
GET /api/repositories/:owner/:repo/commits
GET /api/repositories/:owner/:repo/releases
```

#### Issues

```http
GET /api/issues
GET /api/issues?state=open&repo=owner/repo
GET /api/issues/:owner/:repo/:number
GET /api/issues/:owner/:repo/:number/comments
```

#### Pull Requests

```http
GET /api/pull-requests
GET /api/pull-requests?state=open&repo=owner/repo
GET /api/pull-requests/:owner/:repo/:number
GET /api/pull-requests/:owner/:repo/:number/reviews
GET /api/pull-requests/:owner/:repo/:number/comments
```

#### Commits

```http
GET /api/commits
GET /api/commits?repo=owner/repo&since=2026-01-01
GET /api/commits/:owner/:repo/:sha
GET /api/commits/:owner/:repo/:sha/comments
```

#### Releases

```http
GET /api/releases
GET /api/releases?repo=owner/repo
GET /api/releases/:owner/:repo/:tag
```

#### Workflow Runs

```http
GET /api/workflow-runs
GET /api/workflow-runs?repo=owner/repo&status=success
GET /api/workflow-runs/:id
GET /api/workflow-runs/:id/jobs
```

#### Deployments

```http
GET /api/deployments
GET /api/deployments?repo=owner/repo
GET /api/deployments/:id
```

#### Teams & Collaborators

```http
GET /api/teams
GET /api/teams/:org/:team_slug
GET /api/collaborators?repo=owner/repo
```

---

## Webhooks

### Webhook Setup

1. Go to your repository or organization settings
2. Navigate to **Webhooks** > **Add webhook**
3. Configure:
   - **Payload URL**: `https://your-domain.com/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your `GITHUB_WEBHOOK_SECRET` value
   - **Events**: Select events or "Send me everything"

### Webhook Endpoint

```http
POST /webhook
X-GitHub-Event: push
X-Hub-Signature-256: sha256=...
X-GitHub-Delivery: uuid

{
  "action": "...",
  "repository": { ... },
  ...
}
```

### Signature Verification

The plugin verifies all incoming webhooks using HMAC-SHA256:

```typescript
// Verification uses X-Hub-Signature-256 header
const signature = request.headers['x-hub-signature-256'];
const expected = 'sha256=' + hmac('sha256', secret, rawBody);
```

### Event Handling

Each webhook event is:
1. Verified for signature
2. Stored in `github_webhook_events` table
3. Processed by appropriate handler
4. Used to update synced data

---

## Database Schema

### Tables

#### github_repositories

```sql
CREATE TABLE github_repositories (
    id BIGINT PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(511) NOT NULL UNIQUE,
    owner_login VARCHAR(255) NOT NULL,
    owner_type VARCHAR(50),
    private BOOLEAN DEFAULT FALSE,
    description TEXT,
    fork BOOLEAN DEFAULT FALSE,
    homepage VARCHAR(255),
    language VARCHAR(100),
    forks_count INTEGER DEFAULT 0,
    stargazers_count INTEGER DEFAULT 0,
    watchers_count INTEGER DEFAULT 0,
    open_issues_count INTEGER DEFAULT 0,
    default_branch VARCHAR(255) DEFAULT 'main',
    topics JSONB DEFAULT '[]',
    visibility VARCHAR(50),
    archived BOOLEAN DEFAULT FALSE,
    disabled BOOLEAN DEFAULT FALSE,
    pushed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### github_issues

```sql
CREATE TABLE github_issues (
    id BIGINT PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    repo_id BIGINT REFERENCES github_repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(50) NOT NULL,
    state_reason VARCHAR(100),
    user_login VARCHAR(255),
    user_id BIGINT,
    assignees JSONB DEFAULT '[]',
    labels JSONB DEFAULT '[]',
    milestone_id BIGINT,
    milestone_title VARCHAR(255),
    comments INTEGER DEFAULT 0,
    locked BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repo_id, number)
);
```

#### github_pull_requests

```sql
CREATE TABLE github_pull_requests (
    id BIGINT PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    repo_id BIGINT REFERENCES github_repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(50) NOT NULL,
    user_login VARCHAR(255),
    user_id BIGINT,
    head_ref VARCHAR(255),
    head_sha VARCHAR(40),
    base_ref VARCHAR(255),
    base_sha VARCHAR(40),
    merged BOOLEAN DEFAULT FALSE,
    mergeable BOOLEAN,
    merged_at TIMESTAMP WITH TIME ZONE,
    merged_by_login VARCHAR(255),
    merge_commit_sha VARCHAR(40),
    assignees JSONB DEFAULT '[]',
    labels JSONB DEFAULT '[]',
    milestone_id BIGINT,
    draft BOOLEAN DEFAULT FALSE,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    review_comments INTEGER DEFAULT 0,
    commits INTEGER DEFAULT 0,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repo_id, number)
);
```

#### github_commits

```sql
CREATE TABLE github_commits (
    sha VARCHAR(40) PRIMARY KEY,
    repo_id BIGINT REFERENCES github_repositories(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    author_date TIMESTAMP WITH TIME ZONE,
    committer_name VARCHAR(255),
    committer_email VARCHAR(255),
    committer_date TIMESTAMP WITH TIME ZONE,
    tree_sha VARCHAR(40),
    parents JSONB DEFAULT '[]',
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    files JSONB DEFAULT '[]',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### github_releases

```sql
CREATE TABLE github_releases (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES github_repositories(id) ON DELETE CASCADE,
    tag_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    body TEXT,
    draft BOOLEAN DEFAULT FALSE,
    prerelease BOOLEAN DEFAULT FALSE,
    target_commitish VARCHAR(255),
    author_login VARCHAR(255),
    assets JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### github_workflow_runs

```sql
CREATE TABLE github_workflow_runs (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES github_repositories(id) ON DELETE CASCADE,
    name VARCHAR(255),
    workflow_id BIGINT,
    head_branch VARCHAR(255),
    head_sha VARCHAR(40),
    status VARCHAR(50),
    conclusion VARCHAR(50),
    event VARCHAR(100),
    run_number INTEGER,
    run_attempt INTEGER DEFAULT 1,
    actor_login VARCHAR(255),
    triggering_actor_login VARCHAR(255),
    run_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### github_webhook_events

```sql
CREATE TABLE github_webhook_events (
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    action VARCHAR(100),
    repo_id BIGINT,
    repo_name VARCHAR(511),
    sender_login VARCHAR(255),
    data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Additional Tables

- `github_branches` - Branch information with protection status
- `github_tags` - Git tags
- `github_milestones` - Milestone tracking
- `github_labels` - Repository labels
- `github_workflow_jobs` - Individual workflow job details
- `github_check_suites` - Check suite results
- `github_check_runs` - Individual check run results
- `github_deployments` - Deployment records
- `github_pr_reviews` - Pull request reviews
- `github_issue_comments` - Issue and PR comments
- `github_pr_review_comments` - PR diff comments
- `github_commit_comments` - Commit comments
- `github_teams` - Organization teams
- `github_collaborators` - Repository collaborators

---

## Analytics Views

Pre-built SQL views for common queries:

### github_open_items

```sql
CREATE VIEW github_open_items AS
SELECT
    r.full_name AS repository,
    'issue' AS type,
    i.number,
    i.title,
    i.user_login AS author,
    i.created_at,
    i.updated_at
FROM github_issues i
JOIN github_repositories r ON i.repo_id = r.id
WHERE i.state = 'open'
UNION ALL
SELECT
    r.full_name,
    'pr' AS type,
    p.number,
    p.title,
    p.user_login,
    p.created_at,
    p.updated_at
FROM github_pull_requests p
JOIN github_repositories r ON p.repo_id = r.id
WHERE p.state = 'open'
ORDER BY updated_at DESC;
```

### github_recent_activity

```sql
CREATE VIEW github_recent_activity AS
SELECT
    r.full_name AS repository,
    c.sha,
    c.message,
    c.author_name,
    c.author_date AS activity_date,
    'commit' AS activity_type
FROM github_commits c
JOIN github_repositories r ON c.repo_id = r.id
WHERE c.author_date > NOW() - INTERVAL '7 days'
ORDER BY c.author_date DESC;
```

### github_workflow_stats

```sql
CREATE VIEW github_workflow_stats AS
SELECT
    r.full_name AS repository,
    w.name AS workflow,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE w.conclusion = 'success') AS successful,
    COUNT(*) FILTER (WHERE w.conclusion = 'failure') AS failed,
    ROUND(
        COUNT(*) FILTER (WHERE w.conclusion = 'success')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS success_rate,
    AVG(
        EXTRACT(EPOCH FROM (w.updated_at - w.run_started_at))
    ) AS avg_duration_seconds
FROM github_workflow_runs w
JOIN github_repositories r ON w.repo_id = r.id
WHERE w.created_at > NOW() - INTERVAL '30 days'
GROUP BY r.full_name, w.name;
```

---

## Use Cases

### 1. Engineering Metrics Dashboard

Track development velocity and team performance:

```sql
-- Commits per developer per week
SELECT
    author_name,
    DATE_TRUNC('week', author_date) AS week,
    COUNT(*) AS commits
FROM github_commits
WHERE author_date > NOW() - INTERVAL '3 months'
GROUP BY author_name, week
ORDER BY week DESC, commits DESC;

-- PR merge time (time from open to merge)
SELECT
    r.full_name,
    AVG(EXTRACT(EPOCH FROM (p.merged_at - p.created_at)) / 3600) AS avg_hours_to_merge
FROM github_pull_requests p
JOIN github_repositories r ON p.repo_id = r.id
WHERE p.merged = TRUE
  AND p.merged_at > NOW() - INTERVAL '30 days'
GROUP BY r.full_name;
```

### 2. Release Tracking

Monitor releases across repositories:

```sql
-- Recent releases
SELECT
    r.full_name,
    rel.tag_name,
    rel.name,
    rel.published_at,
    rel.prerelease
FROM github_releases rel
JOIN github_repositories r ON rel.repo_id = r.id
ORDER BY rel.published_at DESC
LIMIT 20;
```

### 3. CI/CD Monitoring

Track GitHub Actions performance:

```sql
-- Failed workflows in last 24 hours
SELECT
    r.full_name,
    w.name,
    w.head_branch,
    w.actor_login,
    w.created_at
FROM github_workflow_runs w
JOIN github_repositories r ON w.repo_id = r.id
WHERE w.conclusion = 'failure'
  AND w.created_at > NOW() - INTERVAL '24 hours'
ORDER BY w.created_at DESC;
```

### 4. Issue Tracking Analytics

Analyze issue patterns:

```sql
-- Open issues by label
SELECT
    label->>'name' AS label,
    COUNT(*) AS count
FROM github_issues i,
     LATERAL jsonb_array_elements(i.labels) AS label
WHERE i.state = 'open'
GROUP BY label->>'name'
ORDER BY count DESC;
```

---

## TypeScript Implementation

The plugin is built with TypeScript for type safety and maintainability.

### Key Files

| File | Purpose |
|------|---------|
| `types.ts` | All type definitions for GitHub resources |
| `client.ts` | GitHub API client with pagination and rate limiting |
| `database.ts` | PostgreSQL operations with upsert support |
| `sync.ts` | Orchestrates full and incremental syncs |
| `webhooks.ts` | Webhook event handlers |
| `server.ts` | Fastify HTTP server |
| `cli.ts` | Commander.js CLI |

### API Client Example

```typescript
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async listRepositories(org?: string): Promise<Repository[]> {
    const repos: Repository[] = [];

    if (org) {
      for await (const response of this.octokit.paginate.iterator(
        this.octokit.repos.listForOrg,
        { org, per_page: 100 }
      )) {
        repos.push(...response.data.map(this.mapRepository));
      }
    } else {
      for await (const response of this.octokit.paginate.iterator(
        this.octokit.repos.listForAuthenticatedUser,
        { per_page: 100 }
      )) {
        repos.push(...response.data.map(this.mapRepository));
      }
    }

    return repos;
  }
}
```

---

## Troubleshooting

### Common Issues

#### Rate Limiting

```
Error: API rate limit exceeded
```

**Solution**: GitHub allows 5,000 requests/hour for authenticated users. Use incremental sync to minimize API calls:

```bash
nself-github sync --incremental
```

#### Token Permissions

```
Error: Resource not accessible by integration
```

**Solution**: Ensure your token has the required scopes:
- `repo` for repository access
- `read:org` for organization data
- `workflow` for Actions data

#### Webhook Signature Invalid

```
Error: Webhook signature verification failed
```

**Solution**:
1. Verify `GITHUB_WEBHOOK_SECRET` matches the secret in GitHub settings
2. Ensure the webhook is sending `application/json` content type
3. Check that no proxy is modifying the request body

#### Database Connection

```
Error: Connection refused to PostgreSQL
```

**Solution**:
1. Verify `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Check firewall rules

### Debug Mode

Enable debug logging for troubleshooting:

```bash
DEBUG=github:* nself-github sync
```

### Support

- [GitHub Issues](https://github.com/acamarata/nself-plugins/issues)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Octokit Documentation](https://octokit.github.io/rest.js)
