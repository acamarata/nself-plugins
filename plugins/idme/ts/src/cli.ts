#!/usr/bin/env node
/**
 * ID.me Plugin CLI
 */

import { Command } from 'commander';
import { createLogger } from '@nself/plugin-utils';
import { createIDmeClient } from './client.js';
import { createDatabase } from './database.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const logger = createLogger('idme:cli');
const program = new Command();

program
  .name('nself-idme')
  .description('ID.me OAuth authentication plugin for nself')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize OAuth configuration and show authorization URL')
  .action(async () => {
    try {
      const config = loadConfig();
      const client = createIDmeClient(config);
      const state = Math.random().toString(36).substring(7);
      const url = client.getAuthorizationUrl(state);

      logger.info('\nID.me OAuth Configuration');
      logger.info('========================\n');
      logger.info(`Mode: ${config.sandbox ? 'Sandbox' : 'Production'}`);
      logger.info(`Client ID: ${config.clientId.substring(0, 8)}...`);
      logger.info(`Redirect URI: ${config.redirectUri}`);
      logger.info(`Scopes: ${config.scopes.join(', ')}\n`);
      logger.info('Authorization URL:');
      logger.info(url);
      logger.info(`\nState (for CSRF protection): ${state}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Init failed', { error: message });
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify <email>')
  .description('Check verification status for a user')
  .action(async (email: string) => {
    try {
      const db = createDatabase();
      const verification = await db.getVerificationByEmail(email);

      if (!verification) {
        logger.info(`\nNo verification found for: ${email}\n`);
        process.exit(0);
      }

      logger.info('\nVerification Status');
      logger.info('==================\n');
      logger.info(`Email: ${verification.email}`);
      logger.info(`Name: ${verification.first_name} ${verification.last_name}`);
      logger.info(`Verified: ${verification.verified ? 'Yes' : 'No'}`);
      logger.info(`Verified At: ${verification.verified_at || 'N/A'}`);
      logger.info(`Last Synced: ${verification.last_synced_at}\n`);

      await db.close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Verify failed', { error: message });
      process.exit(1);
    }
  });

// Server command
program
  .command('server')
  .description('Start HTTP server for OAuth callbacks and webhooks')
  .option('-p, --port <port>', 'Port to listen on', '3010')
  .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
  .action(async (options) => {
    try {
      const port = parseInt(options.port);
      const host = options.host;

      const server = await createServer();
      await server.listen({ port, host });

      logger.info(`\nID.me server listening on http://${host}:${port}`);
      logger.info('\nEndpoints:');
      logger.info(`  GET  /health           - Health check`);
      logger.info(`  GET  /auth/idme        - Start OAuth flow`);
      logger.info(`  GET  /callback/idme    - OAuth callback`);
      logger.info(`  POST /webhook/idme     - Webhook receiver`);
      logger.info(`  GET  /api/verifications/:userId - Get verification\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Server failed', { error: message });
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test configuration and connectivity')
  .action(async () => {
    logger.info('\nTesting ID.me Plugin');
    logger.info('===================\n');

    let exitCode = 0;

    // Test config
    try {
      const config = loadConfig();
      logger.info('Configuration loaded');
      logger.info(`  Client ID: ${config.clientId.substring(0, 8)}...`);
      logger.info(`  Scopes: ${config.scopes.join(', ')}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Configuration failed', { error: message });
      exitCode = 1;
    }

    // Test database
    try {
      const db = createDatabase();
      await db.close();
      logger.info('Database connection successful');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Database connection failed', { error: message });
      exitCode = 1;
    }

    process.exit(exitCode);
  });

program.parse();
