import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { ensureMonthlyCharges, recordPayment, monthStart } from '../services/feeEngine.js';
import { withTransaction } from '../db/pool.js';

const router = Router();

// First day of the month AFTER the given 'YYYY-MM' (for exclusive upper bound).
const monthAfter = (m) => {
  const d = new Date(monthStart(m) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

/* ---- GET /api/fees/students/:id/charges ---- */
router.get('/students/:id/charges', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT cb.*, fh.name AS fee_head_name, fh.is_recurring
       FROM v_charge_balances cb
       JOIN fee_heads fh ON fh.id = cb.fee_head_id
       WHERE cb.student_id = $1 AND cb.school_id = $2
       ORDER BY COALESCE(cb.period_month, cb.charge_date)`,
    [req.params.id, req.user.school_id]
  );
  res.json(rows);
}));

/* ---- GET /api/fees/students/:id/balance ---- */
router.get('/students/:id/balance', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM v_student_balances WHERE student_id = $1 AND school_id = $2`,
    [req.params.id, req.user.school_id]
  );
  res.json(rows[0] || { student_id: req.params.id, total_charged: 0, total_paid: 0, total_balance: 0 });
}));

/* ---- GET /api/fees/students/:id/ledger  (charges + payments) ---- */
router.get('/students/:id/ledger', asyncHandler(async (req, res) => {
  const charges = await query(
    `SELECT cb.*, fh.name AS fee_head_name
       FROM v_charge_balances cb JOIN fee_heads fh ON fh.id = cb.fee_head_id
       WHERE cb.student_id = $1 AND cb.school_id = $2
       ORDER BY COALESCE(cb.period_month, cb.charge_date)`,
    [req.params.id, req.user.school_id]
  );
  const payments = await query(
    `SELECT p.*,
       COALESCE(json_agg(json_build_object('charge_id', pa.charge_id, 'amount', pa.amount))
                FILTER (WHERE pa.id IS NOT NULL), '[]') AS allocations
       FROM payments p
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       WHERE p.student_id = $1 AND p.school_id = $2
       GROUP BY p.id
       ORDER BY p.paid_date DESC, p.created_at DESC`,
    [req.params.id, req.user.school_id]
  );
  res.json({ charges: charges.rows, payments: payments.rows });
}));

/* ---- POST /api/fees/students/:id/charges  (add a one-time or specific charge) ---- */
const chargeSchema = z.object({
  fee_head_id: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  description: z.string().optional().nullable(),
  charge_date: z.string().optional().nullable(),
  period_month: z.string().optional().nullable(),
});

router.post('/students/:id/charges', authorize('admin', 'accountant'), validate(chargeSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    // confirm student belongs to this school
    const s = await query(`SELECT id FROM students WHERE id=$1 AND school_id=$2`,
      [req.params.id, req.user.school_id]);
    if (!s.rows.length) throw new ApiError(404, 'Student not found.');

    const { rows } = await query(
      `INSERT INTO charges (school_id, student_id, fee_head_id, period_month, description, amount, charge_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8) RETURNING *`,
      [req.user.school_id, req.params.id, b.fee_head_id,
        b.period_month ? monthStart(b.period_month) : null,
        b.description || null, b.amount, b.charge_date || null, req.user.sub]
    );
    res.status(201).json(rows[0]);
  }));

/* ---- POST /api/fees/students/:id/generate-monthly  { upto: 'YYYY-MM' } ---- */
router.post('/students/:id/generate-monthly', authorize('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const upto = req.body?.upto || new Date().toISOString().slice(0, 7);
    const created = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, monthly_fee, to_char(fee_start_month,'YYYY-MM') AS fee_start_month
           FROM students WHERE id = $1 AND school_id = $2`,
        [req.params.id, req.user.school_id]
      );
      if (!rows.length) throw new ApiError(404, 'Student not found.');
      return ensureMonthlyCharges(client, {
        schoolId: req.user.school_id, student: rows[0], uptoMonth: upto,
      });
    });
    res.json({ created });
  }));

/* ---- POST /api/fees/payments  (record a payment + allocations) ---- */
const paymentSchema = z.object({
  student_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  paid_date: z.string().optional().nullable(),
  method: z.enum(['cash', 'bank', 'online', 'other']).optional(),
  voucher_no: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  allocations: z.array(z.object({
    charge_id: z.string().uuid(),
    amount: z.coerce.number().positive(),
  })).optional(),
});

router.post('/payments', authorize('admin', 'accountant'), validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const result = await recordPayment({
      schoolId: req.user.school_id,
      studentId: req.body.student_id,
      amount: req.body.amount,
      paidDate: req.body.paid_date,
      method: req.body.method,
      voucherNo: req.body.voucher_no,
      note: req.body.note,
      receivedBy: req.user.sub,
      allocations: req.body.allocations,
    });
    res.status(201).json(result);
  }));

/* ---- GET /api/fees/report?from=YYYY-MM&to=YYYY-MM&class_id=&section_id=&status= ---- */
router.get('/report', asyncHandler(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 7);
  const to = req.query.to || from;
  const params = [req.user.school_id, monthStart(from), monthAfter(to)];
  let sql = `
    SELECT s.id, s.student_code, s.admission_no, s.name, s.class_id, s.section_id,
           s.monthly_fee, to_char(s.fee_start_month,'YYYY-MM') AS fee_start_month, s.status,
           COALESCE(sb.total_balance, 0) AS total_balance,
           COALESCE(pp.period_charged, 0) AS period_charged,
           COALESCE(pp.period_paid, 0)    AS period_paid,
           COALESCE(pp.period_charged, 0) - COALESCE(pp.period_paid, 0) AS period_balance
      FROM students s
      LEFT JOIN v_student_balances sb ON sb.student_id = s.id
      LEFT JOIN (
        SELECT cb.student_id,
               SUM(cb.amount)      AS period_charged,
               SUM(cb.amount_paid) AS period_paid
          FROM v_charge_balances cb
          WHERE cb.school_id = $1
            AND COALESCE(cb.period_month, cb.charge_date) >= $2
            AND COALESCE(cb.period_month, cb.charge_date) <  $3
          GROUP BY cb.student_id
      ) pp ON pp.student_id = s.id
      WHERE s.school_id = $1`;
  if (req.query.class_id)   { params.push(req.query.class_id);   sql += ` AND s.class_id = $${params.length}`; }
  if (req.query.section_id) { params.push(req.query.section_id); sql += ` AND s.section_id = $${params.length}`; }
  if (req.query.status)     { params.push(req.query.status);     sql += ` AND s.status = $${params.length}`; }
  else                      { sql += ` AND s.status = 'active'`; }
  sql += ` ORDER BY s.student_code`;
  const { rows } = await query(sql, params);
  res.json(rows);
}));

export default router;
