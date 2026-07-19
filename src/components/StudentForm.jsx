import React, { useState, useEffect } from 'react';
import { apiClasses, apiSections, getImportantFields } from '../services/db';
import { formatCnic, formatMobile, validateCnic, validateMobile } from '../utils/formatters';
import { compressImage } from '../utils/image';
import FamilySearch from './FamilySearch';
import { getMissingImportant, isFieldImportant } from '../utils/completeness';
import { differenceInYears, parseISO } from 'date-fns';

export default function StudentForm({ initial, parents = [], students = [], onSubmit, onCancel, isEdit, nextId }) {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [linkedParent, setLinkedParent] = useState(null);
  const [form, setForm] = useState({
    id: '', roll_no: '', name: '', dob: '', gender: 'Male',
    admission_date: new Date().toISOString().split('T')[0],
    leaving_date: '', medical_info: '', address: '', monthly_fee: '', fee_start_month: new Date().toISOString().split('T')[0].slice(0,7), status: 'Active',
    admission_fee: '', security_fee: '', paper_fund: '', stationery_fee: '', other_fee: '',
    class_id: '', section_id: '', picture: '',
    parent_id: '',
    father_name: '', father_cnic: '', father_occupation: '', father_contact: '',
    mother_name: '', mother_cnic: '', mother_contact: '',
    important_overrides: {},
  });

  useEffect(() => {
    apiClasses.getAll().then(setClasses);
    apiSections.getAll().then(setSections);
  }, []);

  useEffect(() => {
    if (initial) setForm(prev => ({ ...prev, ...initial }));
  }, [initial]);

  const classSections = sections.filter(s => s.class_id === form.class_id);
  const age = form.dob ? differenceInYears(new Date(), parseISO(form.dob)) : '';

  const handlePicture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Resize + convert to WebP and shrink down to ~50 KB so cloud storage stays small
      const dataUrl = await compressImage(file, { maxDim: 400, targetKB: 50 });
      setForm(f => ({ ...f, picture: dataUrl }));
    } catch {
      alert('Could not read the image file. Please try another image.');
    }
  };

  // Clear the photo. Bumping the key resets the file input too, so picking the
  // same file again still fires onChange.
  const removePicture = () => {
    setForm(f => ({ ...f, picture: '' }));
    setPhotoInputKey(k => k + 1);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Important-field marking ──
  // The global default (from Settings) decides which fields show a ★. On this
  // form you can flip any field for THIS student only; only real deviations from
  // the global default are stored in important_overrides.
  const importantKeys = getImportantFields();
  const overrides = form.important_overrides || {};
  const isImp = (key) => isFieldImportant(key, importantKeys, overrides);
  const toggleImp = (key) => setForm(f => {
    const ov = { ...(f.important_overrides || {}) };
    const next = !isFieldImportant(key, importantKeys, f.important_overrides || {});
    if (next === importantKeys.includes(key)) delete ov[key]; else ov[key] = next;
    return { ...f, important_overrides: ov };
  });
  // Live list of important fields still empty (respects the per-student overrides).
  const missingImportant = getMissingImportant(form, importantKeys, overrides);

  // Label with a toggleable ★ importance marker.
  const impLabel = (key, text, hint) => (
    <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span>{text}{hint && <span className="text-xs text-secondary-color"> {hint}</span>}</span>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => toggleImp(key)}
        title={isImp(key) ? 'Important field — click to mark not important for this student' : 'Not important for this student — click to mark important'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.95rem', color: isImp(key) ? '#f59e0b' : '#cbd5e1' }}
      >
        {isImp(key) ? '★' : '☆'}
      </button>
    </label>
  );

  // Link an existing parent → auto-fill their saved details (no re-typing)
  const linkParent = (p) => {
    setLinkedParent(p);
    setForm(f => ({
      ...f,
      parent_id: p.id,
      father_name: p.father_name || '', father_cnic: p.father_cnic || '',
      father_occupation: p.father_occupation || '', father_contact: p.father_contact || '',
      mother_name: p.mother_name || '', mother_cnic: p.mother_cnic || '', mother_contact: p.mother_contact || '',
    }));
  };

  const unlinkParent = () => {
    setLinkedParent(null);
    setForm(f => ({
      ...f,
      parent_id: '',
      father_name: '', father_cnic: '', father_occupation: '', father_contact: '',
      mother_name: '', mother_cnic: '', mother_contact: '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Fields are optional, but anything filled in must be in a valid format
    const checks = [
      [form.father_cnic,     validateCnic,   "Father's CNIC must be complete: 00000-0000000-0"],
      [form.mother_cnic,     validateCnic,   "Mother's CNIC must be complete: 00000-0000000-0"],
      [form.father_contact,  validateMobile, "Father's Contact must be complete: 0000-0000000"],
      [form.mother_contact,  validateMobile, "Mother's Contact must be complete: 0000-0000000"],
    ];
    for (const [value, validate, message] of checks) {
      if (value && !validate(value)) { alert(message); return; }
    }
    onSubmit(form);
  };

  const inputStyle = { padding: '10px 14px', fontSize: '0.9rem' };

  return (
    <div className="card mb-6">
      <h2 className="text-lg font-semibold mb-1">{isEdit ? 'Edit Student' : 'New Admission'}</h2>
      <p className="text-xs text-secondary-color mb-4">
        <span style={{ color: '#f59e0b' }}>★</span> marks an important field (default set in Settings). Click any <span style={{ color: '#f59e0b' }}>★</span>/<span style={{ color: '#cbd5e1' }}>☆</span> to change it for this student only.
      </p>
      <form onSubmit={handleSubmit}>
        {/* Student Info Section */}
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Information</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">Student ID <span className="text-xs text-secondary-color">(Auto Generated)</span></label>
            <input className="form-input" style={{ ...inputStyle, background: '#f8fafc', fontWeight: 'bold', color: 'var(--primary)' }} disabled value={isEdit ? form.id : (nextId || 'Auto')} />
          </div>
          <div className="form-group">
            {impLabel('roll_no', 'Admission Number')}
            <input className="form-input" style={inputStyle} value={form.roll_no} onChange={e => set('roll_no', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('name', 'Full Name')}
            <input className="form-input" style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('dob', 'Date of Birth')}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" className="form-input" style={inputStyle} value={form.dob} onChange={e => set('dob', e.target.value)} />
              <input className="form-input" style={{ ...inputStyle, width: 72, background: '#f1f5f9', textAlign: 'center' }} readOnly value={age !== '' ? `${age} yr` : ''} placeholder="Age" />
            </div>
          </div>
          <div className="form-group">
            {impLabel('gender', 'Gender')}
            <select className="form-select" style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div className="form-group">
            {impLabel('admission_date', 'Admission Date')}
            <input type="date" className="form-input" style={inputStyle} value={form.admission_date} onChange={e => set('admission_date', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('class_id', 'Class')}
            <select className="form-select" style={inputStyle} value={form.class_id} onChange={e => { set('class_id', e.target.value); set('section_id', ''); }}>
              <option value="">-- Select --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            {impLabel('section_id', 'Section')}
            <select className="form-select" style={inputStyle} value={form.section_id} onChange={e => set('section_id', e.target.value)}>
              <option value="">-- Select --</option>
              {classSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            {impLabel('monthly_fee', 'Monthly Fee (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.monthly_fee} onChange={e => set('monthly_fee', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('fee_start_month', 'Fee Starts From')}
            <input type="month" className="form-input" style={inputStyle} value={form.fee_start_month} onChange={e => set('fee_start_month', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Active</option><option>Left</option>
            </select>
          </div>
          {form.status === 'Left' && (
            <div className="form-group">
              <label className="form-label">Leaving Date</label>
              <input type="date" className="form-input" style={inputStyle} value={form.leaving_date} onChange={e => set('leaving_date', e.target.value)} />
            </div>
          )}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            {impLabel('medical_info', 'Medical Information')}
            <input className="form-input" style={inputStyle} value={form.medical_info} onChange={e => set('medical_info', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            {impLabel('address', 'Student Address')}
            <textarea className="form-input" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.address} onChange={e => set('address', e.target.value)} placeholder="House #, Street, Area, City" />
          </div>
          <div className="form-group">
            {impLabel('picture', 'Student Picture')}
            <input key={photoInputKey} type="file" accept="image/*" onChange={handlePicture} style={{ fontSize: '0.85rem' }} />
            {form.picture && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <img src={form.picture} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={removePicture}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admission / One-Time Charges Section */}
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admission / One-Time Charges</h3>
        {!isEdit && <p className="text-xs text-secondary-color mb-2">Any amount entered here becomes a one-time due in the Fee Receipt (collectible &amp; tracked in history).</p>}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="form-group">
            {impLabel('admission_fee', 'Admission Fee (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.admission_fee} onChange={e => set('admission_fee', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('security_fee', 'Security Fee (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.security_fee} onChange={e => set('security_fee', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('paper_fund', 'Paper Fund (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.paper_fund} onChange={e => set('paper_fund', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('stationery_fee', 'Stationery Fee (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.stationery_fee} onChange={e => set('stationery_fee', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('other_fee', 'Others (Rs.)')}
            <input type="number" className="form-input" style={inputStyle} value={form.other_fee} onChange={e => set('other_fee', e.target.value)} />
          </div>
        </div>

        {/* Parent Info Section */}
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parent / Guardian Information</h3>

        {/* Link an existing parent (for siblings) so details don't need re-typing */}
        {!isEdit && (
          <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Adding a sibling? Search an existing parent to auto-fill their details:
            </div>
            <FamilySearch
              parents={parents}
              students={students}
              classes={classes}
              sections={sections}
              selected={linkedParent}
              onSelect={(parent) => parent && linkParent(parent)}
              onClear={unlinkParent}
              placeholder="Search by Student ID, Admission No, Name, Parent CNIC, Phone or Father/Mother Name..."
            />
            {linkedParent && (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>
                ✓ Linked to existing parent — details filled below. The new student will join this family.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="form-group">
            {impLabel('father_name', "Father's Name")}
            <input className="form-input" style={inputStyle} value={form.father_name} onChange={e => set('father_name', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('father_cnic', "Father's CNIC", '(00000-0000000-0)')}
            <input className="form-input" style={inputStyle} value={form.father_cnic} onChange={e => set('father_cnic', formatCnic(e.target.value))} placeholder="00000-0000000-0" maxLength={15} />
          </div>
          <div className="form-group">
            {impLabel('father_occupation', "Father's Occupation")}
            <input className="form-input" style={inputStyle} value={form.father_occupation} onChange={e => set('father_occupation', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('father_contact', "Father's Contact", '(0000-0000000)')}
            <input className="form-input" style={inputStyle} value={form.father_contact} onChange={e => set('father_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
          <div className="form-group">
            {impLabel('mother_name', "Mother's Name")}
            <input className="form-input" style={inputStyle} value={form.mother_name} onChange={e => set('mother_name', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('mother_cnic', "Mother's CNIC")}
            <input className="form-input" style={inputStyle} value={form.mother_cnic} onChange={e => set('mother_cnic', formatCnic(e.target.value))} placeholder="00000-0000000-0" maxLength={15} />
          </div>
          <div className="form-group">
            {impLabel('mother_contact', "Mother's Contact", '(0000-0000000)')}
            <input className="form-input" style={inputStyle} value={form.mother_contact} onChange={e => set('mother_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
        </div>

        {/* Live reminder of important (★) fields still empty */}
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8,
          background: missingImportant.length ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${missingImportant.length ? '#fde68a' : '#bbf7d0'}`,
          color: missingImportant.length ? '#92400e' : '#166534' }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{missingImportant.length ? '★' : '✓'}</span>
          {missingImportant.length === 0
            ? <span style={{ fontWeight: 600 }}>All important (★) fields are filled.</span>
            : <span><strong>{missingImportant.length} important field{missingImportant.length !== 1 ? 's' : ''} still empty:</strong> {missingImportant.map(f => f.label).join(', ')}. You can save now and fill later.</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Update' : 'Save'} Student</button>
        </div>
      </form>
    </div>
  );
}
