import React, { useState, useEffect } from 'react';
import { apiClasses, apiSections } from '../services/db';
import { formatCnic, formatMobile, validateCnic, validateMobile } from '../utils/formatters';
import { compressImage } from '../utils/image';
import ParentSearch from './ParentSearch';
import { differenceInYears, parseISO } from 'date-fns';

export default function StudentForm({ initial, parents = [], students = [], onSubmit, onCancel, isEdit, nextId }) {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
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
      // Resize + convert to WebP so the stored image stays small
      const dataUrl = await compressImage(file, { maxDim: 600, quality: 0.8 });
      setForm(f => ({ ...f, picture: dataUrl }));
    } catch {
      alert('Could not read the image file. Please try another image.');
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Edit Student' : 'New Admission'}</h2>
      <form onSubmit={handleSubmit}>
        {/* Student Info Section */}
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Information</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">Student ID <span className="text-xs text-secondary-color">(Auto Generated)</span></label>
            <input className="form-input" style={{ ...inputStyle, background: '#f8fafc', fontWeight: 'bold', color: 'var(--primary)' }} disabled value={isEdit ? form.id : nextId} />
          </div>
          <div className="form-group">
            <label className="form-label">Admission Number</label>
            <input className="form-input" style={inputStyle} value={form.roll_no} onChange={e => set('roll_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" className="form-input" style={inputStyle} value={form.dob} onChange={e => set('dob', e.target.value)} />
              <input className="form-input" style={{ ...inputStyle, width: 72, background: '#f1f5f9', textAlign: 'center' }} readOnly value={age !== '' ? `${age} yr` : ''} placeholder="Age" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select className="form-select" style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Admission Date</label>
            <input type="date" className="form-input" style={inputStyle} value={form.admission_date} onChange={e => set('admission_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Class</label>
            <select className="form-select" style={inputStyle} value={form.class_id} onChange={e => { set('class_id', e.target.value); set('section_id', ''); }}>
              <option value="">-- Select --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Section</label>
            <select className="form-select" style={inputStyle} value={form.section_id} onChange={e => set('section_id', e.target.value)}>
              <option value="">-- Select --</option>
              {classSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Fee (Rs.)</label>
            <input type="number" className="form-input" style={inputStyle} value={form.monthly_fee} onChange={e => set('monthly_fee', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fee Starts From</label>
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
            <label className="form-label">Medical Information</label>
            <input className="form-input" style={inputStyle} value={form.medical_info} onChange={e => set('medical_info', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 3' }}>
            <label className="form-label">Student Address</label>
            <textarea className="form-input" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.address} onChange={e => set('address', e.target.value)} placeholder="House #, Street, Area, City" />
          </div>
          <div className="form-group">
            <label className="form-label">Student Picture</label>
            <input type="file" accept="image/*" onChange={handlePicture} style={{ fontSize: '0.85rem' }} />
            {form.picture && <img src={form.picture} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginTop: 8 }} />}
          </div>
        </div>

        {/* Admission / One-Time Charges Section */}
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admission / One-Time Charges</h3>
        {!isEdit && <p className="text-xs text-secondary-color mb-2">Any amount entered here becomes a one-time due in the Fee Voucher (collectible &amp; tracked in history).</p>}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">Admission Fee (Rs.)</label>
            <input type="number" className="form-input" style={inputStyle} value={form.admission_fee} onChange={e => set('admission_fee', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Security Fee (Rs.)</label>
            <input type="number" className="form-input" style={inputStyle} value={form.security_fee} onChange={e => set('security_fee', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Paper Fund (Rs.)</label>
            <input type="number" className="form-input" style={inputStyle} value={form.paper_fund} onChange={e => set('paper_fund', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Stationery Fee (Rs.)</label>
            <input type="number" className="form-input" style={inputStyle} value={form.stationery_fee} onChange={e => set('stationery_fee', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Others (Rs.)</label>
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
            <ParentSearch
              parents={parents}
              students={students}
              selected={linkedParent}
              onSelect={linkParent}
              onClear={unlinkParent}
              placeholder="Search existing Parent by Name, CNIC, Contact or Child's name..."
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
            <label className="form-label">Father's Name</label>
            <input className="form-input" style={inputStyle} value={form.father_name} onChange={e => set('father_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Father's CNIC <span className="text-xs text-secondary-color">(00000-0000000-0)</span></label>
            <input className="form-input" style={inputStyle} value={form.father_cnic} onChange={e => set('father_cnic', formatCnic(e.target.value))} placeholder="00000-0000000-0" maxLength={15} />
          </div>
          <div className="form-group">
            <label className="form-label">Father's Occupation</label>
            <input className="form-input" style={inputStyle} value={form.father_occupation} onChange={e => set('father_occupation', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Father's Contact <span className="text-xs text-secondary-color">(0000-0000000)</span></label>
            <input className="form-input" style={inputStyle} value={form.father_contact} onChange={e => set('father_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
          <div className="form-group">
            <label className="form-label">Mother's Name</label>
            <input className="form-input" style={inputStyle} value={form.mother_name} onChange={e => set('mother_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Mother's CNIC</label>
            <input className="form-input" style={inputStyle} value={form.mother_cnic} onChange={e => set('mother_cnic', formatCnic(e.target.value))} placeholder="00000-0000000-0" maxLength={15} />
          </div>
          <div className="form-group">
            <label className="form-label">Mother's Contact <span className="text-xs text-secondary-color">(0000-0000000)</span></label>
            <input className="form-input" style={inputStyle} value={form.mother_contact} onChange={e => set('mother_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Update' : 'Save'} Student</button>
        </div>
      </form>
    </div>
  );
}
