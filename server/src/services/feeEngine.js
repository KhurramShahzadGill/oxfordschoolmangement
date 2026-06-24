/*
 * FEE ENGINE — the single source of truth for all money operations.
 *
 * Nothing else in the system is allowed to compute balances or write
 * payments. Every screen reads balances from the database views and writes
 * money only through here. This is what guarantees "500 is always 500".
 */
import { withTransaction } from '../db/pool.js';
import { ApiError } from '../middleware/error.js';

// Normalise any 'YYYY-MM' or date string to the first day of that month.
export const monthStart = (m) => {
  const [y, mo] = String(m).split('-');
  return `${y}-${String(mo).padStart(2, '0')}-01`;
};

// First day of the month after the given 'YYYY-MM-01' date.
const addMonth = (isoDate) => {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

/*
 * Make sure a monthly tuition charge exists for every month from the
 * student's fee_start_month up to (and including) `uptoMonth`.
 * Idempotent: never creates a duplicate for a month that already has one.
 * Each charge freezes the student's CURRENT monthly_fee as its amount.
 */
export const ensureMonthlyCharges = async (client, { schoolId, student, uptoMonth }) => {
  if (!student.fee_start_month || Number(student.monthly_fee) <= 0) return 0;

  const { rows: heads } = await client.query(
    `SELECT id FROM fee_heads
       WHERE school_id = $1 AND is_recurring = true AND is_active = true
       ORDER BY sort_order LIMIT 1`,
    [schoolId]
  );
  if (!heads.length) return 0;
  const tuitionHeadId = heads[0].id;

  let m = monthStart(student.fee_start_month);
  const end = monthStart(uptoMonth);
  let created = 0;

  while (m <= end) {
    const { rows: existing } = await client.query(
      `SELECT 1 FROM charges WHERE student_id = $1 AND fee_head_id = $2 AND period_month = $3`,
      [student.id, tuitionHeadId, m]
    );
    if (!existing.length) {
      await client.query(
        `INSERT INTO charges (school_id, student_id, fee_head_id, period_month, description, amount, charge_date)
         VALUES ($1, $2, $3, $4, $5, $6, $4)`,
        [schoolId, student.id, tuitionHeadId, m, 'Monthly Tuition Fee', student.monthly_fee]
      );
      created += 1;
    }
    m = addMonth(m);
  }
  return created;
};

// Outstanding charges for a student, oldest first (used for auto-allocation).
const getOutstandingCharges = async (client, schoolId, studentId) => {
  const { rows } = await client.query(
    `SELECT id, balance FROM v_charge_balances
       WHERE school_id = $1 AND student_id = $2 AND balance > 0
       ORDER BY COALESCE(period_month, charge_date), created_at`,
    [schoolId, studentId]
  );
  return rows;
};

/*
 * Record a payment and allocate it to charges.
 * - If `allocations` ([{ charge_id, amount }]) is given, use them.
 * - Otherwise auto-allocate the amount to the oldest outstanding charges.
 * All writes happen in one transaction; the DB blocks over-allocation.
 */
export const recordPayment = async ({
  schoolId, studentId, amount, paidDate, method, voucherNo, note, receivedBy, allocations,
}) => {
  const payAmount = Number(amount);
  if (!(payAmount > 0)) throw new ApiError(400, 'Payment amount must be greater than zero.');

  return withTransaction(async (client) => {
    const { rows: srows } = await client.query(
      `SELECT id FROM students WHERE id = $1 AND school_id = $2`,
      [studentId, schoolId]
    );
    if (!srows.length) throw new ApiError(404, 'Student not found.');

    // Build the allocation list.
    let allocs = Array.isArray(allocations) && allocations.length
      ? allocations.map((a) => ({ charge_id: a.charge_id, amount: Number(a.amount) }))
      : [];

    if (!allocs.length) {
      let remaining = payAmount;
      const outstanding = await getOutstandingCharges(client, schoolId, studentId);
      for (const c of outstanding) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(c.balance));
        allocs.push({ charge_id: c.id, amount: take });
        remaining -= take;
      }
    }

    const totalAlloc = allocs.reduce((s, a) => s + a.amount, 0);
    if (totalAlloc - payAmount > 0.001) {
      throw new ApiError(400, 'Allocated amounts exceed the payment amount.');
    }

    const { rows: prows } = await client.query(
      `INSERT INTO payments (school_id, student_id, amount, paid_date, method, voucher_no, note, received_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [schoolId, studentId, payAmount, paidDate || new Date().toISOString().slice(0, 10),
        method || 'cash', voucherNo || null, note || null, receivedBy || null]
    );
    const payment = prows[0];

    for (const a of allocs) {
      if (!(a.amount > 0)) continue;
      const { rows: crows } = await client.query(
        `SELECT id FROM charges WHERE id = $1 AND student_id = $2 AND school_id = $3`,
        [a.charge_id, studentId, schoolId]
      );
      if (!crows.length) throw new ApiError(400, 'A selected charge does not belong to this student.');
      // The DB trigger rejects any allocation that exceeds the charge balance.
      await client.query(
        `INSERT INTO payment_allocations (payment_id, charge_id, amount) VALUES ($1, $2, $3)`,
        [payment.id, a.charge_id, a.amount]
      );
    }

    return { payment, allocations: allocs };
  });
};
