/*
 * Data Service Layer — Supabase backend.
 *
 * The whole app talks to the database ONLY through this file, so the rest of
 * the code did not need to change when we moved from localStorage to Supabase.
 * Every api* object keeps the same function names, arguments and return shapes
 * as before.
 *
 * School settings (name, logo, important fields) are still kept in localStorage
 * for now — they are read synchronously in many places (Layout, print, login)
 * and will be moved to the cloud in a later step.
 */

import { supabase } from './supabase';
import { DEFAULT_IMPORTANT_KEYS } from '../utils/completeness';

// ===== School context (multi-tenant) =====
// After login we load the logged-in user's school row once and cache it.
// RLS makes every query return only this school's data automatically; for
// INSERTs we stamp school_id ourselves via withSchool().
let currentSchool = null;
export const loadSchoolContext = async () => {
  const { data, error } = await supabase.from('schools').select('*').limit(1).maybeSingle();
  if (error) throw error;
  currentSchool = data;
  return data;
};
export const getSchoolId = () => currentSchool?.id || null;
export const clearSchoolContext = () => { currentSchool = null; };
const withSchool = (obj) => {
  const school_id = getSchoolId();
  // Without a linked school every insert would be silently rejected by RLS,
  // so fail loudly with a message that actually explains the problem.
  if (!school_id) throw new Error('This login is not linked to any school, so data cannot be saved. Please link the user to a school in the database.');
  return { ...obj, school_id };
};

// ===== Money normalization =====
// Every amount is kept as a clean whole-rupee NUMBER so it shows the same on
// every screen (no float drift, no text-vs-number mixing).
const money = (v) => Math.round(Number(v) || 0);
const STUDENT_MONEY = ['monthly_fee', 'admission_fee', 'security_fee', 'paper_fund', 'stationery_fee', 'other_fee'];
const FEE_MONEY = ['monthly_fee', 'fine', 'paper_fund', 'other_charges', 'amount_paid'];
const CHARGE_MONEY = ['amount', 'amount_paid'];

// Postgres returns numeric columns as strings — turn the money fields back into
// numbers on the way out so the UI (toLocaleString etc.) works as before.
const toNumbers = (obj, keys) => {
  if (!obj) return obj;
  const o = { ...obj };
  keys.forEach(k => { if (o[k] !== null && o[k] !== undefined && o[k] !== '') o[k] = Number(o[k]); });
  return o;
};
const mapMoney = (arr, keys) => (arr || []).map(r => toNumbers(r, keys));

/*
 * Column types per table. Forms hand us "" for anything left blank, but
 * Postgres only accepts "" for text — numeric needs a number and date/uuid
 * need NULL. Declaring the types here (instead of guessing per field) makes
 * this whole class of "invalid input syntax" errors impossible.
 */
const COLUMN_TYPES = {
  classes:         { num: [],            date: [],                                    uuid: [] },
  sections:        { num: [],            date: [],                                    uuid: ['class_id'] },
  parents:         { num: [],            date: [],                                    uuid: [] },
  students:        { num: STUDENT_MONEY, date: ['dob', 'admission_date', 'leaving_date'], uuid: ['parent_id', 'class_id', 'section_id'] },
  student_history: { num: [],            date: ['date'],                              uuid: ['from_class_id', 'from_section_id', 'to_class_id', 'to_section_id'] },
  fees:            { num: FEE_MONEY,     date: ['paid_date'],                         uuid: [] },
  custom_charges:  { num: CHARGE_MONEY,  date: ['date_created', 'paid_date'],         uuid: [] },
};

// Clean a payload for one table: blank numbers -> 0, blank dates/uuids -> NULL.
// Keys that were not supplied are left untouched, so updates stay partial.
const prep = (table, obj) => {
  const t = COLUMN_TYPES[table] || { num: [], date: [], uuid: [] };
  const o = { ...obj };
  t.num.forEach(k => { if (k in o) o[k] = (o[k] === '' || o[k] === null || o[k] === undefined) ? 0 : money(o[k]); });
  [...t.date, ...t.uuid].forEach(k => { if (k in o && o[k] === '') o[k] = null; });
  return o;
};

