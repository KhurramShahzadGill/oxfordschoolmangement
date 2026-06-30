/*
 * Mock API Service Layer
 * Designed to be swapped out with Supabase later.
 * 
 * Data Models:
 *  - Classes: { id, class_name }
 *  - Sections: { id, class_id, section_name }
 *  - Parents: { id (= father_cnic), father_name, father_cnic, father_occupation, father_contact, mother_name, mother_cnic, mother_contact }
 *  - Students: { id (manual), roll_no (manual), name, dob, gender, admission_date, leaving_date, medical_info, monthly_fee, fee_start_month, admission_fee, security_fee, paper_fund, stationery_fee, other_fee, picture (base64), status, parent_id, class_id, section_id }
 *  - StudentHistory: { id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, date, type }
 *  - Fees: { id, student_id, month, monthly_fee (snapshot locked at payment time), fine, paper_fund, other_charges, paid_date, status, amount_paid }
 */

import { v4 as uuidv4 } from 'uuid';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ===== Money normalization =====
// Every amount in the system is kept as a clean whole-rupee NUMBER. This is the
// single rule that makes an amount show the same in every screen: no text-vs-number
// mixing, and no floating-point drift (the cause of "500 here, 499 there").
const money = (v) => Math.round(Number(v) || 0);
const STUDENT_MONEY = ['monthly_fee', 'admission_fee', 'security_fee', 'paper_fund', 'stationery_fee', 'other_fee'];
const FEE_MONEY = ['monthly_fee', 'fine', 'paper_fund', 'other_charges', 'amount_paid'];
const CHARGE_MONEY = ['amount', 'amount_paid'];
// Return a copy of obj with the listed money keys rounded to whole rupees.
const normMoney = (obj, keys) => {
  const o = { ...obj };
  keys.forEach(k => { if (o[k] !== undefined && o[k] !== '' && o[k] !== null) o[k] = money(o[k]); });
  return o;
};

// Seed initial data if empty
const seedData = () => {
  if (!localStorage.getItem('ogs_classes')) {
    setStorage('ogs_classes', [
      { id: 'c1', class_name: 'Nursery' },
      { id: 'c2', class_name: 'Prep' },
      { id: 'c3', class_name: 'Class 1' },
      { id: 'c4', class_name: 'Class 2' },
      { id: 'c5', class_name: 'Class 3' },
    ]);
  }
  if (!localStorage.getItem('ogs_sections')) {
    setStorage('ogs_sections', [
      { id: 's1', class_id: 'c1', section_name: 'A' },
      { id: 's2', class_id: 'c1', section_name: 'B' },
      { id: 's3', class_id: 'c2', section_name: 'A' },
      { id: 's4', class_id: 'c3', section_name: 'A' },
      { id: 's5', class_id: 'c3', section_name: 'B' },
      { id: 's6', class_id: 'c4', section_name: 'A' },
      { id: 's7', class_id: 'c5', section_name: 'A' },
    ]);
  }
  if (!localStorage.getItem('ogs_parents')) {
    setStorage('ogs_parents', []);
  }
  if (!localStorage.getItem('ogs_students')) {
    setStorage('ogs_students', []);
  }
  if (!localStorage.getItem('ogs_student_history')) {
    setStorage('ogs_student_history', []);
  }
  if (!localStorage.getItem('ogs_fees')) {
    setStorage('ogs_fees', []);
  }
  if (!localStorage.getItem('ogs_custom_charges')) {
    setStorage('ogs_custom_charges', []);
  }
};
seedData();

// Remove fee / charge / history records that point to students which no longer exist.
// Protects against orphaned data (e.g. from older builds that didn't cascade on delete).
const cleanupOrphans = () => {
  const ids = new Set(getStorage('ogs_students').map(s => s.id));
  ['ogs_fees', 'ogs_custom_charges', 'ogs_student_history'].forEach(key => {
    const rows = getStorage(key);
    const kept = rows.filter(r => ids.has(r.student_id));
    if (kept.length !== rows.length) setStorage(key, kept);
  });
};
cleanupOrphans();

// One-time charges (admission, security, paper fund, etc.) are unified into the
// charges ledger so they collect, print and appear in history like any other charge.
export const ADMISSION_HEADS = [
  { key: 'admission_fee',  label: 'Admission Fee' },
  { key: 'security_fee',   label: 'Security Fee' },
  { key: 'paper_fund',     label: 'Paper Fund' },
  { key: 'stationery_fee', label: 'Stationery Fee' },
  { key: 'other_fee',      label: 'Other Charges' },
];

