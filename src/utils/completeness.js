/*
 * Data completeness rules — shared by Settings, the admission form and the
 * Students page so everyone agrees on which fields are "important".
 *
 * Importance is decided in two layers:
 *   1. GLOBAL default — set once in Settings, applies to every student
 *      (stored as settings.important_fields: [field keys]).
 *   2. PER-STUDENT override — on the spot in the admission form you can flip a
 *      field important/not-important for one student only
 *      (stored on the student as important_overrides: { key: true|false }).
 *      Only real deviations from the global default are stored.
 *
 * A field counts as "missing" when it is effectively important for that student
 * AND its value is blank.
 */

// Every admission-form field that can be marked important, grouped for display.
export const ADMISSION_FIELD_GROUPS = [
  {
    label: 'Student Information',
    fields: [
      { key: 'roll_no',         label: 'Admission No' },
      { key: 'name',            label: 'Student Name' },
      { key: 'dob',             label: 'Date of Birth' },
      { key: 'gender',          label: 'Gender' },
      { key: 'admission_date',  label: 'Admission Date' },
      { key: 'class_id',        label: 'Class' },
      { key: 'section_id',      label: 'Section' },
      { key: 'monthly_fee',     label: 'Monthly Fee' },
      { key: 'fee_start_month', label: 'Fee Start Month' },
      { key: 'address',         label: 'Address' },
      { key: 'medical_info',    label: 'Medical Info' },
      { key: 'picture',         label: 'Student Picture' },
    ],
  },
  {
    label: 'One-Time Charges',
    fields: [
      { key: 'admission_fee',   label: 'Admission Fee' },
      { key: 'security_fee',    label: 'Security Fee' },
      { key: 'paper_fund',      label: 'Paper Fund' },
      { key: 'stationery_fee',  label: 'Stationery Fee' },
      { key: 'other_fee',       label: 'Other Charges' },
    ],
  },
  {
    label: 'Parent / Guardian',
    fields: [
      { key: 'father_name',       label: 'Father Name' },
      { key: 'father_cnic',       label: 'Father CNIC' },
      { key: 'father_occupation', label: 'Father Occupation' },
      { key: 'father_contact',    label: 'Father Contact' },
      { key: 'mother_name',       label: 'Mother Name' },
      { key: 'mother_cnic',       label: 'Mother CNIC' },
      { key: 'mother_contact',    label: 'Mother Contact' },
    ],
  },
];

export const ADMISSION_FIELD_CATALOG = ADMISSION_FIELD_GROUPS.flatMap(g => g.fields);

// Fields marked important out of the box (the sensible defaults we shipped).
export const DEFAULT_IMPORTANT_KEYS = [
  'roll_no', 'name', 'dob', 'gender', 'class_id', 'section_id', 'address', 'monthly_fee', 'picture',
  'father_name', 'father_cnic', 'father_contact', 'mother_name', 'mother_cnic',
];

export const labelForKey = (key) => ADMISSION_FIELD_CATALOG.find(f => f.key === key)?.label || key;

export const isBlankValue = (v) => v === undefined || v === null || String(v).trim() === '';

// Monthly fee is stored as a number, so 0 / empty both mean "not entered".
const fieldIsBlank = (key, value) => (key === 'monthly_fee' ? !Number(value) : isBlankValue(value));

// Effective importance for a field: per-student override wins over the global default.
export const isFieldImportant = (key, importantKeys, overrides) => {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) return !!overrides[key];
  return (importantKeys || DEFAULT_IMPORTANT_KEYS).includes(key);
};

/*
 * Return the important-and-blank fields for a flat source object (e.g. the
 * admission form state, which holds every key). Returns [{ key, label }].
 */
export const getMissingImportant = (source, importantKeys, overrides = {}) =>
  ADMISSION_FIELD_CATALOG.filter(f =>
    isFieldImportant(f.key, importantKeys, overrides) && fieldIsBlank(f.key, source?.[f.key]));

// Convenience for the Students page: student record + its parent record.
// Per-student overrides are read from student.important_overrides.
export const getMissingFields = (student, parent, importantKeys) => {
  const merged = { ...(parent || {}), ...(student || {}) };
  return getMissingImportant(merged, importantKeys, student?.important_overrides || {});
};
