import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { monthStart } from '../services/feeEngine.js';

const router = Router();

const studentSchema = z.object({
  admission_no: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1, 'Name is required'),
  dob: z.string().optional().nullable(),
  gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
  picture_url: z.string().optional().nullable(),
  admission_date: z.string().optional().nullable(),
  leaving_date: z.string().optional().nullable(),
  status: z.enum(['active', 'left', 'struck_off']).optional(),
  medical_info: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  monthly_fee: z.coerce.number().nonnegative().optional(),
  fee_start_month: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  class_id: z.string().uuid().optional().nullable(),
  section_id: z.string().uuid().optional().nullable(),
});

const COLS = `id, school_id, student_code, admission_no, name, dob, gender, picture_url,
  admission_date, leaving_date, status, medical_info, address, monthly_fee,
  to_char(fee_start_month, 'YYYY-MM') AS fee_start_month,
  parent_id, class_id, section_id, created_at, updated_at`;

// Convert validated body into DB-ready values.
const toRow = (b) => ({
  admission_no: b.admission_no || null,
  name: b.name,
  dob: b.dob || null,
  gender: b.gender || null,
  picture_url: b.picture_url || null,
  admission_date: b.admission_date || null,
  leaving_date: b.leaving_date || null,
  status: b.status || 'active',
  medical_info: b.medical_info || null,
  address: b.address || null,
  monthly_fee: b.monthly_fee ?? 0,
  fee_start_month: b.fee_start_month ? monthStart(b.fee_start_month) : null,
  parent_id: b.parent_id || null,
  class_id: b.class_id || null,
  section_id: b.section_id || null,
});

// Same columns as COLS but qualified with the `s.` alias, for the join query.
const COLS_S = `s.id, s.school_id, s.student_code, s.admission_no, s.name, s.dob, s.gender,
  s.picture_url, s.admission_date, s.leaving_date, s.status, s.medical_info, s.address,
  s.monthly_fee, to_char(s.fee_start_month, 'YYYY-MM') AS fee_start_month,
  s.parent_id, s.class_id, s.section_id, s.created_at, s.updated_at`;

// GET /api/students  (filters: class_id, section_id, status, q)
router.get('/', asyncHandler(async (req, res) => {
  const { class_id, section_id, status, q } = req.query;
  const params = [req.user.school_id];
  let sql = `SELECT ${COLS_S},
      COALESCE(b.total_charged, 0) AS total_charged,
      COALESCE(b.total_paid, 0)    AS total_paid,
      COALESCE(b.total_balance, 0) AS total_balance
    FROM students s
    LEFT JOIN v_student_balances b ON b.student_id = s.id
    WHERE s.school_id = $1`;
  if (class_id)   { params.push(class_id);   sql += ` AND s.class_id = $${params.length}`; }
  if (section_id) { params.push(section_id); sql += ` AND s.section_id = $${params.length}`; }
  if (status)     { params.push(status);     sql += ` AND s.status = $${params.length}`; }
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (s.name ILIKE $${params.length} OR s.admission_no ILIKE $${params.length}
                  OR CAST(s.student_code AS text) ILIKE $${params.length})`;
  }
  sql += ` ORDER BY s.student_code`;
  const { rows } = await query(sql, params);
  res.json(rows);
}));

// GET /api/students/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLS} FROM students WHERE id = $1 AND school_id = $2`,
    [req.params.id, req.user.school_id]
  );
  if (!rows.length) throw new ApiError(404, 'Student not found.');
  res.json(rows[0]);
}));

// POST /api/students
router.post('/', authorize('admin', 'accountant'), validate(studentSchema), asyncHandler(async (req, res) => {
  const r = toRow(req.body);
  const { rows } = await query(
    `INSERT INTO students
      (school_id, admission_no, name, dob, gender, picture_url, admission_date, leaving_date,
       status, medical_info, address, monthly_fee, fee_start_month, parent_id, class_id, section_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING ${COLS}`,
    [req.user.school_id, r.admission_no, r.name, r.dob, r.gender, r.picture_url, r.admission_date,
      r.leaving_date, r.status, r.medical_info, r.address, r.monthly_fee, r.fee_start_month,
      r.parent_id, r.class_id, r.section_id]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/students/:id
router.put('/:id', authorize('admin', 'accountant'), validate(studentSchema), asyncHandler(async (req, res) => {
  const r = toRow(req.body);
  const { rows } = await query(
    `UPDATE students SET
       admission_no=$1, name=$2, dob=$3, gender=$4, picture_url=$5, admission_date=$6,
       leaving_date=$7, status=$8, medical_info=$9, address=$10, monthly_fee=$11,
       fee_start_month=$12, parent_id=$13, class_id=$14, section_id=$15
     WHERE id=$16 AND school_id=$17
     RETURNING ${COLS}`,
    [r.admission_no, r.name, r.dob, r.gender, r.picture_url, r.admission_date, r.leaving_date,
      r.status, r.medical_info, r.address, r.monthly_fee, r.fee_start_month, r.parent_id,
      r.class_id, r.section_id, req.params.id, req.user.school_id]
  );
  if (!rows.length) throw new ApiError(404, 'Student not found.');
  res.json(rows[0]);
}));

// DELETE /api/students/:id  (charges/payments/history cascade via FK)
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM students WHERE id = $1 AND school_id = $2`,
    [req.params.id, req.user.school_id]
  );
  if (!rowCount) throw new ApiError(404, 'Student not found.');
  res.json({ ok: true });
}));

// POST /api/students/:id/promote  { to_class_id, to_section_id }
router.post('/:id/promote', authorize('admin', 'accountant'), asyncHandler(async (req, res) => {
  const { to_class_id, to_section_id } = req.body;
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, class_id, section_id FROM students WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.user.school_id]
    );
    if (!rows.length) throw new ApiError(404, 'Student not found.');
    const s = rows[0];
    await client.query(
      `INSERT INTO student_enrollment_history
         (school_id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, change_type)
       VALUES ($1,$2,$3,$4,$5,$6,'promotion')`,
      [req.user.school_id, s.id, s.class_id, s.section_id, to_class_id || null, to_section_id || null]
    );
    const upd = await client.query(
      `UPDATE students SET class_id = $1, section_id = $2 WHERE id = $3 RETURNING ${COLS}`,
      [to_class_id || null, to_section_id || null, s.id]
    );
    return upd.rows[0];
  });
  res.json(result);
}));

// GET /api/students/:id/history
router.get('/:id/history', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM student_enrollment_history
       WHERE student_id = $1 AND school_id = $2 ORDER BY change_date DESC, created_at DESC`,
    [req.params.id, req.user.school_id]
  );
  res.json(rows);
}));

export default router;