// Migrate older students whose one-time charges lived on the student record
// (admission_fee, *_paid) into proper charge records — run once.
const migrateAdmissionCharges = () => {
  if (localStorage.getItem('ogs_migrated_admission_v1')) return;
  const students = getStorage('ogs_students');
  const charges = getStorage('ogs_custom_charges');
  let changed = false;
  students.forEach(s => {
    ADMISSION_HEADS.forEach(({ key, label }) => {
      const amount = Number(s[key] || 0);
      if (amount <= 0) return;
      const exists = charges.some(c => c.student_id === s.id && c.title === label && c.is_admission);
      if (exists) return;
      const paid = Number(s[key + '_paid'] || 0);
      charges.push({
        id: uuidv4(), student_id: s.id, title: label, is_admission: true,
        amount, amount_paid: paid,
        status: paid >= amount ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'),
        date_created: s.admission_date || new Date().toISOString().split('T')[0],
        paid_date: paid > 0 ? (s.admission_date || null) : null,
      });
      changed = true;
    });
  });
  if (changed) setStorage('ogs_custom_charges', charges);
  localStorage.setItem('ogs_migrated_admission_v1', '1');
};
migrateAdmissionCharges();

// One-time cleanup: round every existing stored amount to a whole-rupee number,
// so older records (saved as text / with decimals) become consistent everywhere.
const migrateNormalizeMoney = () => {
  if (localStorage.getItem('ogs_money_normalized_v1')) return;
  setStorage('ogs_students', getStorage('ogs_students').map(s => normMoney(s, STUDENT_MONEY)));
  setStorage('ogs_fees', getStorage('ogs_fees').map(f => normMoney(f, FEE_MONEY)));
  setStorage('ogs_custom_charges', getStorage('ogs_custom_charges').map(c => normMoney(c, CHARGE_MONEY)));
  localStorage.setItem('ogs_money_normalized_v1', '1');
};
migrateNormalizeMoney();

// Highest student id ever issued — kept so deleted ids are never reused.
export const peekNextStudentId = () => {
  const students = getStorage('ogs_students');
  const maxExisting = students.reduce((mx, s) => Math.max(mx, parseInt(s.id) || 0), 0);
  const lastUsed = parseInt(localStorage.getItem('ogs_last_student_id') || '0') || 0;
  return Math.max(maxExisting, lastUsed) + 1;
};

// ========== Fuzzy Name Search Utility ==========
// Handles common Urdu-to-English transliteration variations
const fuzzyNameMatch = (name, query) => {
  if (!name || !query) return false;
  const n = name.toLowerCase();
  const q = query.toLowerCase();

  // Direct substring match
  if (n.includes(q)) return true;

  // Generate normalized form: remove double letters, common swaps
  const normalize = (str) => {
    return str
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/sh/g, 's')
      .replace(/ph/g, 'f')
      .replace(/th/g, 't')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/ch/g, 'c')
      .replace(/aa/g, 'a')
      .replace(/([a-z])\1/g, '$1') // remove consecutive duplicate letters
      .replace(/h$/, '')  // trailing h often optional
      .replace(/d$/,'t'); // d/t often interchanged at end
  };

  return normalize(n).includes(normalize(q)) || normalize(q).includes(normalize(n));
};

// ========== CLASSES API ==========
export const apiClasses = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_classes');
  },
  create: async (data) => {
    await delay(100);
    const classes = getStorage('ogs_classes');
    const newClass = { id: uuidv4(), ...data };
    classes.push(newClass);
    setStorage('ogs_classes', classes);
    return newClass;
  },
  update: async (id, data) => {
    await delay(100);
    const classes = getStorage('ogs_classes');
    const index = classes.findIndex(c => c.id === id);
    if (index > -1) {
      classes[index] = { ...classes[index], ...data };
      setStorage('ogs_classes', classes);
      return classes[index];
    }
    throw new Error('Class not found');
  },
  delete: async (id) => {
    await delay(100);
    let classes = getStorage('ogs_classes');
    // Also delete related sections
    let sections = getStorage('ogs_sections');
    sections = sections.filter(s => s.class_id !== id);
    setStorage('ogs_sections', sections);
    classes = classes.filter(c => c.id !== id);
    setStorage('ogs_classes', classes);
    return true;
  }
};

