/*
 * Demo data layer — everything lives in the visitor's own browser.
 *
 * This mirrors db.cloud.js function for function, so every screen behaves
 * exactly the same in the demo as it does in the real app. The difference is
 * only where the data goes: localStorage instead of Supabase. Nothing here
 * touches the network, so a demo visitor can never reach a real school.
 *
 * The first visit seeds a small sample school so the demo is not empty.
 */

import { DEFAULT_IMPORTANT_KEYS } from '../utils/completeness';

const KEY = (name) => `demo_${name}`;
const read = (name) => { try { return JSON.parse(localStorage.getItem(KEY(name)) || '[]'); } catch { return []; } };
const write = (name, rows) => localStorage.setItem(KEY(name), JSON.stringify(rows));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

const money = (v) => Math.round(Number(v) || 0);
const STUDENT_MONEY = ['monthly_fee', 'admission_fee', 'security_fee', 'paper_fund', 'stationery_fee', 'other_fee'];
const FEE_MONEY = ['monthly_fee', 'fine', 'paper_fund', 'other_charges', 'amount_paid'];
const CHARGE_MONEY = ['amount', 'amount_paid'];
const normMoney = (obj, keys) => {
  const o = { ...obj };
  keys.forEach(k => { if (k in o) o[k] = (o[k] === '' || o[k] == null) ? 0 : money(o[k]); });
  return o;
};

// ===== Fuzzy name matching (same rules as the cloud layer) =====
const fuzzyNameMatch = (name, query) => {
  if (!name || !query) return false;
  const n = name.toLowerCase(); const q = query.toLowerCase();
  if (n.includes(q)) return true;
  const normalize = (s) => s
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/sh/g, 's').replace(/ph/g, 'f')
    .replace(/th/g, 't').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ch/g, 'c')
    .replace(/aa/g, 'a').replace(/([a-z])\1/g, '$1').replace(/h$/, '').replace(/d$/, 't');
  return normalize(n).includes(normalize(q)) || normalize(q).includes(normalize(n));
};

export const ADMISSION_HEADS = [
  { key: 'admission_fee',  label: 'Admission Fee' },
  { key: 'security_fee',   label: 'Security Fee' },
  { key: 'paper_fund',     label: 'Paper Fund' },
  { key: 'stationery_fee', label: 'Stationery Fee' },
  { key: 'other_fee',      label: 'Other Charges' },
];

// ===== Sample data, written once so the demo opens with something to look at =====
export const seedDemo = () => {
  if (localStorage.getItem(KEY('seeded'))) return;

  const classes = [
    { id: uid(), class_name: 'Play Group', sort_order: 1 },
    { id: uid(), class_name: 'Nursery',    sort_order: 2 },
    { id: uid(), class_name: 'Class 1',    sort_order: 3 },
  ];
  const sections = [
    { id: uid(), class_id: classes[1].id, section_name: 'A' },
    { id: uid(), class_id: classes[2].id, section_name: 'A' },
  ];
  const parents = [
    { id: uid(), father_name: 'Ahmed Khan', father_cnic: '35201-1234567-1', father_occupation: 'Engineer',
      father_contact: '0300-1112223', mother_name: 'Ayesha Khan', mother_cnic: '35201-7654321-2', mother_contact: '0301-9998887' },
    { id: uid(), father_name: 'Bilal Sheikh', father_cnic: '35202-2223334-5', father_occupation: 'Doctor',
      father_contact: '0321-4445556', mother_name: 'Fatima Sheikh', mother_cnic: '35202-9998887-6', mother_contact: '0333-1231234' },
  ];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const students = [
    { id: '1', roll_no: 'ADM-101', name: 'Hamza Khan', dob: '2016-04-12', gender: 'Male', status: 'Active',
      admission_date: '2024-04-01', address: 'Gatti, Faisalabad', monthly_fee: 2000, fee_start_month: thisMonth,
      parent_id: parents[0].id, class_id: classes[2].id, section_id: sections[1].id, picture: '', important_overrides: {} },
    { id: '2', roll_no: 'ADM-102', name: 'Sara Khan', dob: '2019-09-05', gender: 'Female', status: 'Active',
      admission_date: '2024-04-01', address: 'Gatti, Faisalabad', monthly_fee: 1500, fee_start_month: thisMonth,
      parent_id: parents[0].id, class_id: classes[1].id, section_id: sections[0].id, picture: '', important_overrides: {} },
    { id: '3', roll_no: 'ADM-103', name: 'Zain Sheikh', dob: '2017-01-22', gender: 'Male', status: 'Active',
      admission_date: '2024-04-01', address: 'Gatti, Faisalabad', monthly_fee: 2500, fee_start_month: thisMonth,
      parent_id: parents[1].id, class_id: classes[2].id, section_id: sections[1].id, picture: '', important_overrides: {} },
  ];

  write('classes', classes);
  write('sections', sections);
  write('parents', parents);
  write('students', students);
  write('fees', []);
  write('custom_charges', []);
  write('student_history', []);
  write('receipts', []);
  localStorage.setItem(KEY('last_student_id'), '3');
  localStorage.setItem(KEY('seeded'), '1');
};

