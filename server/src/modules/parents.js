import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';

const router = Router();

const parentSchema = z.object({
  father_name: z.string().trim().optional().nullable(),
  father_cnic: z.string().trim().optional().nullable(),
  father_occupation: z.string().trim().optional().nullable(),
  father_contact: z.string().trim().optional().nullable(),
  mother_name: z.string().trim().optional().nullable(),
  mother_cnic: z.string().trim().optional().nullable(),
  mother_contact: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

const FIELDS = ['father_name', 'father_cnic', 'father_occupation', 'father_contact',
  'mother_name', 'mother_cnic', 'mother_contact', 'address'];

const toRow = (b) => FIELDS.map((f) => b[f] || null);

// GET /api/parents  (optional ?q= search by name / cnic / contact)
router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const params = [req.user.school_id];
  let sql = `SELECT * FROM parents WHERE school_id = $1`;
  if (q) {
    params.push(`%${q}%`);
    const stripped = `%${String(q).replace(/-/g, '')}%`;
    params.push(stripped);
    sql += ` AND (father_name ILIKE $2 OR mother_name ILIKE $2
                  OR replace(father_cnic,'-','') ILIKE $3
                  OR replace(mother_cnic,'-','') ILIKE $3
                  OR father_contact ILIKE $2 OR mother_contact ILIKE $2)`;
  }
  sql += ` ORDER BY father_name`;
  const { rows } = await query(sql, params);
  res.json(rows);
}));

// GET /api/parents/:id  (+ their children)
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM parents WHERE id = $1 AND school_id = $2`,
    [req.params.id, req.user.school_id]
  );
  if (!rows.length) throw new ApiError(404, 'Parent not found.');
  const children = await query(
    `SELECT id, student_code, name, class_id, section_id, status
       FROM students WHERE parent_id = $1 ORDER BY student_code`,
    [req.params.id]
  );
  res.json({ ...rows[0], children: children.rows });
}));

// POST /api/parents   — find-or-create by father_cnic (avoids duplicates)
router.post('/', authorize('admin', 'accountant'), validate(parentSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.father_cnic) {
    const existing = await query(
      `SELECT * FROM parents WHERE school_id = $1 AND father_cnic = $2`,
      [req.user.school_id, b.father_cnic]
    );
    if (existing.rows.length) return res.json({ parent: existing.rows[0], isNew: false });
  }
  const { rows } = await query(
    `INSERT INTO parents (school_id, father_name, father_cnic, father_occupation, father_contact,
       mother_name, mother_cnic, mother_contact, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.school_id, ...toRow(b)]
  );
  res.status(201).json({ parent: rows[0], isNew: true });
}));

// PUT /api/parents/:id
router.put('/:id', authorize('admin', 'accountant'), validate(parentSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE parents SET father_name=$1, father_cnic=$2, father_occupation=$3, father_contact=$4,
       mother_name=$5, mother_cnic=$6, mother_contact=$7, address=$8
     WHERE id=$9 AND school_id=$10 RETURNING *`,
    [...toRow(req.body), req.params.id, req.user.school_id]
  );
  if (!rows.length) throw new ApiError(404, 'Parent not found.');
  res.json(rows[0]);
}));

// DELETE /api/parents/:id  (blocked if children still enrolled)
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const kids = await query(
    `SELECT 1 FROM students WHERE parent_id = $1 LIMIT 1`, [req.params.id]
  );
  if (kids.rows.length) throw new ApiError(409, 'This parent still has enrolled children. Remove or reassign them first.');
  const { rowCount } = await query(
    `DELETE FROM parents WHERE id = $1 AND school_id = $2`,
    [req.params.id, req.user.school_id]
  );
  if (!rowCount) throw new ApiError(404, 'Parent not found.');
  res.json({ ok: true });
}));

export default router;
