import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

// Cloud databases (Supabase, Render, etc.) require SSL; local ones don't.
const isLocal = /localhost|127\.0\.0\.1/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Simple query helper.
export const query = (text, params) => pool.query(text, params);

// Run a function inside a single transaction. Commits on success,
// rolls back on any error. Used by the fee engine for safe money writes.
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