// ========== SECTIONS API ==========
export const apiSections = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_sections');
  },
  getByClassId: async (classId) => {
    await delay(100);
    const sections = getStorage('ogs_sections');
    return sections.filter(s => s.class_id === classId);
  },
  create: async (data) => {
    await delay(100);
    const sections = getStorage('ogs_sections');
    const newSection = { id: uuidv4(), ...data };
    sections.push(newSection);
    setStorage('ogs_sections', sections);
    return newSection;
  },
  update: async (id, data) => {
    await delay(100);
    const sections = getStorage('ogs_sections');
    const index = sections.findIndex(s => s.id === id);
    if (index > -1) {
      sections[index] = { ...sections[index], ...data };
      setStorage('ogs_sections', sections);
      return sections[index];
    }
    throw new Error('Section not found');
  },
  delete: async (id) => {
    await delay(100);
    let sections = getStorage('ogs_sections');
    sections = sections.filter(s => s.id !== id);
    setStorage('ogs_sections', sections);
    return true;
  }
};

// ========== PARENTS API ==========
export const apiParents = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_parents');
  },
  getById: async (id) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    return parents.find(p => p.id === id) || null;
  },
  getByCnic: async (cnic) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    return parents.find(p => p.father_cnic === cnic || p.mother_cnic === cnic) || null;
  },
  search: async (query) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    const q = query.toLowerCase().replace(/-/g, '');
    return parents.filter(p => {
      const fCnic = (p.father_cnic || '').replace(/-/g, '');
      const mCnic = (p.mother_cnic || '').replace(/-/g, '');
      return fCnic.includes(q) ||
        mCnic.includes(q) ||
        fuzzyNameMatch(p.father_name, query) ||
        fuzzyNameMatch(p.mother_name, query);
    });
  },
  create: async (data) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    const newParent = { id: uuidv4(), ...data };
    parents.push(newParent);
    setStorage('ogs_parents', parents);
    return newParent;
  },
  createOrGet: async (data) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    // Check if parent with this father_cnic already exists (only if CNIC provided)
    if (data.father_cnic) {
      const existing = parents.find(p => p.father_cnic === data.father_cnic);
      if (existing) {
        return { parent: existing, isNew: false };
      }
    }
    const newParent = { id: uuidv4(), ...data };
    parents.push(newParent);
    setStorage('ogs_parents', parents);
    return { parent: newParent, isNew: true };
  },
  update: async (id, data) => {
    await delay(100);
    const parents = getStorage('ogs_parents');
    const index = parents.findIndex(p => p.id === id);
    if (index > -1) {
      parents[index] = { ...parents[index], ...data };
      setStorage('ogs_parents', parents);
      return parents[index];
    }
    throw new Error('Parent not found');
  },
  delete: async (id) => {
    await delay(100);
    let parents = getStorage('ogs_parents');
    parents = parents.filter(p => p.id !== id);
    setStorage('ogs_parents', parents);
    return true;
  }
};

// ========== STUDENTS API ==========
export const apiStudents = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_students');
  },
  getByParentId: async (parentId) => {
    await delay(100);
    const students = getStorage('ogs_students');
    return students.filter(s => s.parent_id === parentId);
  },
  getById: async (id) => {
    await delay(100);
    const students = getStorage('ogs_students');
    return students.find(s => s.id === id) || null;
  },
  search: async (query) => {
    await delay(100);
    const students = getStorage('ogs_students');
    const q = query.toLowerCase();
    return students.filter(s =>
      (s.id && s.id.toLowerCase().includes(q)) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
      fuzzyNameMatch(s.name, query)
    );
  },
  create: async (data) => {
    await delay(100);
    data = normMoney(data, STUDENT_MONEY);
    const students = getStorage('ogs_students');

    // Monotonic ID — never reuses an id from a deleted student (prevents
    // a new student inheriting a previous student's fee history).
    const maxExisting = students.reduce((mx, s) => Math.max(mx, parseInt(s.id) || 0), 0);
    const lastUsed = parseInt(localStorage.getItem('ogs_last_student_id') || '0') || 0;
    const nextId = Math.max(maxExisting, lastUsed) + 1;
    localStorage.setItem('ogs_last_student_id', String(nextId));

    const newStudent = { ...data, id: nextId.toString(), status: data.status || 'Active' };
    students.push(newStudent);
    setStorage('ogs_students', students);
    return newStudent;
  },
  update: async (id, data) => {
    await delay(100);
    data = normMoney(data, STUDENT_MONEY);
    const students = getStorage('ogs_students');
    const index = students.findIndex(s => s.id === id);
    if (index > -1) {
      students[index] = { ...students[index], ...data };
      setStorage('ogs_students', students);
      return students[index];
    }
    throw new Error('Student not found');
  },
  delete: async (id) => {
    await delay(100);
    setStorage('ogs_students', getStorage('ogs_students').filter(s => s.id !== id));
    // Cascade: a deleted student must not leave behind fees, charges or history
    setStorage('ogs_fees', getStorage('ogs_fees').filter(f => f.student_id !== id));
    setStorage('ogs_custom_charges', getStorage('ogs_custom_charges').filter(c => c.student_id !== id));
    setStorage('ogs_student_history', getStorage('ogs_student_history').filter(h => h.student_id !== id));
    return true;
  },
  promote: async (studentId, toClassId, toSectionId) => {
    await delay(100);
    const students = getStorage('ogs_students');
    const index = students.findIndex(s => s.id === studentId);
    if (index === -1) throw new Error('Student not found');

    const student = students[index];
    const fromClassId = student.class_id;
    const fromSectionId = student.section_id;

    // Log history
    const history = getStorage('ogs_student_history');
    history.push({
      id: uuidv4(),
      student_id: studentId,
      from_class_id: fromClassId,
      from_section_id: fromSectionId,
      to_class_id: toClassId,
      to_section_id: toSectionId,
      date: new Date().toISOString().split('T')[0],
      type: 'promotion'
    });
    setStorage('ogs_student_history', history);

    // Update student
    students[index] = { ...student, class_id: toClassId, section_id: toSectionId };
    setStorage('ogs_students', students);
    return students[index];
  }
};

