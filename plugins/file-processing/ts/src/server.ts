/**
 * File Processing Plugin - HTTP Server
 */

import { createLogger } from '@nself/plugin-utils';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig, validateConfig, getDatabaseUrl } from './config.js';
import { Database } from './database.js';
import type { CreateJobRequest, ProcessingStatus } from './types.js';

const logger = createLogger('file-processing:server');

async function startServer() {
  const config = loadConfig();
  validateConfig(config);

  const db = new Database(getDatabaseUrl());
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Create processing job
  fastify.post<{ Body: CreateJobRequest }>('/api/jobs', async (request, reply) => {
    try {
      const jobId = await db.createJob(request.body);

      return {
        jobId,
        status: 'pending',
        estimatedDuration: 3000, // 3 seconds estimate
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to create job' };
    }
  });

  // Get job status
  fastify.get<{ Params: { jobId: string } }>('/api/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params;

    try {
      const job = await db.getJob(jobId);
      if (!job) {
        reply.code(404);
        return { error: 'Job not found' };
      }

      const thumbnails = await db.getThumbnails(jobId);
      const metadata = await db.getMetadata(jobId);
      const scan = await db.getScan(jobId);

      return {
        job,
        thumbnails,
        metadata,
        scan,
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to get job' };
    }
  });

  // List jobs
  fastify.get<{
    Querystring: { status?: string; limit?: string; offset?: string };
  }>('/api/jobs', async (request) => {
    const { status, limit = '50', offset = '0' } = request.query;

    try {
      const jobs = await db.listJobs(
        status as ProcessingStatus | undefined,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      return { jobs };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to list jobs' };
    }
  });

  // Get statistics
  fastify.get('/api/stats', async () => {
    try {
      const stats = await db.getStats();
      return stats;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get stats' };
    }
  });

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    logger.info(`Server listening on ${config.host}:${config.port}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start server', { error: message });
    await db.close();
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');
    await fastify.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Fatal error', { error: message });
  process.exit(1);
});