// Small helpers that throw on error. The table name is included so a failure
// points straight at the operation that caused it.
const rowsOf = async (query, table = '') => {
  const { data, error } = await query;
  if (error) throw new Error(table ? `[${table}] ${error.message}` : error.message);
  return data || [];
};
const rowOf = async (query, table = '') => {
  const { data, error } = await query;
  if (error) throw new Error(table ? `[${table}] ${error.message}` : error.message);
  return data;
};

// ========== Fuzzy Name Search Utility ==========
// Handles common Urdu-to-English transliteration variations.
const fuzzyNameMatch = (name, query) => {
  if (!name || !query) return false;
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n.includes(q)) return true;
  const normalize = (str) => str
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/sh/g, 's').replace(/ph/g, 'f')
    .replace(/th/g, 't').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ch/g, 'c')
    .replace(/aa/g, 'a').replace(/([a-z])\1/g, '$1').replace(/h$/, '').replace(/d$/, 't');
  return normalize(n).includes(normalize(q)) || normalize(q).includes(normalize(n));
};

// One-time / admission charge heads (unchanged).
export const ADMISSION_HEADS = [
  { key: 'admission_fee',  label: 'Admission Fee' },
  { key: 'security_fee',   label: 'Security Fee' },
  { key: 'paper_fund',     label: 'Paper Fund' },
  { key: 'stationery_fee', label: 'Stationery Fee' },
  { key: 'other_fee',      label: 'Other Charges' },
];

// The database now assigns Student IDs (a sequence). The "next id" is no longer
// known up front, so the form shows "Auto" until the row is saved.
export const peekNextStudentId = () => null;