// ========== STUDENT HISTORY API ==========
export const apiStudentHistory = {
  getByStudentId: async (studentId) => {
    await delay(100);
    const history = getStorage('ogs_student_history');
    return history.filter(h => h.student_id === studentId).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
};

// ========== FEES API ==========
export const apiFees = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_fees');
  },
  getByStudentId: async (studentId) => {
    await delay(100);
    const fees = getStorage('ogs_fees');
    return fees.filter(f => f.student_id === studentId);
  },
  create: async (data) => {
    await delay(100);
    data = normMoney(data, FEE_MONEY);
    const fees = getStorage('ogs_fees');
    const newFee = { id: uuidv4(), ...data };
    fees.push(newFee);
    setStorage('ogs_fees', fees);
    return newFee;
  },
  update: async (id, data) => {
    await delay(100);
    data = normMoney(data, FEE_MONEY);
    const fees = getStorage('ogs_fees');
    const index = fees.findIndex(f => f.id === id);
    if (index > -1) {
      fees[index] = { ...fees[index], ...data };
      setStorage('ogs_fees', fees);
      return fees[index];
    }
    throw new Error('Fee not found');
  },
  delete: async (id) => {
    await delay(100);
    let fees = getStorage('ogs_fees');
    fees = fees.filter(f => f.id !== id);
    setStorage('ogs_fees', fees);
    return true;
  }
};

// ========== SCHOOL SETTINGS ==========
// Stored synchronously so print components (voucher, ID card) can read without async loading.
const SETTINGS_KEY = 'ogs_settings';
export const defaultSettings = {
  school_name: 'Oxford Grammar School',
  tagline: 'Excellence in Education',
  address: 'Chak No. 202/RB, Gatti Faisalabad',
  phone: '0321-6088202',
  logo: '', // base64 data URL; empty falls back to /logo.png
};
export const getSettings = () => {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...defaultSettings };
  }
};
export const saveSettings = (data) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...data }));
  return getSettings();
};

// ========== CUSTOM CHARGES API ==========
export const apiCustomCharges = {
  getAll: async () => {
    await delay(100);
    return getStorage('ogs_custom_charges');
  },
  getByStudentId: async (studentId) => {
    await delay(100);
    const charges = getStorage('ogs_custom_charges');
    return charges.filter(c => c.student_id === studentId);
  },
  create: async (data) => {
    await delay(100);
    data = normMoney(data, CHARGE_MONEY);
    const charges = getStorage('ogs_custom_charges');
    const newCharge = { id: uuidv4(), date_created: new Date().toISOString().split('T')[0], ...data };
    charges.push(newCharge);
    setStorage('ogs_custom_charges', charges);
    return newCharge;
  },
  update: async (id, data) => {
    await delay(100);
    data = normMoney(data, CHARGE_MONEY);
    const charges = getStorage('ogs_custom_charges');
    const index = charges.findIndex(c => c.id === id);
    if (index > -1) {
      charges[index] = { ...charges[index], ...data };
      setStorage('ogs_custom_charges', charges);
      return charges[index];
    }
    throw new Error('Custom charge not found');
  },
  delete: async (id) => {
    await delay(100);
    let charges = getStorage('ogs_custom_charges');
    charges = charges.filter(c => c.id !== id);
    setStorage('ogs_custom_charges', charges);
    return true;
  }
};
