-- =====================================================================
-- School Management System — PostgreSQL Schema (Phase 1)
-- =====================================================================
-- Design goals:
--   1. MULTI-SCHOOL ready: every table carries school_id so one install
--      can serve many schools (SaaS) and each school's data is isolated.
--   2. MONEY IS EXACT: all amounts use NUMERIC(12,2). PostgreSQL NUMERIC
--      is exact decimal (no floating-point error), so 500 is always 500.
--   3. ONE SOURCE OF TRUTH for balances: a student's dues/paid/balance are
--      NEVER stored as a column. They are computed from charges vs payments
--      through the views at the bottom. This removes the "499/498 in another
--      place" class of bug entirely.
--   4. EXTENSIBLE: charge categories live in a `fee_heads` table, so a new
--      school can add its own charge types (Transport, Hostel, etc.) without
--      any code change.
--
-- Money model (simple double-entry-lite accounting):
--   charges              = what a student OWES (immutable history)
--   payments             = money RECEIVED
--   payment_allocations  = which charge each payment paid (handles partials)
--   balance              = SUM(charges) - SUM(allocations)   [always derived]
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. SCHOOLS (tenant root)
-- ---------------------------------------------------------------------
CREATE TABLE schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  tagline     text,
  address     text,
  phone       text,
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. USERS (real authentication + roles)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email         text NOT NULL,
  password_hash text NOT NULL,          -- bcrypt/argon2 hash, never plain text
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'accountant'
                CHECK (role IN ('admin','accountant','teacher')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, email)
);

-- ---------------------------------------------------------------------
-- 3. CLASSES & SECTIONS
-- ---------------------------------------------------------------------
CREATE TABLE classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

-- ---------------------------------------------------------------------
-- 4. PARENTS / GUARDIANS  (one record per family; siblings share it)
-- ---------------------------------------------------------------------
CREATE TABLE parents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  father_name       text,
  father_cnic       text,
  father_occupation text,
  father_contact    text,
  mother_name       text,
  mother_cnic       text,
  mother_contact    text,
  address           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Stop duplicate families: same CNIC cannot be entered twice in one school.
CREATE UNIQUE INDEX uq_parents_father_cnic
  ON parents (school_id, father_cnic)
  WHERE father_cnic IS NOT NULL AND father_cnic <> '';

-- ---------------------------------------------------------------------
-- 5. STUDENTS
-- ---------------------------------------------------------------------
-- student_code: the stable, human-facing "Student ID" (auto, per school,
--               never reused — replaces the old localStorage counter).
-- admission_no: the manually entered admission/registration number.
CREATE SEQUENCE IF NOT EXISTS student_code_seq;

CREATE TABLE students (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_code     bigint NOT NULL DEFAULT nextval('student_code_seq'),
  admission_no     text,
  name             text NOT NULL,
  dob              date,
  gender           text CHECK (gender IN ('Male','Female','Other')),
  picture_url      text,
  admission_date   date,
  leaving_date     date,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','left','struck_off')),
  medical_info     text,
  address          text,
  -- Current tuition rate. Used ONLY to generate future monthly charges.
  -- Changing it never rewrites past charges (those are frozen rows).
  monthly_fee      numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  -- First month tuition applies (stored as the 1st of that month).
  fee_start_month  date,
  parent_id        uuid REFERENCES parents(id) ON DELETE SET NULL,
  class_id         uuid REFERENCES classes(id) ON DELETE SET NULL,
  section_id       uuid REFERENCES sections(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_code)
);
CREATE INDEX idx_students_school   ON students (school_id);
CREATE INDEX idx_students_parent   ON students (parent_id);
CREATE INDEX idx_students_class    ON students (class_id, section_id);
CREATE TRIGGER trg_students_updated
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 6. ENROLLMENT HISTORY (admission, promotion, transfer)
-- ---------------------------------------------------------------------
CREATE TABLE student_enrollment_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class_id    uuid REFERENCES classes(id) ON DELETE SET NULL,
  from_section_id  uuid REFERENCES sections(id) ON DELETE SET NULL,
  to_class_id      uuid REFERENCES classes(id) ON DELETE SET NULL,
  to_section_id    uuid REFERENCES sections(id) ON DELETE SET NULL,
  change_type      text NOT NULL DEFAULT 'promotion'
                   CHECK (change_type IN ('admission','promotion','transfer')),
  change_date      date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_student ON student_enrollment_history (student_id);

