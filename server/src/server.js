import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`School Management API running on http://localhost:${env.port}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down...');
  server.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
