#!/usr/bin/env node
/**
 * CLI for realtime plugin
 */

import { Command } from 'commander';
import { Database } from './database.js';
import { config } from './config.js';

const program = new Command();

program
  .name('nself-realtime')
  .description('Realtime Socket.io server management')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize realtime server and database')
  .action(async () => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});

      console.log('Creating default rooms...');
      await db.createRoom({ name: 'general', type: 'channel', visibility: 'public' });
      await db.createRoom({ name: 'announcements', type: 'channel', visibility: 'public' });

      console.log('Cleaning up stale data...');
      await db.cleanExpiredTyping();

      console.log('✓ Initialization complete');
      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show server statistics')
  .action(async () => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});
      const stats = await db.getStats();

      console.log('\nRealtime Server Statistics');
      console.log('='.repeat(50));
      console.log(`Active Connections:      ${stats.connections}`);
      console.log(`Authenticated Users:     ${stats.authenticatedConnections}`);
      console.log(`Active Rooms:            ${stats.rooms}`);
      console.log(`\nPresence:`);
      console.log(`  Online:  ${stats.presence.online}`);
      console.log(`  Away:    ${stats.presence.away}`);
      console.log(`  Busy:    ${stats.presence.busy}`);
      console.log(`  Offline: ${stats.presence.offline}`);
      console.log(`\nEvents (last hour):      ${stats.eventsLastHour}`);
      console.log('='.repeat(50) + '\n');

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Rooms command
program
  .command('rooms')
  .description('List all rooms')
  .action(async () => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});
      const rooms = await db.getAllRooms();

      console.log('\nActive Rooms');
      console.log('='.repeat(70));
      console.log('NAME                TYPE        VISIBILITY   CREATED');
      console.log('-'.repeat(70));

      for (const room of rooms) {
        console.log(
          `${room.name.padEnd(20)} ${room.type.padEnd(12)} ${room.visibility.padEnd(12)} ${room.created_at.toISOString().split('T')[0]}`
        );
      }

      console.log('='.repeat(70) + '\n');

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Create room command
program
  .command('create-room <name>')
  .description('Create a new room')
  .option('-t, --type <type>', 'Room type', 'channel')
  .option('-v, --visibility <visibility>', 'Room visibility', 'public')
  .action(async (name, options) => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});
      const room = await db.createRoom({
        name,
        type: options.type,
        visibility: options.visibility,
      });

      console.log(`✓ Room created: ${room.name} (${room.type}, ${room.visibility})`);

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Connections command
program
  .command('connections')
  .description('List active connections')
  .action(async () => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});
      const connections = await db.getActiveConnections();

      console.log('\nActive Connections');
      console.log('='.repeat(100));
      console.log('SOCKET ID            USER ID              TRANSPORT    LATENCY    CONNECTED AT');
      console.log('-'.repeat(100));

      for (const conn of connections) {
        console.log(
          `${conn.socket_id.substring(0, 20).padEnd(20)} ` +
          `${(conn.user_id || 'anonymous').substring(0, 20).padEnd(20)} ` +
          `${conn.transport.padEnd(12)} ` +
          `${(conn.latency_ms || '-').toString().padEnd(10)} ` +
          `${conn.connected_at.toISOString()}`
        );
      }

      console.log('='.repeat(100) + '\n');

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Events command
program
  .command('events')
  .description('Show recent events')
  .option('-n, --number <number>', 'Number of events to show', '20')
  .action(async (options) => {
    try {
      const db = new Database({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: config.databaseUser,
  password: config.databasePassword,
  ssl: config.databaseSsl,
});
      const events = await db.getRecentEvents(parseInt(options.number, 10));

      console.log('\nRecent Events');
      console.log('='.repeat(100));
      console.log('TIME                 EVENT TYPE           USER ID              ROOM ID');
      console.log('-'.repeat(100));

      for (const event of events) {
        console.log(
          `${event.created_at.toISOString().split('T')[1].substring(0, 8).padEnd(20)} ` +
          `${event.event_type.padEnd(20)} ` +
          `${(event.user_id || '-').substring(0, 20).padEnd(20)} ` +
          `${(event.room_id || '-').substring(0, 36)}`
        );
      }

      console.log('='.repeat(100) + '\n');

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
