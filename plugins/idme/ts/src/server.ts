/**
 * ID.me Plugin HTTP Server
 * Handles OAuth callbacks and webhooks
 */

import Fastify from 'fastify';
import { createLogger } from '@nself/plugin-utils';
import { createIDmeClient } from './client.js';
import { createDatabase } from './database.js';
import { loadConfig, DEFAULT_PORT, DEFAULT_HOST } from './config.js';

const logger = createLogger('idme:server');

export async function createServer() {
  const fastify = Fastify({ logger: false });
  const config = loadConfig();
  const client = createIDmeClient(config);
  const db = createDatabase();

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'idme-plugin' };
  });

  // OAuth authorization (redirect to ID.me)
  fastify.get('/auth/idme', async (request, reply) => {
    const state = Math.random().toString(36).substring(7);
    const url = client.getAuthorizationUrl(state);

    // Store state in session/cookie for verification
    reply.setCookie('idme_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
    });

    reply.redirect(url);
  });

  // OAuth callback
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>('/callback/idme', async (request, reply) => {
    const { code, state, error } = request.query;

    if (error) {
      logger.error('OAuth error', { error });
      return reply.status(400).send({ error: 'OAuth authentication failed' });
    }

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' });
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.idme_state;
    if (state !== storedState) {
      logger.error('State mismatch', { provided: state, stored: storedState });
      return reply.status(400).send({ error: 'Invalid state parameter' });
    }

    try {
      // Exchange code for tokens
      const tokens = await client.exchangeCode(code);
      logger.info('Tokens obtained');

      // Get user profile and verifications
      const profile = await client.getUserProfile(tokens.accessToken);
      const verification = await client.getVerifications(tokens.accessToken);

      logger.info('User verified', {
        email: profile.email,
        groups: verification.groups.length,
      });

      // Return data (in production, store in database and redirect to app)
      return {
        success: true,
        profile,
        verification,
        // Don't return tokens in production!
        tokens: {
          expiresAt: tokens.expiresAt,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Callback error', { error: message });
      return reply.status(500).send({ error: 'Failed to complete authentication' });
    }
  });

  // Webhook endpoint
  fastify.post('/webhook/idme', async (request, reply) => {
    const signature = request.headers['x-idme-signature'] as string;
    if (!signature) {
      return reply.status(401).send({ error: 'Missing signature' });
    }
    const payload = JSON.stringify(request.body);

    // Verify signature
    if (config.webhookSecret) {
      const isValid = client.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        logger.error('Invalid webhook signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    const body = request.body as Record<string, unknown>;
    const eventType = body.type as string;

    try {
      // Store webhook event
      await db.storeWebhookEvent(
        eventType,
        body,
        body.id as string,
        body.user_id as string
      );

      logger.info('Webhook received', { eventType });

      // Process event based on type
      // In production, use a job queue for this
      // await processWebhookEvent(eventType, body);

      return { received: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Webhook processing error', { error: message });
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // API: Get verification status
  fastify.get<{
    Params: { userId: string };
  }>('/api/verifications/:userId', async (request, reply) => {
    const { userId } = request.params;

    try {
      const verification = await db.getVerificationByUserId(userId);

      if (!verification) {
        return reply.status(404).send({ error: 'Verification not found' });
      }

      return verification;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to fetch verification', { error: message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  return fastify;
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT));
  const host = process.env.HOST || DEFAULT_HOST;

  createServer()
    .then((server) => {
      server.listen({ port, host }, (err, address) => {
        if (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Failed to start server', { error: message });
          process.exit(1);
        }
        logger.info(`Server listening on ${address}`);
      });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to create server', { error: message });
      process.exit(1);
    });
}
