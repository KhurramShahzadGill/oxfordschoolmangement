import React, { useState, useEffect } from 'react';
import { apiClasses, apiSections, getImportantFields } from '../services/db';
import { formatCnic, formatMobile, validateCnic, validateMobile } from '../utils/formatters';
import { compressImage } from '../utils/image';
import FamilySearch from './FamilySearch';
import { getMissingImportant, isFieldImportant, RELIGIONS } from '../utils/completeness';
import { findParentByCnic, describeParent, isCompleteCnic, PARENT_FIELDS } from '../utils/cnic';
import { findLikelyFamilies } from '../utils/family';
import { differenceInYears, parseISO } from 'date-fns';

export default function StudentForm({ initial, parents = [], students = [], onSubmit, onCancel, isEdit, nextId }) {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  // Ticked = this family genuinely has no father's CNIC, so the mother's is
  // used instead. A deliberate tick rather than a dialog: a dialog gets clicked
  // through, and this is the one decision that can split a family in two.
  const [noFatherCnic, setNoFatherCnic] = useState(false);
  const [form, setForm] = useState({
    id: '', roll_no: '', name: '', dob: '', gender: 'Male', religion: '',
    admission_date: new Date().toISOString().split('T')[0],
    leaving_date: '', medical_info: '', address: '', monthly_fee: '', fee_start_month: new Date().toISOString().split('T')[0].slice(0,7), status: 'Active',
    admission_fee: '', security_fee: '', paper_fund: '', stationery_fee: '', other_fee: '',
    class_id: '', section_id: '', picture: '',
    parent_id: '',
    father_cnic: '', father_name: '', father_contact: '', father_occupation: '',
    mother_cnic: '', mother_name: '', mother_contact: '', mother_occupation: '',
    important_overrides: {},
  });

  useEffect(() => {
    apiClasses.getAll().then(setClasses);
    apiSections.getAll().then(setSections);
  }, []);

  useEffect(() => {
    if (!initial) return;
    setForm(prev => ({ ...prev, ...initial }));
    // No column stores the tick — the record itself says it: a family on file
    // with the mother's CNIC and no father's IS the mother-only case. So an
    // existing record opens with the box already in the right position.
    setNoFatherCnic(!initial.father_cnic && !!initial.mother_cnic);
  }, [initial]);

  const classSections = sections.filter(s => s.class_id === form.class_id);
  const age = form.dob ? differenceInYears(new Date(), parseISO(form.dob)) : '';

  // ── The family this student belongs to ──
  // One parent record is shared by every sibling, so the details below are not
  // this student's own copy: whatever is saved here is what the whole family
  // gets. These two values drive the notices that make that obvious.
  const family = parents.find(p => p.id === form.parent_id) || null;
  const siblings = form.parent_id
    ? students.filter(s => s.parent_id === form.parent_id && String(s.id) !== String(form.id))
    : [];

  // A CNIC identifies one person, so a CNIC found on a DIFFERENT family record
  // means this form is about to give two families the same CNIC. Saving is
  // blocked until it is either linked to that family or the CNIC is corrected.
  const cnicOwner = findParentByCnic(parents, form.father_cnic, form.mother_cnic);
  const cnicConflict = cnicOwner && cnicOwner.id !== form.parent_id ? cnicOwner : null;

  /*
   * The one case a CNIC cannot solve on its own: this family may already be on
   * file under the OTHER parent's CNIC — the mother's only, say, while a
   * father's CNIC is being entered here. No CNIC is shared, so nothing matched;
   * the phone number and the parents' names are what give it away. Suggested,
   * never applied automatically, and only while no family is linked yet.
   */
  const suggestedFamilies = (!form.parent_id && !cnicConflict)
    ? findLikelyFamilies(parents, form).slice(0, 3)
    : [];

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

  /*
   * Link an existing parent → auto-fill their saved details (no re-typing).
   *
   * The saved record wins every field it actually has, but a field it is
   * MISSING is filled from what the operator typed rather than blanked. That is
   * what closes the awkward gap: a family first entered with only the mother's
   * CNIC gains the father's the day his child is admitted, so from then on
   * either CNIC finds them.
   */
  const linkParent = (p) => {
    setForm(f => {
      const next = { ...f, parent_id: p.id };
      PARENT_FIELDS.forEach(k => { next[k] = String(p[k] || '').trim() ? p[k] : (f[k] || ''); });
      return next;
    });
  };

  const unlinkParent = () => {
    setForm(f => ({
      ...f,
      parent_id: '',
      father_name: '', father_cnic: '', father_occupation: '', father_contact: '',
      mother_name: '', mother_cnic: '', mother_contact: '',
    }));
  };

  /*
   * Typing a CNIC is the fastest way to find a family, so the CNIC boxes do the
   * lookup themselves: as soon as 13 digits are in and that CNIC is already on
   * file, this student is linked to that family and every other parent box
   * fills itself from the saved record. An unknown CNIC changes nothing — the
   * remaining boxes stay blank for a brand-new family, exactly as before.
   *
   * The lookup runs from the change handler (not an effect) so it fires once
   * per keystroke the operator actually makes, and never on the initial load of
   * a student being edited.
   */
  const setCnic = (key, raw) => {
    const value = formatCnic(raw);
    setForm(f => ({ ...f, [key]: value }));
    if (!isCompleteCnic(value)) return;

    const owner = findParentByCnic(parents, value);
    if (!owner || owner.id === form.parent_id) return;

    // Blanks in the saved record are filled, not overwritten, so the only thing
    // that can actually be lost is a field where both sides hold something
    // different. On a fresh admission there is usually nothing, so linking
    // happens silently; a real disagreement is the operator's call.
    const wouldReplace = PARENT_FIELDS.some(k =>
      (form[k] || '').trim() && (owner[k] || '').trim() &&
      (form[k] || '').trim() !== (owner[k] || '').trim());

    if (wouldReplace) {
      const kids = students.filter(s => s.parent_id === owner.id);
      const ok = window.confirm(
        `This CNIC is already registered to:\n\n${describeParent(owner)}` +
        (kids.length ? `\nEnrolled children: ${kids.map(s => s.name).join(', ')}` : '') +
        `\n\nLink ${isEdit ? 'this student' : 'the new student'} to that family and load their saved details?\n\n` +
        `OK  = link (where the details differ, the saved ones are kept)\n` +
        `Cancel = leave as is (then correct the CNIC before saving)`
      );
      if (!ok) return;
    }
    linkParent(owner);
  };

  /*
   * Ticking moves the requirement from the father's CNIC to the mother's, and
   * records the same thing in this student's ★ overrides so the missing-data
   * reports do not keep chasing a CNIC that does not exist.
   */
  const toggleNoFatherCnic = (on) => {
    if (on && form.father_cnic && !window.confirm(
      "Father's CNIC is already entered.\n\nTick this only if that CNIC is wrong — it will be cleared from the family record.\n\nContinue?")) return;

    setNoFatherCnic(on);
    setForm(f => {
      const ov = { ...(f.important_overrides || {}) };
      if (on) ov.father_cnic = false; else delete ov.father_cnic;
      return { ...f, father_cnic: on ? '' : f.father_cnic, important_overrides: ov };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    /*
     * A CNIC is unique to one citizen, so requiring one gives every family a
     * dependable identity to join siblings on. Which CNIC is required depends
     * on the tick: the father's normally, the mother's when his does not exist.
     */
    if (!noFatherCnic && !form.father_cnic) {
      alert("Father's CNIC is required.\n\nIf it genuinely does not exist (widowed or divorced mother), tick \"Father's CNIC not available\" and enter the mother's CNIC.");
      return;
    }
    if (noFatherCnic && !form.mother_cnic) {
      alert("Mother's CNIC is required.\n\n\"Father's CNIC not available\" is ticked, so the mother's CNIC is what identifies this family.");
      return;
    }

    // Anything filled in must be in a valid format
    const checks = [
      [form.father_cnic,     validateCnic,   "Father's CNIC must be complete: 00000-0000000-0"],
      [form.mother_cnic,     validateCnic,   "Mother's CNIC must be complete: 00000-0000000-0"],
      [form.father_contact,  validateMobile, "Father's Contact must be complete: 0000-0000000"],
      [form.mother_contact,  validateMobile, "Mother's Contact must be complete: 0000-0000000"],
    ];
    for (const [value, validate, message] of checks) {
      if (value && !validate(value)) { alert(message); return; }
    }

    // Two families can never hold the same CNIC — that is what would split one
    // family into two records and break the shared-parent update.
    if (cnicConflict) {
      alert(
        `This CNIC already belongs to another family:\n\n${describeParent(cnicConflict)}\n\n` +
        `Re-type that CNIC to link this student to that family, or correct the CNIC before saving.`
      );
      return;
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
            {impLabel('religion', 'Religion')}
            <select className="form-select" style={inputStyle} value={form.religion} onChange={e => set('religion', e.target.value)}>
              <option value="">-- Select --</option>
              {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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
            {/* Only one control is offered at a time: a photo is either shown
                with Remove, or the picker is available. Replacing therefore
                always goes Remove -> upload, which is the reliable path. */}
            {form.picture ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={form.picture} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                <div>
                  <button
                    type="button"
                    onClick={removePicture}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Remove
                  </button>
                  <div className="text-xs text-secondary-color" style={{ marginTop: 2 }}>
                    Remove to upload a different photo
                  </div>
                </div>
              </div>
            ) : (
              <input key={photoInputKey} type="file" accept="image/*" onChange={handlePicture} style={{ fontSize: '0.85rem' }} />
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
              Adding a sibling? Just type the parent's CNIC below — or search the family here:
            </div>
            <FamilySearch
              parents={parents}
              students={students}
              classes={classes}
              sections={sections}
              selected={family}
              onSelect={(parent) => parent && linkParent(parent)}
              onClear={unlinkParent}
              placeholder="Search by Student ID, Admission No, Name, Parent CNIC, Phone or Father/Mother Name..."
            />
            {family && (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>
                ✓ Linked to existing parent — details filled below. The new student will join this family.
              </div>
            )}
          </div>
        )}

        {/* CNIC is the family's identity — say so once, right where it is entered. */}
        <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1d4ed8', lineHeight: 1.55 }}>
          <strong>Father's CNIC is required.</strong> It links brothers and sisters to one family.
          A CNIC already on file fills the rest by itself.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={noFatherCnic} onChange={e => toggleNoFatherCnic(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
          Father's CNIC not available (widowed / divorced mother) — use the mother's CNIC
        </label>

        {noFatherCnic && (
          <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e', lineHeight: 1.55 }}>
            <strong>Search this family first.</strong> Without the father's CNIC nothing matches on its own.
            Type the father's name, a phone number or the mother's details — if the family is already on file, it will
            appear here to link.
          </div>
        )}

        {/* Editing a shared record — make the reach of the change obvious. */}
        {siblings.length > 0 && (
          <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: '0.78rem', color: '#5b21b6', lineHeight: 1.55 }}>
            <strong>Shared family record.</strong> These parent details also belong to{' '}
            {siblings.length} other student{siblings.length !== 1 ? 's' : ''} — {siblings.map(s => s.name || `ID ${s.id}`).join(', ')}.
            Any change saved here updates {siblings.length !== 1 ? 'their records' : 'that record'} too.
          </div>
        )}

        {/* The CNICs do not overlap, but this looks like a family already on file. */}
        {suggestedFamilies.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e', lineHeight: 1.55 }}>
            <strong>Is this the same family?</strong> No CNIC matched, but {suggestedFamilies.length === 1 ? 'this record shares' : 'these records share'} other details —
            this happens when one child was admitted with only the mother's CNIC and another with only the father's.
            {suggestedFamilies.map(({ parent: p, reason }) => {
              const kids = students.filter(s => s.parent_id === p.id);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 10px', background: 'white', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{describeParent(p)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#b45309' }}>
                      Matched on {reason}
                      {kids.length ? ` · Children: ${kids.map(s => s.name || `ID ${s.id}`).join(', ')}` : ' · No enrolled children'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => linkParent(p)}
                    style={{ flexShrink: 0, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Yes, same family
                  </button>
                </div>
              );
            })}
            <div style={{ marginTop: 8, fontSize: '0.72rem' }}>
              Linking adds the CNIC entered here to that family's record, so from then on either parent's CNIC finds them.
              If it is a different family, just carry on — nothing changes.
            </div>
          </div>
        )}

        {/* Same CNIC on two families would break that link — stop it before saving. */}
        {cnicConflict && (
          <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.78rem', color: '#b91c1c', lineHeight: 1.55 }}>
            <strong>This CNIC belongs to another family:</strong> {describeParent(cnicConflict)}.
            Re-type the CNIC to link this student to that family, or correct it — the record cannot be saved as it is.
          </div>
        )}

        {/* CNIC first in each row — it is what the operator types first, and it
            fills the three boxes beside it when the family is already on file. */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="form-group">
            {impLabel('father_cnic', "Father's CNIC", noFatherCnic ? '(not available)' : '(00000-0000000-0)')}
            {/* Locked while the box is ticked, so a half-typed CNIC cannot be
                left behind contradicting the answer that was just given. */}
            <input className="form-input" style={{ ...inputStyle, ...(noFatherCnic ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}) }}
              disabled={noFatherCnic}
              value={form.father_cnic} onChange={e => setCnic('father_cnic', e.target.value)}
              placeholder={noFatherCnic ? '—' : '00000-0000000-0'} maxLength={15} />
          </div>
          <div className="form-group">
            {impLabel('father_name', "Father's Name")}
            <input className="form-input" style={inputStyle} value={form.father_name} onChange={e => set('father_name', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('father_contact', "Father's Contact", '(0000-0000000)')}
            <input className="form-input" style={inputStyle} value={form.father_contact} onChange={e => set('father_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
          <div className="form-group">
            {impLabel('father_occupation', "Father's Occupation")}
            <input className="form-input" style={inputStyle} value={form.father_occupation} onChange={e => set('father_occupation', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('mother_cnic', "Mother's CNIC", '(00000-0000000-0)')}
            <input className="form-input" style={inputStyle} value={form.mother_cnic} onChange={e => setCnic('mother_cnic', e.target.value)} placeholder="00000-0000000-0" maxLength={15} />
          </div>
          <div className="form-group">
            {impLabel('mother_name', "Mother's Name")}
            <input className="form-input" style={inputStyle} value={form.mother_name} onChange={e => set('mother_name', e.target.value)} />
          </div>
          <div className="form-group">
            {impLabel('mother_contact', "Mother's Contact", '(0000-0000000)')}
            <input className="form-input" style={inputStyle} value={form.mother_contact} onChange={e => set('mother_contact', formatMobile(e.target.value))} placeholder="0000-0000000" maxLength={12} />
          </div>
          <div className="form-group">
            {impLabel('mother_occupation', "Mother's Occupation")}
            <input className="form-input" style={inputStyle} value={form.mother_occupation} onChange={e => set('mother_occupation', e.target.value)} />
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
