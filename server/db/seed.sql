-- =====================================================================
-- Seed data — run AFTER schema.sql
-- Creates one demo school, an admin user, default classes/sections and
-- the standard fee heads. Safe to edit before running.
-- =====================================================================

-- 1) Demo school -------------------------------------------------------
INSERT INTO schools (id, name, tagline, address, phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Oxford Grammar School',
  'Excellence in Education',
  'Chak No. 202/RB, Gatti Faisalabad',
  '0321-6088202'
);

-- 2) Admin user --------------------------------------------------------
-- NOTE: password_hash below is a PLACEHOLDER. The backend will generate a
-- real bcrypt hash on first setup. Do not ship this value to production.
INSERT INTO users (school_id, email, password_hash, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@oxford.edu',
  '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH_AT_SETUP',
  'School Administrator',
  'admin'
);

-- 3) Default fee heads -------------------------------------------------
INSERT INTO fee_heads (school_id, name, is_recurring, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Tuition Fee',    true,  1),
  ('00000000-0000-0000-0000-000000000001', 'Admission Fee',  false, 2),
  ('00000000-0000-0000-0000-000000000001', 'Security Fee',   false, 3),
  ('00000000-0000-0000-0000-000000000001', 'Paper Fund',     false, 4),
  ('00000000-0000-0000-0000-000000000001', 'Stationery Fee', false, 5),
  ('00000000-0000-0000-0000-000000000001', 'Fine',           false, 6),
  ('00000000-0000-0000-0000-000000000001', 'Other Charges',  false, 7);

-- 4) Default classes ---------------------------------------------------
INSERT INTO classes (school_id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nursery', 1),
  ('00000000-0000-0000-0000-000000000001', 'Prep',    2),
  ('00000000-0000-0000-0000-000000000001', 'Class 1', 3),
  ('00000000-0000-0000-0000-000000000001', 'Class 2', 4),
  ('00000000-0000-0000-0000-000000000001', 'Class 3', 5);

-- 5) A few sections (Section A for every class) ------------------------
INSERT INTO sections (school_id, class_id, name)
SELECT school_id, id, 'A' FROM classes
WHERE school_id = '00000000-0000-0000-0000-000000000001';