-- ---------------------------------------------------------------------
-- 7. FEE HEADS (school-configurable charge categories — extensibility)
-- ---------------------------------------------------------------------
-- is_recurring = true  -> billed every month (e.g. Tuition)
-- is_recurring = false -> one-time charge (e.g. Admission Fee, Fine)
CREATE TABLE fee_heads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          text NOT NULL,
  is_recurring  boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

-- ---------------------------------------------------------------------
-- 8. CHARGES — what a student OWES (immutable ledger)
-- ---------------------------------------------------------------------
-- Each row is a frozen snapshot of one due. Editing the student's
-- monthly_fee later does NOT touch existing rows -> correct history.
CREATE TABLE charges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id   uuid NOT NULL REFERENCES fee_heads(id),
  -- For recurring tuition: the 1st of the billed month. NULL for one-time.
  period_month  date,
  description   text,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),  -- the snapshot
  charge_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_charges_student ON charges (student_id);
CREATE INDEX idx_charges_school  ON charges (school_id);
CREATE INDEX idx_charges_period  ON charges (student_id, period_month);
-- Never bill the same monthly head twice for the same month.
CREATE UNIQUE INDEX uq_charges_monthly
  ON charges (student_id, fee_head_id, period_month)
  WHERE period_month IS NOT NULL;

-- ---------------------------------------------------------------------
-- 9. PAYMENTS — money RECEIVED (one row per receipt/voucher)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_date     date NOT NULL DEFAULT CURRENT_DATE,
  method        text NOT NULL DEFAULT 'cash'
                CHECK (method IN ('cash','bank','online','other')),
  voucher_no    text,
  note          text,
  received_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_student ON payments (student_id);
CREATE INDEX idx_payments_school  ON payments (school_id);

-- ---------------------------------------------------------------------
-- 10. PAYMENT ALLOCATIONS — which charge each payment settled
-- ---------------------------------------------------------------------
-- This is how partial payments are handled exactly, with no rounding.
CREATE TABLE payment_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  charge_id   uuid NOT NULL REFERENCES charges(id)  ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0)
);
CREATE INDEX idx_alloc_payment ON payment_allocations (payment_id);
CREATE INDEX idx_alloc_charge  ON payment_allocations (charge_id);

-- Safety: total allocated to a charge can never exceed the charge amount.
CREATE OR REPLACE FUNCTION check_allocation_not_exceed() RETURNS trigger AS $$
DECLARE
  charge_amt   numeric(12,2);
  allocated    numeric(12,2);
BEGIN
  SELECT amount INTO charge_amt FROM charges WHERE id = NEW.charge_id;
  SELECT COALESCE(SUM(amount),0) INTO allocated
    FROM payment_allocations
    WHERE charge_id = NEW.charge_id AND id <> NEW.id;
  IF allocated + NEW.amount > charge_amt THEN
    RAISE EXCEPTION 'Allocation % exceeds remaining balance on charge % (charge amount %, already allocated %)',
      NEW.amount, NEW.charge_id, charge_amt, allocated;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alloc_not_exceed
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION check_allocation_not_exceed();

-- =====================================================================
-- VIEWS — THE SINGLE SOURCE OF TRUTH FOR ALL MONEY.
-- The frontend/API must read balances from here, never recompute them.
-- =====================================================================

-- Per-charge: how much is paid, what is left, and the derived status.
CREATE OR REPLACE VIEW v_charge_balances AS
SELECT
  c.*,
  COALESCE(a.paid, 0)              AS amount_paid,
  c.amount - COALESCE(a.paid, 0)   AS balance,
  CASE
    WHEN COALESCE(a.paid,0) >= c.amount THEN 'paid'
    WHEN COALESCE(a.paid,0) > 0         THEN 'partial'
    ELSE 'unpaid'
  END                              AS status
FROM charges c
LEFT JOIN (
  SELECT charge_id, SUM(amount) AS paid
  FROM payment_allocations
  GROUP BY charge_id
) a ON a.charge_id = c.id;

-- Per-student: total charged, total paid, outstanding balance.
CREATE OR REPLACE VIEW v_student_balances AS
SELECT
  s.id                              AS student_id,
  s.school_id,
  COALESCE(SUM(cb.amount), 0)       AS total_charged,
  COALESCE(SUM(cb.amount_paid), 0)  AS total_paid,
  COALESCE(SUM(cb.balance), 0)      AS total_balance
FROM students s
LEFT JOIN v_charge_balances cb ON cb.student_id = s.id
GROUP BY s.id, s.school_id;