// ===== School context (a single, local demo school) =====
export const loadSchoolContext = async () => getSettings();
export const getSchoolId = () => 'demo-school';
export const clearSchoolContext = () => {};

export const peekNextStudentId = () => null;

// ===== Photos: kept inline in the browser, no bucket involved =====
export const uploadStudentPhoto = async (picture) => picture || '';
export const deleteStudentPhoto = async () => {};

// ===== CLASSES =====
export const apiClasses = {
  getAll: async () => read('classes').slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  create: async (data) => {
    const rows = read('classes');
    const nextOrder = rows.reduce((mx, c) => Math.max(mx, Number(c.sort_order) || 0), 0) + 1;
    const row = { id: uid(), sort_order: nextOrder, ...data };
    rows.push(row); write('classes', rows);
    return row;
  },
  reorder: async (orderedIds) => {
    const rows = read('classes');
    orderedIds.forEach((id, i) => { const r = rows.find(x => x.id === id); if (r) r.sort_order = i + 1; });
    write('classes', rows);
    return true;
  },
  update: async (id, data) => {
    const rows = read('classes');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Class not found');
    rows[i] = { ...rows[i], ...data }; write('classes', rows);
    return rows[i];
  },
  delete: async (id) => {
    write('classes', read('classes').filter(r => r.id !== id));
    write('sections', read('sections').filter(s => s.class_id !== id)); // cascade
    return true;
  },
};

// ===== SECTIONS =====
export const apiSections = {
  getAll: async () => read('sections'),
  getByClassId: async (classId) => read('sections').filter(s => s.class_id === classId),
  create: async (data) => {
    const rows = read('sections');
    const row = { id: uid(), ...data };
    rows.push(row); write('sections', rows);
    return row;
  },
  update: async (id, data) => {
    const rows = read('sections');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Section not found');
    rows[i] = { ...rows[i], ...data }; write('sections', rows);
    return rows[i];
  },
  delete: async (id) => { write('sections', read('sections').filter(r => r.id !== id)); return true; },
};

// ===== PARENTS =====
export const apiParents = {
  getAll: async () => read('parents'),
  getById: async (id) => read('parents').find(p => p.id === id) || null,
  getByCnic: async (cnic) => read('parents').find(p => p.father_cnic === cnic || p.mother_cnic === cnic) || null,
  search: async (query) => {
    const q = (query || '').toLowerCase().replace(/-/g, '');
    return read('parents').filter(p =>
      (p.father_cnic || '').replace(/-/g, '').includes(q) ||
      (p.mother_cnic || '').replace(/-/g, '').includes(q) ||
      fuzzyNameMatch(p.father_name, query) || fuzzyNameMatch(p.mother_name, query));
  },
  create: async (data) => {
    const rows = read('parents');
    const row = { id: uid(), ...data };
    rows.push(row); write('parents', rows);
    return row;
  },
  createOrGet: async (data) => {
    const rows = read('parents');
    let existing = null;
    if (data.father_cnic) existing = rows.find(p => p.father_cnic === data.father_cnic);
    else if (data.father_name && data.father_contact) {
      existing = rows.find(p => p.father_name === data.father_name && p.father_contact === data.father_contact);
    }
    if (existing) return { parent: existing, isNew: false };
    const row = { id: uid(), ...data };
    rows.push(row); write('parents', rows);
    return { parent: row, isNew: true };
  },
  update: async (id, data) => {
    const rows = read('parents');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Parent not found');
    rows[i] = { ...rows[i], ...data }; write('parents', rows);
    return rows[i];
  },
  delete: async (id) => { write('parents', read('parents').filter(r => r.id !== id)); return true; },
};

