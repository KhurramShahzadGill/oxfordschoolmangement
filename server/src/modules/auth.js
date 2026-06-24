import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query(
    `SELECT u.*, s.name AS school_name FROM users u
       JOIN schools s ON s.id = u.school_id
       WHERE lower(u.email) = lower($1) AND u.is_active = true`,
    [email]
  );
  const user = rows[0];
  // Always run a compare to avoid leaking which emails exist (timing).
  const hash = user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }

  await query(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id]);

  const token = jwt.sign(
    { sub: user.id, school_id: user.school_id, role: user.role, name: user.full_name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  res.json({
    token,
    user: {
      id: user.id, email: user.email, full_name: user.full_name,
      role: user.role, school_id: user.school_id, school_name: user.school_name,
    },
  });
}));

// GET /api/auth/me  — returns the current logged-in user
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, full_name, role, school_id FROM users WHERE id = $1`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  res.json(rows[0]);
}));

export default router;
