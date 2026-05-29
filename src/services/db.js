/*
 * Mock API Service Layer
 * Designed to be swapped out with Supabase later.
 * 
 * Data Models:
 *  - Classes: { id, class_name }
 *  - Sections: { id, class_id, section_name }
 *  - Parents: { id (= father_cnic), father_name, father_cnic, father_occupation, father_contact, mother_name, mother_cnic, mother_contact }
 *  - Students: { id (manual), roll_no (manual), name, dob, gender, admission_date, leaving_date, medical_info, monthly_fee, fee_start_month, picture (base64), status, parent_id, class_id, section_id }
 *  - StudentHistory: { id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, date, type }
 *  - Fees: { id, student_id, month, fine, paper_fund, other_charges, paid_date, status, amount_paid }
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
    const students = getStorage('ogs_students');
    
    // Auto-generate numeric ID
    let nextId = 1;
    if (students.length > 0) {
      const numericIds = students
        .map(s => parseInt(s.id))
        .filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        nextId = Math.max(...numericIds) + 1;
      } else {
        // Fallback if existing IDs aren't numeric
        nextId = students.length + 1;
      }
    }

    const newStudent = { ...data, id: nextId.toString(), status: 'Active' };
    students.push(newStudent);
    setStorage('ogs_students', students);
    return newStudent;
  },
  update: async (id, data) => {
    await delay(100);
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
    let students = getStorage('ogs_students');
    students = students.filter(s => s.id !== id);
    setStorage('ogs_students', students);
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
    const fees = getStorage('ogs_fees');
    const newFee = { id: uuidv4(), ...data };
    fees.push(newFee);
    setStorage('ogs_fees', fees);
    return newFee;
  },
  update: async (id, data) => {
    await delay(100);
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
    const charges = getStorage('ogs_custom_charges');
    const newCharge = { id: uuidv4(), date_created: new Date().toISOString().split('T')[0], ...data };
    charges.push(newCharge);
    setStorage('ogs_custom_charges', charges);
    return newCharge;
  },
  update: async (id, data) => {
    await delay(100);
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
