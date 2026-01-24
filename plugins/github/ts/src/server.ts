/**
 * GitHub Plugin Server
 * HTTP server for webhooks and API endpoints
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createLogger, verifyGitHubSignature, ApiRateLimiter, createAuthHook, createRateLimitHook } from '@nself/plugin-utils';
import { GitHubClient } from './client.js';
import { GitHubDatabase } from './database.js';
import { GitHubSyncService } from './sync.js';
import { GitHubWebhookHandler } from './webhooks.js';
import { loadConfig, type Config } from './config.js';

const logger = createLogger('github:server');

export async function createServer(config?: Partial<Config>) {
  const fullConfig = loadConfig(config);

  // Initialize components
  const client = new GitHubClient(fullConfig.githubToken);
  const db = new GitHubDatabase();
  const syncService = new GitHubSyncService(
    client,
    db,
    fullConfig.githubOrg,
    fullConfig.githubRepos
  );
  const webhookHandler = new GitHubWebhookHandler(client, db);

  // Connect to database
  await db.connect();
  await db.initializeSchema();

  // Create Fastify server
  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Security middleware
  const rateLimiter = new ApiRateLimiter(
    fullConfig.security.rateLimitMax ?? 100,
    fullConfig.security.rateLimitWindowMs ?? 60000
  );

  // Add rate limiting to all requests
  app.addHook('preHandler', createRateLimitHook(rateLimiter) as never);

  // Add API key authentication (skips health check endpoints)
  if (fullConfig.security.apiKey) {
    app.addHook('preHandler', createAuthHook(fullConfig.security.apiKey) as never);
    logger.info('API key authentication enabled');
  }

  // Raw body parser for webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = JSON.parse(body as string);
      (req as unknown as { rawBody: string }).rawBody = body as string;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Health check endpoint (basic liveness)
  app.get('/health', async () => {
    return { status: 'ok', plugin: 'github', timestamp: new Date().toISOString() };
  });

  // Readiness check (verifies database connectivity)
  app.get('/ready', async (request, reply) => {
    try {
      await db.execute('SELECT 1');
      return { ready: true, plugin: 'github', timestamp: new Date().toISOString() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unavailable';
      logger.error('Readiness check failed', { error: message });
      return reply.status(503).send({
        ready: false,
        plugin: 'github',
        error: 'Database unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Liveness check (application state with sync info)
  app.get('/live', async () => {
    const stats = await db.getStats();
    return {
      alive: true,
      plugin: 'github',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: {
        repositories: stats.repositories,
        issues: stats.issues,
        pullRequests: stats.pullRequests,
        lastSync: stats.lastSyncedAt,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Status endpoint
  app.get('/status', async () => {
    const stats = await db.getStats();
    return {
      plugin: 'github',
      version: '1.0.0',
      status: 'running',
      stats,
      timestamp: new Date().toISOString(),
    };
  });

  // Webhook endpoint
  app.post('/webhooks/github', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    const event = request.headers['x-github-event'] as string | undefined;
    const deliveryId = request.headers['x-github-delivery'] as string | undefined;
    const rawBody = (request as unknown as { rawBody: string }).rawBody;

    if (!event || !deliveryId) {
      logger.warn('Missing GitHub event headers');
      return reply.status(400).send({ error: 'Missing event headers' });
    }

    if (fullConfig.githubWebhookSecret && signature) {
      if (!verifyGitHubSignature(rawBody, signature, fullConfig.githubWebhookSecret)) {
        logger.warn('Invalid GitHub signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    try {
      await webhookHandler.handle(deliveryId, event, request.body as Record<string, unknown>);
      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Webhook processing failed', { error: message });
      return reply.status(500).send({ error: 'Processing failed' });
    }
  });

  // Sync endpoint
  app.post('/sync', async (request, reply) => {
    const { resources, repos, since } = request.body as {
      resources?: string[];
      repos?: string[];
      since?: string;
    };

    try {
      const result = await syncService.sync({
        resources: resources as Array<'repositories' | 'issues' | 'pull_requests' | 'commits' | 'releases' | 'workflow_runs' | 'deployments'>,
        repos,
        since: since ? new Date(since) : undefined,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Sync failed', { error: message });
      return reply.status(500).send({ error: message });
    }
  });

  // API endpoints for querying synced data
  app.get('/api/repos', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const repos = await db.listRepositories(limit, offset);
    const total = await db.countRepositories();
    return { data: repos, total, limit, offset };
  });

  app.get('/api/repos/:fullName', async (request, reply) => {
    const { fullName } = request.params as { fullName: string };
    const repo = await db.getRepositoryByFullName(decodeURIComponent(fullName));
    if (!repo) {
      return reply.status(404).send({ error: 'Repository not found' });
    }
    return repo;
  });

  app.get('/api/issues', async (request) => {
    const { limit = 100, offset = 0, state, repo_id } = request.query as {
      limit?: number;
      offset?: number;
      state?: string;
      repo_id?: number;
    };
    const issues = await db.listIssues(repo_id, state, limit, offset);
    const total = await db.countIssues(state);
    return { data: issues, total, limit, offset };
  });

  app.get('/api/prs', async (request) => {
    const { limit = 100, offset = 0, state, repo_id } = request.query as {
      limit?: number;
      offset?: number;
      state?: string;
      repo_id?: number;
    };
    const prs = await db.listPullRequests(repo_id, state, limit, offset);
    const total = await db.countPullRequests(state);
    return { data: prs, total, limit, offset };
  });

  // Commits
  app.get('/api/commits', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_commits ORDER BY author_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countCommits();
    return { data: result, total, limit, offset };
  });

  // Releases
  app.get('/api/releases', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_releases ORDER BY published_at DESC NULLS LAST LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countReleases();
    return { data: result, total, limit, offset };
  });

  // Branches
  app.get('/api/branches', async (request) => {
    const { limit = 100, offset = 0, repo_id } = request.query as {
      limit?: number;
      offset?: number;
      repo_id?: number;
    };
    let sql = 'SELECT * FROM github_branches';
    const params: unknown[] = [];
    if (repo_id) {
      sql += ' WHERE repo_id = $1';
      params.push(repo_id);
    }
    sql += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countBranches();
    return { data: result, total, limit, offset };
  });

  // Tags
  app.get('/api/tags', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_tags ORDER BY name LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countTags();
    return { data: result, total, limit, offset };
  });

  // Milestones
  app.get('/api/milestones', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_milestones ORDER BY due_on ASC NULLS LAST LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countMilestones();
    return { data: result, total, limit, offset };
  });

  // Labels
  app.get('/api/labels', async (request) => {
    const { limit = 100, offset = 0, repo_id } = request.query as {
      limit?: number;
      offset?: number;
      repo_id?: number;
    };
    let sql = 'SELECT * FROM github_labels';
    const params: unknown[] = [];
    if (repo_id) {
      sql += ' WHERE repo_id = $1';
      params.push(repo_id);
    }
    sql += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countLabels();
    return { data: result, total, limit, offset };
  });

  // Workflows
  app.get('/api/workflows', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_workflows ORDER BY name LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countWorkflows();
    return { data: result, total, limit, offset };
  });

  // Workflow Runs
  app.get('/api/workflow-runs', async (request) => {
    const { limit = 100, offset = 0, status, conclusion } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      conclusion?: string;
    };
    let sql = 'SELECT * FROM github_workflow_runs WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (conclusion) {
      sql += ` AND conclusion = $${paramIndex++}`;
      params.push(conclusion);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countWorkflowRuns();
    return { data: result, total, limit, offset };
  });

  // Workflow Jobs
  app.get('/api/workflow-jobs', async (request) => {
    const { limit = 100, offset = 0, run_id } = request.query as {
      limit?: number;
      offset?: number;
      run_id?: number;
    };
    let sql = 'SELECT * FROM github_workflow_jobs';
    const params: unknown[] = [];
    if (run_id) {
      sql += ' WHERE run_id = $1';
      params.push(run_id);
    }
    sql += ` ORDER BY started_at DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countWorkflowJobs();
    return { data: result, total, limit, offset };
  });

  // Check Suites
  app.get('/api/check-suites', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_check_suites ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countCheckSuites();
    return { data: result, total, limit, offset };
  });

  // Check Runs
  app.get('/api/check-runs', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_check_runs ORDER BY started_at DESC NULLS LAST LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countCheckRuns();
    return { data: result, total, limit, offset };
  });

  // Deployments
  app.get('/api/deployments', async (request) => {
    const { limit = 100, offset = 0, environment } = request.query as {
      limit?: number;
      offset?: number;
      environment?: string;
    };
    let sql = 'SELECT * FROM github_deployments';
    const params: unknown[] = [];
    if (environment) {
      sql += ' WHERE environment = $1';
      params.push(environment);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countDeployments();
    return { data: result, total, limit, offset };
  });

  // Teams
  app.get('/api/teams', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_teams ORDER BY name LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countTeams();
    return { data: result, total, limit, offset };
  });

  // Collaborators
  app.get('/api/collaborators', async (request) => {
    const { limit = 100, offset = 0, repo_id } = request.query as {
      limit?: number;
      offset?: number;
      repo_id?: number;
    };
    let sql = 'SELECT * FROM github_collaborators';
    const params: unknown[] = [];
    if (repo_id) {
      sql += ' WHERE repo_id = $1';
      params.push(repo_id);
    }
    sql += ` ORDER BY login LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countCollaborators();
    return { data: result, total, limit, offset };
  });

  // PR Reviews
  app.get('/api/pr-reviews', async (request) => {
    const { limit = 100, offset = 0, pr_id } = request.query as {
      limit?: number;
      offset?: number;
      pr_id?: number;
    };
    let sql = 'SELECT * FROM github_pr_reviews';
    const params: unknown[] = [];
    if (pr_id) {
      sql += ' WHERE pull_request_id = $1';
      params.push(pr_id);
    }
    sql += ` ORDER BY submitted_at DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    const total = await db.countPRReviews();
    return { data: result, total, limit, offset };
  });

  // Issue Comments
  app.get('/api/issue-comments', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_issue_comments ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countIssueComments();
    return { data: result, total, limit, offset };
  });

  // PR Review Comments
  app.get('/api/pr-review-comments', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_pr_review_comments ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countPRReviewComments();
    return { data: result, total, limit, offset };
  });

  // Commit Comments
  app.get('/api/commit-comments', async (request) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await db.execute(
      'SELECT * FROM github_commit_comments ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const total = await db.countCommitComments();
    return { data: result, total, limit, offset };
  });

  // Webhook Events
  app.get('/api/events', async (request) => {
    const { limit = 100, offset = 0, event } = request.query as {
      limit?: number;
      offset?: number;
      event?: string;
    };
    let sql = 'SELECT * FROM github_webhook_events';
    const params: unknown[] = [];
    if (event) {
      sql += ' WHERE event = $1';
      params.push(event);
    }
    sql += ` ORDER BY received_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.execute(sql, params);
    return { data: result, limit, offset };
  });

  // Stats endpoint
  app.get('/api/stats', async () => {
    return await db.getStats();
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await db.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return {
    app,
    db,
    client,
    syncService,
    webhookHandler,
    start: async () => {
      await app.listen({ port: fullConfig.port, host: fullConfig.host });
      logger.success(`GitHub plugin server running on http://${fullConfig.host}:${fullConfig.port}`);
      logger.info(`Webhook endpoint: http://${fullConfig.host}:${fullConfig.port}/webhooks/github`);
    },
    stop: shutdown,
  };
}

// Start server if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  createServer()
    .then(server => server.start())
    .catch(error => {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    });
}
