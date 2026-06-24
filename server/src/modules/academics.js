import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';

const router = Router();
const schoolId = (req) => req.user.school_id;

/* ---------------- CLASSES ---------------- */
const classSchema = z.object({ name: z.string().trim().min(1), sort_order: z.coerce.number().int().optional() });

router.get('/classes', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM classes WHERE school_id = $1 ORDER BY sort_order, name`, [schoolId(req)]);
  res.json(rows);
}));

router.post('/classes', authorize('admin'), validate(classSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO classes (school_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *`,
    [schoolId(req), req.body.name, req.body.sort_order ?? 0]);
  res.status(201).json(rows[0]);
}));

router.put('/classes/:id', authorize('admin'), validate(classSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE classes SET name=$1, sort_order=$2 WHERE id=$3 AND school_id=$4 RETURNING *`,
    [req.body.name, req.body.sort_order ?? 0, req.params.id, schoolId(req)]);
  if (!rows.length) throw new ApiError(404, 'Class not found.');
  res.json(rows[0]);
}));

router.delete('/classes/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM classes WHERE id=$1 AND school_id=$2`, [req.params.id, schoolId(req)]);
  if (!rowCount) throw new ApiError(404, 'Class not found.');
  res.json({ ok: true });
}));

/* ---------------- SECTIONS ---------------- */
const sectionSchema = z.object({ class_id: z.string().uuid(), name: z.string().trim().min(1) });

router.get('/sections', asyncHandler(async (req, res) => {
  const params = [schoolId(req)];
  let sql = `SELECT * FROM sections WHERE school_id = $1`;
  if (req.query.class_id) { params.push(req.query.class_id); sql += ` AND class_id = $2`; }
  sql += ` ORDER BY name`;
  const { rows } = await query(sql, params);
  res.json(rows);
}));

router.post('/sections', authorize('admin'), validate(sectionSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO sections (school_id, class_id, name) VALUES ($1,$2,$3) RETURNING *`,
    [schoolId(req), req.body.class_id, req.body.name]);
  res.status(201).json(rows[0]);
}));

router.put('/sections/:id', authorize('admin'), validate(sectionSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE sections SET class_id=$1, name=$2 WHERE id=$3 AND school_id=$4 RETURNING *`,
    [req.body.class_id, req.body.name, req.params.id, schoolId(req)]);
  if (!rows.length) throw new ApiError(404, 'Section not found.');
  res.json(rows[0]);
}));

router.delete('/sections/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM sections WHERE id=$1 AND school_id=$2`, [req.params.id, schoolId(req)]);
  if (!rowCount) throw new ApiError(404, 'Section not found.');
  res.json({ ok: true });
}));

/* ---------------- FEE HEADS (charge categories) ---------------- */
const headSchema = z.object({
  name: z.string().trim().min(1),
  is_recurring: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

router.get('/fee-heads', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM fee_heads WHERE school_id = $1 ORDER BY sort_order, name`, [schoolId(req)]);
  res.json(rows);
}));

router.post('/fee-heads', authorize('admin'), validate(headSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO fee_heads (school_id, name, is_recurring, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [schoolId(req), b.name, b.is_recurring ?? false, b.is_active ?? true, b.sort_order ?? 0]);
  res.status(201).json(rows[0]);
}));

router.put('/fee-heads/:id', authorize('admin'), validate(headSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE fee_heads SET name=$1, is_recurring=$2, is_active=$3, sort_order=$4
     WHERE id=$5 AND school_id=$6 RETURNING *`,
    [b.name, b.is_recurring ?? false, b.is_active ?? true, b.sort_order ?? 0, req.params.id, schoolId(req)]);
  if (!rows.length) throw new ApiError(404, 'Fee head not found.');
  res.json(rows[0]);
}));

/* ---------------- SCHOOL SETTINGS ---------------- */
const settingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  tagline: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
});

router.get('/settings', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM schools WHERE id = $1`, [schoolId(req)]);
  if (!rows.length) throw new ApiError(404, 'School not found.');
  res.json(rows[0]);
}));

router.put('/settings', authorize('admin'), validate(settingsSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE schools SET
       name = COALESCE($1, name), tagline = $2, address = $3, phone = $4, logo_url = $5
     WHERE id = $6 RETURNING *`,
    [b.name ?? null, b.tagline ?? null, b.address ?? null, b.phone ?? null, b.logo_url ?? null, schoolId(req)]);
  res.json(rows[0]);
}));

export default router;
