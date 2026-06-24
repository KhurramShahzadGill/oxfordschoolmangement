/*
 * Database setup runner.
 *   npm run migrate         -> apply schema + seed (use on a fresh database)
 *   npm run migrate:fresh   -> DROP everything first, then apply (DEV ONLY)
 *
 * After seeding, the placeholder admin password hash is replaced with a real
 * bcrypt hash of DEFAULT_ADMIN_PASSWORD so you can log in immediately.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../../db');
const fresh = process.argv.includes('--fresh');

const readSql = (file) => fs.readFileSync(path.join(dbDir, file), 'utf8');

const run = async () => {
  if (fresh) {
    console.log('Resetting public schema (--fresh)...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  console.log('Applying schema.sql ...');
  await pool.query(readSql('schema.sql'));

  console.log('Applying seed.sql ...');
  await pool.query(readSql('seed.sql'));

  console.log('Setting admin password ...');
  const hash = await bcrypt.hash(env.defaultAdminPassword, 10);
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE email = 'admin@oxford.edu'`,
    [hash]
  );

  console.log('\n✅ Database ready.');
  console.log(`   Login: admin@oxford.edu  /  ${env.defaultAdminPassword}`);
  await pool.end();
};

run().catch(async (err) => {
  console.error('\n❌ Migration failed:', err.message);
  await pool.end();
  process.exit(1);
});