// ===== STUDENTS =====
export const apiStudents = {
  getAll: async () => read('students'),
  getByParentId: async (parentId) => read('students').filter(s => s.parent_id === parentId),
  getById: async (id) => read('students').find(s => s.id === id) || null,
  search: async (query) => {
    const q = (query || '').toLowerCase();
    return read('students').filter(s =>
      String(s.id || '').toLowerCase().includes(q) ||
      (s.roll_no || '').toLowerCase().includes(q) ||
      fuzzyNameMatch(s.name, query));
  },
  create: async (data) => {
    const rows = read('students');
    // Ids only ever move forward, so a deleted student's id is never reused.
    const last = parseInt(localStorage.getItem(KEY('last_student_id')) || '0', 10) || 0;
    const maxExisting = rows.reduce((mx, s) => Math.max(mx, parseInt(s.id, 10) || 0), 0);
    const nextId = Math.max(last, maxExisting) + 1;
    localStorage.setItem(KEY('last_student_id'), String(nextId));

    const row = normMoney({ ...data, id: String(nextId), status: data.status || 'Active' }, STUDENT_MONEY);
    rows.push(row); write('students', rows);
    return row;
  },
  update: async (id, data) => {
    const rows = read('students');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Student not found');
    rows[i] = { ...rows[i], ...normMoney(data, STUDENT_MONEY) }; write('students', rows);
    return rows[i];
  },
  delete: async (id) => {
    write('students', read('students').filter(r => r.id !== id));
    // Cascade, mirroring the foreign keys in the real database.
    write('fees', read('fees').filter(f => f.student_id !== id));
    write('custom_charges', read('custom_charges').filter(c => c.student_id !== id));
    write('student_history', read('student_history').filter(h => h.student_id !== id));
    return true;
  },
  promote: async (studentId, toClassId, toSectionId) => {
    const rows = read('students');
    const i = rows.findIndex(r => r.id === studentId);
    if (i === -1) throw new Error('Student not found');
    const history = read('student_history');
    history.push({
      id: uid(), student_id: studentId,
      from_class_id: rows[i].class_id, from_section_id: rows[i].section_id,
      to_class_id: toClassId, to_section_id: toSectionId,
      date: new Date().toISOString().split('T')[0], type: 'promotion',
    });
    write('student_history', history);
    rows[i] = { ...rows[i], class_id: toClassId, section_id: toSectionId };
    write('students', rows);
    return rows[i];
  },
};

// ===== STUDENT HISTORY =====
export const apiStudentHistory = {
  getByStudentId: async (studentId) => read('student_history')
    .filter(h => h.student_id === studentId)
    .sort((a, b) => new Date(b.date) - new Date(a.date)),
};

// ===== FEES =====
export const apiFees = {
  getAll: async () => read('fees'),
  getByStudentId: async (studentId) => read('fees').filter(f => f.student_id === studentId),
  create: async (data) => {
    const rows = read('fees');
    const row = normMoney({ id: uid(), ...data }, FEE_MONEY);
    rows.push(row); write('fees', rows);
    return row;
  },
  update: async (id, data) => {
    const rows = read('fees');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Fee not found');
    rows[i] = { ...rows[i], ...normMoney(data, FEE_MONEY) }; write('fees', rows);
    return rows[i];
  },
  delete: async (id) => { write('fees', read('fees').filter(r => r.id !== id)); return true; },
};

// ===== CUSTOM CHARGES =====
export const apiCustomCharges = {
  getAll: async () => read('custom_charges'),
  getByStudentId: async (studentId) => read('custom_charges').filter(c => c.student_id === studentId),
  create: async (data) => {
    const rows = read('custom_charges');
    const row = normMoney({ id: uid(), date_created: new Date().toISOString().split('T')[0], ...data }, CHARGE_MONEY);
    rows.push(row); write('custom_charges', rows);
    return row;
  },
  update: async (id, data) => {
    const rows = read('custom_charges');
    const i = rows.findIndex(r => r.id === id);
    if (i === -1) throw new Error('Charge not found');
    rows[i] = { ...rows[i], ...normMoney(data, CHARGE_MONEY) }; write('custom_charges', rows);
    return rows[i];
  },
  delete: async (id) => { write('custom_charges', read('custom_charges').filter(r => r.id !== id)); return true; },
};

// ===== RECEIPTS =====
export const apiReceipts = {
  create: async ({ studentId, amount, paidDate }) => {
    const rows = read('receipts');
    const serial = rows.length + 1;
    const name = getSettings().school_name || 'School';
    const initials = (name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4)) || 'SCH';
    const receiptNo = `${initials}-${String(serial).padStart(6, '0')}`;
    rows.push({
      id: uid(), receipt_no: receiptNo, student_id: studentId,
      amount: money(amount), paid_date: paidDate || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    });
    write('receipts', rows);
    return receiptNo;
  },
  getAll: async () => read('receipts').slice().reverse(),
};

// ===== SETTINGS =====
const SETTINGS_KEY = KEY('settings');
export const defaultSettings = {
  school_name: 'Demo Public School',
  tagline: 'Excellence in Education',
  address: 'Faisalabad, Pakistan',
  phone: '0300-0000000',
  logo: '',
  important_fields: DEFAULT_IMPORTANT_KEYS,
  features: {},
};
export const getSettings = () => {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...defaultSettings }; }
};
export const saveSettings = async (data) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...data }));
  return getSettings();
};
export const getImportantFields = () => {
  const list = getSettings().important_fields;
  return Array.isArray(list) ? list : DEFAULT_IMPORTANT_KEYS;
};

// Lets a visitor wipe the sandbox and start over.
export const resetDemoData = () => {
  ['classes', 'sections', 'parents', 'students', 'fees', 'custom_charges', 'student_history', 'receipts', 'seeded', 'last_student_id', 'settings']
    .forEach(n => localStorage.removeItem(KEY(n)));
};