// ========== PHOTO UPLOAD (Supabase Storage bucket) ==========
// Takes the compressed base64 photo from the form, uploads it to the
// "student-photos" bucket, and returns a public URL to store on the student.
// Passing an existing URL (when editing) returns it unchanged; empty -> ''.
export const uploadStudentPhoto = async (picture, studentId) => {
  if (!picture) return '';
  if (/^https?:\/\//.test(picture)) return picture; // already a stored URL
  if (!picture.startsWith('data:')) return picture;  // unexpected format — leave as-is

  const blob = await (await fetch(picture)).blob();
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  // One fixed path per student. Re-uploading overwrites that same file, so a
  // replaced photo can never leave its predecessor behind as an orphan.
  const path = `student-${studentId}.${ext}`;
  const { error } = await supabase.storage.from('student-photos')
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  const publicUrl = supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl;
  // The path never changes, so add a version marker — otherwise the browser and
  // CDN would keep showing the previous photo from cache.
  return `${publicUrl}?v=${Date.now()}`;
};

// Delete a photo from the bucket given its public URL. Used when a student's
// photo is replaced or the student is deleted, so old images don't pile up.
// Best-effort: a failure here must never block the main operation.
export const deleteStudentPhoto = async (url) => {
  if (!url || !/^https?:\/\//.test(url)) return;
  const marker = '/student-photos/';
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  if (!path) return;
  const { data, error } = await supabase.storage.from('student-photos').remove([path]);
  // Never block the main operation, but do say why it failed — a silent
  // failure here is what let old photos pile up unnoticed.
  if (error) console.warn('[storage] could not delete old photo:', path, error.message);
  else if (!data || data.length === 0) console.warn('[storage] delete matched no file:', path);
};

// ========== CLASSES API ==========
export const apiClasses = {
  getAll: async () => rowsOf(supabase.from('classes').select('*').order('class_name'), 'classes'),
  create: async (data) => rowOf(supabase.from('classes').insert(withSchool(prep('classes', data))).select().single(), 'classes'),
  update: async (id, data) => rowOf(supabase.from('classes').update(prep('classes', data)).eq('id', id).select().single(), 'classes'),
  delete: async (id) => { const { error } = await supabase.from('classes').delete().eq('id', id); if (error) throw error; return true; },
};

// ========== SECTIONS API ==========
export const apiSections = {
  getAll: async () => rowsOf(supabase.from('sections').select('*'), 'sections'),
  getByClassId: async (classId) => rowsOf(supabase.from('sections').select('*').eq('class_id', classId), 'sections'),
  create: async (data) => rowOf(supabase.from('sections').insert(withSchool(prep('sections', data))).select().single(), 'sections'),
  update: async (id, data) => rowOf(supabase.from('sections').update(prep('sections', data)).eq('id', id).select().single(), 'sections'),
  delete: async (id) => { const { error } = await supabase.from('sections').delete().eq('id', id); if (error) throw error; return true; },
};

// ========== PARENTS API ==========
export const apiParents = {
  getAll: async () => rowsOf(supabase.from('parents').select('*')),
  getById: async (id) => rowOf(supabase.from('parents').select('*').eq('id', id).maybeSingle()),
  getByCnic: async (cnic) => {
    const data = await rowsOf(supabase.from('parents').select('*').or(`father_cnic.eq.${cnic},mother_cnic.eq.${cnic}`).limit(1));
    return data[0] || null;
  },
  // Preserve the old fuzzy behaviour: fetch all then filter in JS.
  search: async (query) => {
    const parents = await rowsOf(supabase.from('parents').select('*'));
    const q = (query || '').toLowerCase().replace(/-/g, '');
    return parents.filter(p => {
      const fCnic = (p.father_cnic || '').replace(/-/g, '');
      const mCnic = (p.mother_cnic || '').replace(/-/g, '');
      return fCnic.includes(q) || mCnic.includes(q) ||
        fuzzyNameMatch(p.father_name, query) || fuzzyNameMatch(p.mother_name, query);
    });
  },
  create: async (data) => rowOf(supabase.from('parents').insert(withSchool(prep('parents', data))).select().single(), 'parents'),
  createOrGet: async (data) => {
    // Match on CNIC when it is provided; otherwise fall back to father's name +
    // contact. Without that fallback a blank CNIC created a brand new parent on
    // every save attempt. RLS keeps these lookups inside the current school.
    let existing = null;
    if (data.father_cnic) {
      existing = await rowOf(supabase.from('parents').select('*').eq('father_cnic', data.father_cnic).maybeSingle(), 'parents');
    } else if (data.father_name && data.father_contact) {
      const rows = await rowsOf(
        supabase.from('parents').select('*')
          .eq('father_name', data.father_name)
          .eq('father_contact', data.father_contact)
          .limit(1),
        'parents');
      existing = rows[0] || null;
    }
    if (existing) return { parent: existing, isNew: false };

    const parent = await rowOf(supabase.from('parents').insert(withSchool(prep('parents', data))).select().single(), 'parents');
    return { parent, isNew: true };
  },
  update: async (id, data) => rowOf(supabase.from('parents').update(prep('parents', data)).eq('id', id).select().single(), 'parents'),
  delete: async (id) => { const { error } = await supabase.from('parents').delete().eq('id', id); if (error) throw error; return true; },
};

// ========== STUDENTS API ==========
export const apiStudents = {
  getAll: async () => mapMoney(await rowsOf(supabase.from('students').select('*')), STUDENT_MONEY),
  getByParentId: async (parentId) => mapMoney(await rowsOf(supabase.from('students').select('*').eq('parent_id', parentId)), STUDENT_MONEY),
  getById: async (id) => toNumbers(await rowOf(supabase.from('students').select('*').eq('id', id).maybeSingle()), STUDENT_MONEY),
  search: async (query) => {
    const students = mapMoney(await rowsOf(supabase.from('students').select('*')), STUDENT_MONEY);
    const q = (query || '').toLowerCase();
    return students.filter(s =>
      (s.id && String(s.id).toLowerCase().includes(q)) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
      fuzzyNameMatch(s.name, query)
    );
  },
  create: async (data) => {
    const clean = prep('students', { ...data, status: data.status || 'Active' });
    delete clean.id; // the database assigns the id (sequence)
    return toNumbers(await rowOf(supabase.from('students').insert(withSchool(clean)).select().single(), 'students'), STUDENT_MONEY);
  },
  update: async (id, data) => {
    const clean = prep('students', data);
    return toNumbers(await rowOf(supabase.from('students').update(clean).eq('id', id).select().single(), 'students'), STUDENT_MONEY);
  },
  // Cascade delete (fees/charges/history) is handled by the DB foreign keys.
  // The photo lives in storage, so remove it here or it would linger forever.
  delete: async (id) => {
    const existing = await rowOf(supabase.from('students').select('picture').eq('id', id).maybeSingle(), 'students');
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    if (existing?.picture) await deleteStudentPhoto(existing.picture);
    return true;
  },
  promote: async (studentId, toClassId, toSectionId) => {
    const student = await rowOf(supabase.from('students').select('class_id,section_id').eq('id', studentId).maybeSingle());
    if (!student) throw new Error('Student not found');
    const { error: hErr } = await supabase.from('student_history').insert(withSchool(prep('student_history', {
      student_id: studentId,
      from_class_id: student.class_id, from_section_id: student.section_id,
      to_class_id: toClassId, to_section_id: toSectionId,
      date: new Date().toISOString().split('T')[0], type: 'promotion',
    })));
    if (hErr) throw hErr;
    return rowOf(supabase.from('students').update({ class_id: toClassId, section_id: toSectionId }).eq('id', studentId).select().single());
  },
};

// ========== STUDENT HISTORY API ==========
export const apiStudentHistory = {
  getByStudentId: async (studentId) => rowsOf(
    supabase.from('student_history').select('*').eq('student_id', studentId).order('date', { ascending: false })
  ),
};

// ========== FEES API ==========
export const apiFees = {
  getAll: async () => mapMoney(await rowsOf(supabase.from('fees').select('*')), FEE_MONEY),
  getByStudentId: async (studentId) => mapMoney(await rowsOf(supabase.from('fees').select('*').eq('student_id', studentId)), FEE_MONEY),
  create: async (data) => toNumbers(await rowOf(supabase.from('fees').insert(withSchool(prep('fees', data))).select().single(), 'fees'), FEE_MONEY),
  update: async (id, data) => toNumbers(await rowOf(supabase.from('fees').update(prep('fees', data)).eq('id', id).select().single(), 'fees'), FEE_MONEY),
  delete: async (id) => { const { error } = await supabase.from('fees').delete().eq('id', id); if (error) throw error; return true; },
};

// ========== CUSTOM CHARGES API ==========
export const apiCustomCharges = {
  getAll: async () => mapMoney(await rowsOf(supabase.from('custom_charges').select('*')), CHARGE_MONEY),
  getByStudentId: async (studentId) => mapMoney(await rowsOf(supabase.from('custom_charges').select('*').eq('student_id', studentId)), CHARGE_MONEY),
  create: async (data) => {
    const clean = prep('custom_charges', { date_created: new Date().toISOString().split('T')[0], ...data });
    return toNumbers(await rowOf(supabase.from('custom_charges').insert(withSchool(clean)).select().single(), 'custom_charges'), CHARGE_MONEY);
  },
  update: async (id, data) => toNumbers(await rowOf(supabase.from('custom_charges').update(prep('custom_charges', data)).eq('id', id).select().single(), 'custom_charges'), CHARGE_MONEY),
  delete: async (id) => { const { error } = await supabase.from('custom_charges').delete().eq('id', id); if (error) throw error; return true; },
};

// ========== SCHOOL SETTINGS (per-school, from the schools table) ==========
// Neutral defaults are shown before login / while the school row loads.
export const defaultSettings = {
  school_name: 'School Management',
  tagline: '',
  address: '',
  phone: '',
  logo: '',
  important_fields: DEFAULT_IMPORTANT_KEYS,
  features: {},
};
// Reads from the cached school row (loaded at login). Stays synchronous so the
// Layout, print components and login screen can use it directly.
export const getSettings = () => ({ ...defaultSettings, ...(currentSchool || {}) });

export const saveSettings = async (data) => {
  const id = getSchoolId();
  if (id) {
    const { error } = await supabase.from('schools').update(data).eq('id', id);
    if (error) throw error;
  }
  currentSchool = { ...(currentSchool || {}), ...data };
  return getSettings();
};
export const getImportantFields = () => {
  const list = getSettings().important_fields;
  return Array.isArray(list) ? list : DEFAULT_IMPORTANT_KEYS;
};
