import React, { useState, useEffect } from 'react';
import { apiStudents, apiParents, apiClasses, apiSections, apiCustomCharges, apiFees, getSettings, getImportantFields, peekNextStudentId, uploadStudentPhoto, deleteStudentPhoto, ADMISSION_HEADS } from '../services/db';
import { Plus, Edit2, Trash2, Eye, FileSpreadsheet, Printer, X, AlertTriangle, CheckCircle2, GraduationCap } from 'lucide-react';
import { differenceInYears, parseISO, format } from 'date-fns';
import StudentForm from '../components/StudentForm';
import StudentProfile from '../components/StudentProfile';
import StudentCard from '../components/StudentCard';
import FamilySearch from '../components/FamilySearch';
import PromoteClassModal from '../components/PromoteClassModal';
import { getMissingFields, ADMISSION_FIELD_GROUPS } from '../utils/completeness';
import * as XLSX from 'xlsx';

/* ───────── Column Groups for Export Modal ───────── */
const STUDENT_COL_GROUPS = [
  {
    label: 'Basic Info',
    columns: [
      { key: 'id',      label: 'Student ID' },
      { key: 'roll_no', label: 'Admission No' },
      { key: 'name',    label: 'Student Name' },
      { key: 'status',  label: 'Status' },
      { key: 'gender',  label: 'Gender' },
    ],
  },
  {
    label: 'Academic',
    columns: [
      { key: 'class',           label: 'Class' },
      { key: 'section',         label: 'Section' },
      { key: 'admission_date',  label: 'Admission Date' },
      { key: 'leaving_date',    label: 'Leaving Date' },
    ],
  },
  {
    label: 'Personal Info',
    columns: [
      { key: 'dob',          label: 'Date of Birth' },
      { key: 'age',          label: 'Age' },
      { key: 'medical_info', label: 'Medical Info' },
    ],
  },
  {
    label: 'Father Info',
    columns: [
      { key: 'father_name',       label: 'Father Name' },
      { key: 'father_cnic',       label: 'Father CNIC' },
      { key: 'father_contact',    label: 'Father Contact' },
      { key: 'father_occupation', label: 'Father Occupation' },
      { key: 'address',           label: 'Address' },
    ],
  },
  {
    label: 'Mother Info',
    columns: [
      { key: 'mother_name',    label: 'Mother Name' },
      { key: 'mother_cnic',    label: 'Mother CNIC' },
      { key: 'mother_contact', label: 'Mother Contact' },
    ],
  },
  {
    label: 'Fee Info',
    columns: [
      { key: 'monthly_fee',     label: 'Monthly Fee (Rs.)' },
      { key: 'fee_start_month', label: 'Fee Start Month' },
    ],
  },
];

/* ───────── Professional Export Modal ───────── */
function ExportModal({ isOpen, onClose, title, columnGroups, selectedCols, onColChange, onPrint, onExcel, filterSummary }) {
  if (!isOpen) return null;

  const toggleGroup = (group) => {
    const allSel = group.columns.every(c => selectedCols[c.key]);
    group.columns.forEach(c => onColChange(c.key, !allSel));
  };

  const selectedCount = Object.values(selectedCols).filter(Boolean).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', animation: 'fadeIn 0.25s ease' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#4318FF 0%,#3311DB 100%)', padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={18} style={{ opacity: 0.85 }} /> {title}
            </div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
              Select columns for PDF print and Excel export
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '7px', cursor: 'pointer', color: 'white', display: 'flex', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <X size={18} />
          </button>
        </div>

        {/* Filter Info Bar */}
        {filterSummary && (
          <div style={{ padding: '9px 26px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>📋</span> {filterSummary}
          </div>
        )}

        {/* Column Groups Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {columnGroups.map(group => {
              const allSel = group.columns.every(c => selectedCols[c.key]);
              return (
                <div key={group.label} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                  {/* Group Header */}
                  <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</span>
                    <button
                      onClick={() => toggleGroup(group)}
                      style={{ background: allSel ? '#4318FF' : '#e0e7ff', color: allSel ? 'white' : '#4318FF', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                    >
                      {allSel ? '✕ Deselect' : '✓ All'}
                    </button>
                  </div>
                  {/* Checkboxes */}
                  <div style={{ padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {group.columns.map(col => (
                      <label key={col.key} onClick={() => onColChange(col.key, !selectedCols[col.key])} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: selectedCols[col.key] ? '#4318FF' : 'white', border: `1.5px solid ${selectedCols[col.key] ? '#4318FF' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                          {selectedCols[col.key] && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#374151', fontWeight: 500, userSelect: 'none' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Count pill */}
          <div style={{ marginTop: 14, padding: '9px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✓</span>
            <span>{selectedCount} column{selectedCount !== 1 ? 's' : ''} selected for export</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '14px 26px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
            Cancel
          </button>
          <button
            onClick={() => { onExcel(); onClose(); }}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
          >
            <FileSpreadsheet size={15} /> Export Excel ({selectedCount} cols)
          </button>
          <button
            onClick={() => { onPrint(); onClose(); }}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4318FF,#3311DB)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(67,24,255,0.3)' }}
          >
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Main Students Component ───────── */
export default function Students() {
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [profileId, setProfileId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [printCards, setPrintCards] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [ageFrom, setAgeFrom] = useState('');
  const [ageTo, setAgeTo] = useState('');

  // Data completeness (missing-info) states
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [printMissing, setPrintMissing] = useState(false);
  const [printBlankForm, setPrintBlankForm] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  // Export / Print States
  const [printStudentList, setPrintStudentList] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [printCols, setPrintCols] = useState({
    id: true, roll_no: true, name: true, status: true, gender: false,
    class: true, section: true, admission_date: false, leaving_date: false,
    dob: false, age: false, medical_info: false,
    father_name: false, father_cnic: false, father_contact: false, father_occupation: false,
    mother_name: false, mother_cnic: false, mother_contact: false,
    monthly_fee: true, fee_start_month: false, address: false
  });

  const loadData = async () => {
    setLoading(true);
    const [sData, pData, cData, secData] = await Promise.all([
      apiStudents.getAll(), apiParents.getAll(), apiClasses.getAll(), apiSections.getAll()
    ]);
    setStudents(sData); setParents(pData); setClasses(cData); setSections(secData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleFormSubmit = async (form) => {
    // Admission No stays manual, but must be unique across students.
    const adm = (form.roll_no || '').trim();
    if (adm) {
      const dup = students.find(s => (s.roll_no || '').trim().toLowerCase() === adm.toLowerCase() && s.id !== editData?.id);
      if (dup) {
        alert(`Admission No "${adm}" is already used by ${dup.name} (Student ID ${dup.id}).\n\nPlease enter a unique Admission No.`);
        return;
      }
    }

    const parentData = {
      father_name: form.father_name, father_cnic: form.father_cnic,
      father_occupation: form.father_occupation, father_contact: form.father_contact,
      mother_name: form.mother_name, mother_cnic: form.mother_cnic, mother_contact: form.mother_contact,
    };
    // Everything below runs inside one try/catch. If the student save fails we
    // undo the parent we created for it, so a retry cannot pile up duplicates.
    let parent;
    let createdParentId = null;

    try {
      // If linked to an existing parent (sibling, or editing) reuse that record;
      // otherwise find-or-create. This avoids duplicate parent records.
      if (form.parent_id) {
        parent = await apiParents.update(form.parent_id, parentData);
      } else {
        const res = await apiParents.createOrGet(parentData);
        parent = res.parent;
        if (res.isNew) createdParentId = parent.id;
      }

      const isNewPhoto = !!form.picture && form.picture.startsWith('data:');
      // Photo cleared on an existing student — the stored file must go too.
      const removedPhoto = !!editData?.picture && !form.picture;
      const studentData = {
        roll_no: form.roll_no, name: form.name, dob: form.dob,
        gender: form.gender, admission_date: form.admission_date, leaving_date: form.leaving_date,
        medical_info: form.medical_info, monthly_fee: Number(form.monthly_fee) || 0, fee_start_month: form.fee_start_month,
        admission_fee: form.admission_fee, security_fee: form.security_fee, paper_fund: form.paper_fund,
        stationery_fee: form.stationery_fee, other_fee: form.other_fee,
        address: form.address,
        // Keep any already-stored URL; a freshly picked photo is attached after
        // the row is saved, so a rejected save never orphans an upload.
        picture: isNewPhoto ? (editData?.picture || '') : (form.picture || ''),
        status: form.status, parent_id: parent.id, class_id: form.class_id, section_id: form.section_id,
        important_overrides: form.important_overrides || {},
      };

      const saved = editData
        ? await apiStudents.update(editData.id, studentData)
        : await apiStudents.create(studentData);

      // The student row exists now — safe to upload the photo and attach it.
      // The upload overwrites this student's existing file, so nothing is left
      // behind and no separate cleanup is needed here.
      if (isNewPhoto) {
        const url = await uploadStudentPhoto(form.picture, saved.id);
        await apiStudents.update(saved.id, { picture: url });
      } else if (removedPhoto) {
        await deleteStudentPhoto(editData.picture);
      }

      if (!editData) {
        // Turn any entered one-time charges into collectible charge records
        for (const { key, label } of ADMISSION_HEADS) {
          const amount = Number(form[key] || 0);
          if (amount > 0) {
            await apiCustomCharges.create({
              student_id: saved.id, title: label, is_admission: true,
              amount, amount_paid: 0, status: 'Unpaid', paid_date: null,
            });
          }
        }
      }

      setShowForm(false); setEditData(null); loadData();
    } catch (err) {
      // Undo a parent that was created only for this failed save.
      if (createdParentId) {
        try { await apiParents.delete(createdParentId); } catch { /* best effort */ }
      }
      alert(err.message);
    }
  };

  const handleEdit = (s) => {
    const p = parents.find(pr => pr.id === s.parent_id);
    setEditData({
      ...s,
      father_name: p?.father_name || '', father_cnic: p?.father_cnic || '',
      father_occupation: p?.father_occupation || '', father_contact: p?.father_contact || '',
      mother_name: p?.mother_name || '', mother_cnic: p?.mother_cnic || '', mother_contact: p?.mother_contact || '',
      fee_start_month: s.fee_start_month || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;

    const student = students.find(s => s.id === id);
    const parentId = student?.parent_id;

    await apiStudents.delete(id);

    // If this was the parent's last enrolled child, offer to remove the orphaned parent too
    if (parentId) {
      const siblings = students.filter(s => s.parent_id === parentId && s.id !== id);
      if (siblings.length === 0) {
        const parent = parents.find(p => p.id === parentId);
        const pname = parent?.father_name ? `"${parent.father_name}"` : 'this parent';
        if (window.confirm(`This parent (${pname}) has no other enrolled children.\n\nDo you also want to delete the parent record?\n\nOK = delete parent too | Cancel = keep parent record`)) {
          await apiParents.delete(parentId);
        }
      }
    }

    loadData();
  };

  // Filtering logic
  const filtered = students.filter(s => {
    if (filterClass && s.class_id !== filterClass) return false;
    if (filterSection && s.section_id !== filterSection) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const p = parents.find(pr => pr.id === s.parent_id);
      const hit = s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q)
        || p?.father_name?.toLowerCase().includes(q) || p?.mother_name?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (ageFrom || ageTo) {
      if (!s.dob) return false;
      let age = 0;
      try { age = differenceInYears(new Date(), parseISO(s.dob)); } catch { return false; }
      if (ageFrom && age < parseInt(ageFrom)) return false;
      if (ageTo && age > parseInt(ageTo)) return false;
    }
    return true;
  });

  const filterSections = sections.filter(s => s.class_id === filterClass);

  // Which of the currently-filtered students have missing important fields.
  // Importance = global default (Settings) merged with each student's overrides.
  const importantKeys = getImportantFields();
  const parentOf = (s) => parents.find(p => p.id === s.parent_id);
  const incompleteRows = filtered
    .map(s => ({ s, missing: getMissingFields(s, parentOf(s), importantKeys) }))
    .filter(r => r.missing.length > 0);
  const incompleteCount = incompleteRows.length;
  const tableRows = showIncompleteOnly ? incompleteRows.map(r => r.s) : filtered;

  // Unpaid dues per student, loaded only when the promotion screen opens so the
  // Students page itself stays light. Mirrors the Fee page's calculation:
  // every month from the fee start date, plus any outstanding one-time charges.
  const [promoDues, setPromoDues] = useState({});
  const openPromote = async () => {
    setShowPromote(true);
    try {
      const [fees, charges] = await Promise.all([apiFees.getAll(), apiCustomCharges.getAll()]);
      const thisMonth = format(new Date(), 'yyyy-MM');
      const dues = {};
      students.forEach(s => {
        let owed = 0;
        let m = s.fee_start_month;
        while (m && m <= thisMonth) {
          const rec = fees.find(f => f.student_id === s.id && f.month === m);
          const due = Number(rec?.monthly_fee ?? s.monthly_fee ?? 0)
            + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
          const balance = due - Number(rec?.amount_paid || 0);
          if (balance > 0) owed += balance;
          const [y, mo] = m.split('-').map(Number);
          m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
        }
        charges.filter(c => c.student_id === s.id).forEach(c => {
          const balance = Number(c.amount || 0) - Number(c.amount_paid || 0);
          if (balance > 0) owed += balance;
        });
        dues[s.id] = owed;
      });
      setPromoDues(dues);
    } catch {
      setPromoDues({}); // the warning is a bonus; never block promotion over it
    }
  };

  const handlePrintMissing = () => {
    setShowMissingModal(false);
    setPrintMissing(true);
    setTimeout(() => window.print(), 200);
    setTimeout(() => setPrintMissing(false), 800);
  };

  // Print a clean, blank admission form to hand out / send home for filling.
  const handlePrintBlankForm = () => {
    setPrintBlankForm(true);
    setTimeout(() => window.print(), 200);
    setTimeout(() => setPrintBlankForm(false), 800);
  };

  // Excel export of students with missing important data — includes identity
  // and contact numbers so the school can reach the families.
  const handleExportMissingExcel = () => {
    if (incompleteRows.length === 0) { alert('No missing data — every profile in this view is complete.'); return; }
    const rows = incompleteRows.map(({ s, missing }) => {
      const p = parentOf(s);
      const c = classes.find(cl => cl.id === s.class_id);
      const sec = sections.find(sc => sc.id === s.section_id);
      return {
        'Student ID':      s.id || '',
        'Admission No':    s.roll_no || '',
        'Student Name':    s.name || '',
        'Class':           c?.class_name || '',
        'Section':         sec?.section_name || '',
        'Father Name':     p?.father_name || '',
        'Father Contact':  p?.father_contact || '',
        'Mother Contact':  p?.mother_contact || '',
        'Missing Count':   missing.length,
        'Missing Important Fields': missing.map(m => m.label).join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: k === 'Missing Important Fields' ? 45 : Math.max(k.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Data');
    XLSX.writeFile(wb, `Missing_Data_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Summary stats
  const activeCount = filtered.filter(s => s.status === 'Active').length;
  const leftCount = filtered.filter(s => s.status === 'Left').length;
  const maleCount = filtered.filter(s => s.gender === 'Male').length;
  const femaleCount = filtered.filter(s => s.gender === 'Female').length;

  // Build filter summary string for modal
  const filterSummaryText = [
    `${filtered.length} students filtered`,
    filterClass && `Class: ${classes.find(c => c.id === filterClass)?.class_name}`,
    filterSection && `Section: ${sections.find(s => s.id === filterSection)?.section_name}`,
    filterStatus && `Status: ${filterStatus}`,
    searchQuery && `Search: "${searchQuery}"`,
  ].filter(Boolean).join(' · ');

  // Excel Export — respects printCols
  const handleExportExcel = () => {
    if (filtered.length === 0) { alert('No students found to export.'); return; }
    const rows = filtered.map(s => {
      const p = parents.find(pr => pr.id === s.parent_id);
      const c = classes.find(cl => cl.id === s.class_id);
      const sec = sections.find(sc => sc.id === s.section_id);
      let age = '';
      try { if (s.dob) age = differenceInYears(new Date(), parseISO(s.dob)); } catch {}
      const row = {};
      if (printCols.id)               row['Student ID']         = s.id || '';
      if (printCols.roll_no)          row['Admission No']       = s.roll_no || '';
      if (printCols.name)             row['Student Name']       = s.name || '';
      if (printCols.status)           row['Status']             = s.status || '';
      if (printCols.gender)           row['Gender']             = s.gender || '';
      if (printCols.class)            row['Class']              = c?.class_name || '';
      if (printCols.section)          row['Section']            = sec?.section_name || '';
      if (printCols.admission_date)   row['Admission Date']     = s.admission_date || '';
      if (printCols.leaving_date)     row['Leaving Date']       = s.leaving_date || '';
      if (printCols.dob)              row['Date of Birth']      = s.dob || '';
      if (printCols.age)              row['Age']                = age;
      if (printCols.medical_info)     row['Medical Info']       = s.medical_info || '';
      if (printCols.father_name)      row['Father Name']        = p?.father_name || '';
      if (printCols.father_cnic)      row['Father CNIC']        = p?.father_cnic || '';
      if (printCols.father_contact)   row['Father Contact']     = p?.father_contact || '';
      if (printCols.father_occupation)row['Father Occupation']  = p?.father_occupation || '';
      if (printCols.address)          row['Address']            = s?.address || '';
      if (printCols.mother_name)      row['Mother Name']        = p?.mother_name || '';
      if (printCols.mother_cnic)      row['Mother CNIC']        = p?.mother_cnic || '';
      if (printCols.mother_contact)   row['Mother Contact']     = p?.mother_contact || '';
      if (printCols.monthly_fee)      row['Monthly Fee (Rs.)']  = s.monthly_fee || 0;
      if (printCols.fee_start_month)  row['Fee Start Month']    = s.fee_start_month || '';
      return row;
    });
    if (Object.keys(rows[0] || {}).length === 0) { alert('Please select at least one column.'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const fileName = `Students_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintList = () => {
    setPrintStudentList(true);
    setTimeout(() => window.print(), 200);
    setTimeout(() => setPrintStudentList(false), 800);
  };

  // Bulk-print ID cards for the currently filtered students (one card per page).
  const handlePrintCards = () => {
    if (filtered.length === 0) { alert('No students to print. Adjust the filters first.'); return; }
    setPrintCards(true);
    document.body.classList.add('print-mode');
    setTimeout(() => window.print(), 250);
    setTimeout(() => { setPrintCards(false); document.body.classList.remove('print-mode'); }, 1000);
  };

  const thStyle = { padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.03em', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)' };
  const tdStyle = { padding: '5px 8px', fontSize: 10, wordBreak: 'break-word', overflowWrap: 'break-word', borderRight: '1px solid #e2e8f0', verticalAlign: 'top', lineHeight: 1.4 };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePrintCards}
              title="Print ID cards for the filtered students"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              <Printer size={15} /> ID Cards ({filtered.length})
            </button>
            <button
              onClick={openPromote}
              title="Move a whole class up to the next class"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              <GraduationCap size={15} /> Promote Class
            </button>
            {/* Blank admission form to print / send home */}
            <button
              onClick={handlePrintBlankForm}
              title="Print a blank admission form to send home for filling"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              <Printer size={15} /> Blank Form
            </button>
            {/* Single Export button opens the modal */}
            <button
              onClick={() => setShowExportModal(true)}
              title="Select columns for PDF print or Excel export"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#4318FF,#3311DB)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 2px 8px rgba(67,24,255,0.3)' }}
            >
              <Printer size={15} />
              <FileSpreadsheet size={15} />
              Export / Print ({filtered.length})
            </button>
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditData(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <Plus size={16} /> New Admission
            </button>
          </div>
        </div>

        {showForm && (
          <StudentForm
            initial={editData}
            parents={parents}
            students={students}
            isEdit={!!editData}
            nextId={peekNextStudentId()}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditData(null); }}
          />
        )}

        {/* Search & Filters */}
        <div className="card mb-6" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <FamilySearch
              students={students}
              parents={parents}
              classes={classes}
              sections={sections}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSelect={(parent, student) => { if (student) setProfileId(student.id); }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, minWidth: 130, padding: '10px 14px' }} value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, minWidth: 130, padding: '10px 14px' }} value={filterSection}
              onChange={e => setFilterSection(e.target.value)} disabled={!filterClass}>
              <option value="">All Sections</option>
              {filterSections.map(s => <option key={s.id} value={s.id}>Sec {s.section_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, minWidth: 130, padding: '10px 14px' }} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Left">Left</option>
            </select>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 180, background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Age:</span>
              <input type="number" className="form-input" placeholder="Min" style={{ width: 70, padding: '6px 10px', height: '32px' }} value={ageFrom} onChange={e => setAgeFrom(e.target.value)} min="1" max="50" />
              <span className="text-sm text-secondary-color">-</span>
              <input type="number" className="form-input" placeholder="Max" style={{ width: 70, padding: '6px 10px', height: '32px' }} value={ageTo} onChange={e => setAgeTo(e.target.value)} min="1" max="50" />
            </div>

            <button
              onClick={() => setShowIncompleteOnly(v => !v)}
              title="Show only students with missing required fields"
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '9px 14px', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${showIncompleteOnly ? 'var(--danger)' : 'var(--border-color)'}`, background: showIncompleteOnly ? 'var(--danger)' : 'var(--bg-secondary)', color: showIncompleteOnly ? 'white' : 'var(--text-secondary)' }}
            >
              <AlertTriangle size={14} /> Incomplete only
            </button>
          </div>
        </div>

        {/* Summary Dashboard */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="text-xs text-secondary-color font-medium">Total Filtered</div>
            <div className="text-xl font-bold mt-1">{filtered.length}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--success)' }}>Active</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--success)' }}>{activeCount}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="text-xs text-secondary-color font-medium">Male / Female</div>
            <div className="text-xl font-bold mt-1">{maleCount} / {femaleCount}</div>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--danger)' }}>Left</div>
            <div className="text-xl font-bold mt-1" style={{ color: 'var(--danger)' }}>{leftCount}</div>
          </div>
        </div>

        {/* Missing important data — contextual actions (contact families) */}
        {!loading && incompleteCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 18px', marginBottom: 20 }}>
            <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, color: '#9a3412' }}>{incompleteCount} student{incompleteCount !== 1 ? 's' : ''} missing important data</div>
              <div style={{ fontSize: '0.76rem', color: '#c2410c' }}>Export their details &amp; missing fields (with contact numbers) to reach the families.</div>
            </div>
            <button onClick={() => setShowMissingModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: '#9a3412', border: '1px solid #fdba74', borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
              <AlertTriangle size={14} /> View &amp; Print
            </button>
            <button onClick={handleExportMissingExcel}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        )}

        {/* Students Table */}
        <div className="card">
          {loading ? <p style={{ padding: 24, textAlign: 'center' }}>Loading...</p> : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Admission No</th><th>Name</th><th>Class</th><th>Section</th><th>Status</th><th>Data</th><th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>{showIncompleteOnly ? 'No incomplete profiles in this view.' : 'No students found.'}</td></tr>
                  ) : tableRows.map(s => {
                    const c = classes.find(cl => cl.id === s.class_id);
                    const sec = sections.find(sc => sc.id === s.section_id);
                    const miss = getMissingFields(s, parentOf(s), importantKeys);
                    return (
                      <tr key={s.id}>
                        <td className="text-xs text-secondary-color">{s.id}</td>
                        <td className="font-medium">{s.roll_no}</td>
                        <td className="font-medium">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {s.picture && <img src={s.picture} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                            {s.name}
                          </div>
                        </td>
                        <td>{c?.class_name || '-'}</td>
                        <td>{sec?.section_name || '-'}</td>
                        <td><span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                        <td>
                          {miss.length === 0 ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Complete</span>
                          ) : (
                            <button onClick={() => handleEdit(s)} title={`Missing: ${miss.map(m => m.label).join(', ')}`}
                              className="badge badge-danger" style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={12} /> {miss.length} missing
                            </button>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => setProfileId(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginRight: 8 }} title="View Profile"><Eye size={16} /></button>
                          <button onClick={() => handleEdit(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: 8 }} title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Delete"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Student Profile Modal */}
      {profileId && (
        <StudentProfile studentId={profileId} onClose={() => setProfileId(null)} onUpdate={loadData} />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Student Report — Export Settings"
        columnGroups={STUDENT_COL_GROUPS}
        selectedCols={printCols}
        onColChange={(key, val) => setPrintCols(prev => ({ ...prev, [key]: val }))}
        onPrint={handlePrintList}
        onExcel={handleExportExcel}
        filterSummary={filterSummaryText}
      />

      {/* Promote a whole class */}
      <PromoteClassModal
        isOpen={showPromote}
        onClose={() => setShowPromote(false)}
        students={students}
        classes={classes}
        sections={sections}
        outstandingOf={(s) => promoDues[s.id] || 0}
        onDone={loadData}
      />

      {/* Missing Info Modal */}
      {showMissingModal && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', animation: 'fadeIn 0.25s ease' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#E31A1A 0%,#b91c1c 100%)', padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} /> Missing Admission Data
                </div>
                <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                  {incompleteCount} of {filtered.length} students in this view need attention
                </div>
              </div>
              <button onClick={() => setShowMissingModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 7, cursor: 'pointer', color: 'white', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            {/* Note */}
            <div style={{ padding: '9px 26px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontSize: '0.74rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
              Optional fields (Medical Info, One-Time Charges, Father's Occupation, Mother's Contact) are not checked.
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 26px' }}>
              {incompleteCount === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--success)' }}>
                  <CheckCircle2 size={42} style={{ marginBottom: 10 }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>All profiles in this view are complete 🎉</div>
                </div>
              ) : incompleteRows.map(({ s, missing }) => {
                const c = classes.find(cl => cl.id === s.class_id);
                const sec = sections.find(sc => sc.id === s.section_id);
                return (
                  <div key={s.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name || <span style={{ color: 'var(--danger)' }}>(No name)</span>}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>ID {s.id} · Adm {s.roll_no || '—'} · {c?.class_name || '—'}{sec?.section_name ? ` (${sec.section_name})` : ''}</div>
                        {(() => { const p = parentOf(s); return (p?.father_name || p?.father_contact || p?.mother_contact) ? (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {p?.father_name && `${p.father_name}`}{p?.father_contact && ` · ☎ ${p.father_contact}`}{p?.mother_contact && ` · ☎ ${p.mother_contact}`}
                          </div>
                        ) : null; })()}
                      </div>
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.75rem', flexShrink: 0 }} onClick={() => { setShowMissingModal(false); handleEdit(s); }}>
                        <Edit2 size={13} /> Fill
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {missing.map(m => (
                        <span key={m.key} style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{m.label}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 26px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
              <button onClick={() => setShowMissingModal(false)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Close</button>
              {incompleteCount > 0 && (
                <button onClick={() => { setShowMissingModal(false); handleExportMissingExcel(); }} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileSpreadsheet size={15} /> Export Excel
                </button>
              )}
              {incompleteCount > 0 && (
                <button onClick={handlePrintMissing} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#E31A1A,#b91c1c)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Printer size={15} /> Print Checklist
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY: Missing Data Checklist */}
      {printMissing && (
        <div className="print-only">
          <div style={{ textAlign: 'center', borderBottom: '3px solid #E31A1A', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#E31A1A', letterSpacing: '-0.02em' }}>{getSettings().school_name}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>Missing Admission Data — Checklist</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
              {incompleteCount} student{incompleteCount !== 1 ? 's' : ''} with missing fields · Printed {format(new Date(), 'dd MMM yyyy, hh:mm a')}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incompleteRows.map(({ s, missing }, idx) => {
              const c = classes.find(cl => cl.id === s.class_id);
              const sec = sections.find(sc => sc.id === s.section_id);
              const p = parentOf(s);
              return (
                <div key={s.id} style={{ borderBottom: '1px solid #000', paddingBottom: 8, pageBreakInside: 'avoid' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#000' }}>
                    #{idx + 1} — {s.name || '(no name)'} · ID {s.id} · Adm {s.roll_no || '-'} · {c?.class_name || '-'}{sec?.section_name ? ` (${sec.section_name})` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: '#000', marginTop: 2 }}>
                    Father: {p?.father_name || '-'} · Contact: {p?.father_contact || p?.mother_contact || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: '#000', marginTop: 3 }}><strong>Missing:</strong> {missing.map(m => m.label).join(', ')}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRINT-ONLY: Blank Admission Form (to send home) */}
      {printBlankForm && (() => {
        const st = getSettings();
        const wideKeys = new Set(['address', 'medical_info']);
        return (
          <div className="print-only">
            {/* Letterhead */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '3px solid #4318FF', paddingBottom: 12, marginBottom: 12 }}>
              <img src={st.logo || '/logo.png'} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#4318FF', letterSpacing: '-0.02em' }}>{st.school_name}</div>
                {st.tagline && <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>{st.tagline}</div>}
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{st.address}{st.phone ? `  ·  ☎ ${st.phone}` : ''}</div>
              </div>
              <div style={{ width: 88, height: 106, border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#475569', textAlign: 'center', padding: 4 }}>
                Affix Recent Photograph
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <span style={{ display: 'inline-block', background: '#4318FF', color: 'white', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', padding: '4px 18px', borderRadius: 4 }}>STUDENT ADMISSION FORM</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 9, color: '#64748b', marginBottom: 10 }}><span style={{ color: '#f59e0b' }}>★</span> = Required field</div>

            {ADMISSION_FIELD_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 12, pageBreakInside: 'avoid' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4318FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #cbd5e1', paddingBottom: 3, marginBottom: 8 }}>{group.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                  {group.fields.map(f => (
                    <div key={f.key} style={{ gridColumn: wideKeys.has(f.key) ? '1 / -1' : 'auto' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#000', marginBottom: 4 }}>
                        {importantKeys.includes(f.key) && <span style={{ color: '#f59e0b' }}>★ </span>}{f.label}
                      </div>
                      <div style={{ borderBottom: '1px solid #000', height: 14 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Declaration + signatures */}
            <div style={{ marginTop: 14, fontSize: 10, color: '#000', pageBreakInside: 'avoid' }}>
              <div style={{ marginBottom: 22 }}>I hereby declare that the information provided above is true and correct to the best of my knowledge.</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                <div style={{ flex: 1 }}><div style={{ borderTop: '1px solid #000', paddingTop: 3, textAlign: 'center' }}>Parent / Guardian Signature</div></div>
                <div style={{ flex: 1 }}><div style={{ borderTop: '1px solid #000', paddingTop: 3, textAlign: 'center' }}>Date</div></div>
                <div style={{ flex: 1 }}><div style={{ borderTop: '1px solid #000', paddingTop: 3, textAlign: 'center' }}>Principal / Admission Officer</div></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRINT-ONLY: Bulk Student ID Cards — packed onto A4 pages */}
      {printCards && (
        <div className="print-only id-card-bulk">
          {filtered.map(s => (
            <div className="id-card-sheet" key={s.id}>
              <StudentCard
                student={s}
                parent={parents.find(pr => pr.id === s.parent_id)}
                className={classes.find(c => c.id === s.class_id)?.class_name}
                sectionName={sections.find(sec => sec.id === s.section_id)?.section_name}
              />
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PRINT-ONLY: Professional Student List
          ═══════════════════════════════════════════ */}
      {printStudentList && (
        <div className="print-only">
          {/* Report Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #4318FF', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4318FF', letterSpacing: '-0.02em' }}>{getSettings().school_name}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>Student List Report</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 6, fontSize: 10, color: '#64748b', flexWrap: 'wrap' }}>
              <span>Total Students: <strong>{filtered.length}</strong></span>
              <span>Active: <strong style={{ color: '#059669' }}>{activeCount}</strong></span>
              <span>Left: <strong style={{ color: '#dc2626' }}>{leftCount}</strong></span>
              <span>Male: <strong>{maleCount}</strong> / Female: <strong>{femaleCount}</strong></span>
              {filterClass && <span>Class: <strong>{classes.find(c => c.id === filterClass)?.class_name}</strong></span>}
              {filterSection && <span>Section: <strong>{sections.find(s => s.id === filterSection)?.section_name}</strong></span>}
              {filterStatus && <span>Status: <strong>{filterStatus}</strong></span>}
              <span>Printed: <strong>{format(new Date(), 'dd MMM yyyy, hh:mm a')}</strong></span>
            </div>
          </div>

          {/* Smart Wrap List Layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((s, idx) => {
              const c = classes.find(cl => cl.id === s.class_id);
              const sec = sections.find(sc => sc.id === s.section_id);
              const p = parents.find(pr => pr.id === s.parent_id);
              let age = '-';
              try { if (s.dob) age = differenceInYears(new Date(), parseISO(s.dob)); } catch {}

              return (
                <div key={s.id} style={{ borderBottom: '1px solid #000', paddingBottom: 10, pageBreakInside: 'avoid' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 11, color: '#000000' }}>
                    <div style={{ width: '100%', fontSize: 13, fontWeight: 900, marginBottom: 4, color: '#000000' }}>
                      #{idx + 1} - {s.name} (Admission No: {s.roll_no || '-'})
                    </div>
                    {printCols.id && <div style={{ minWidth: 120 }}><strong>ID:</strong> {s.id}</div>}
                    {printCols.status && <div style={{ minWidth: 120 }}><strong>Status:</strong> {s.status}</div>}
                    {printCols.gender && <div style={{ minWidth: 120 }}><strong>Gender:</strong> {s.gender || '-'}</div>}
                    {printCols.class && <div style={{ minWidth: 120 }}><strong>Class:</strong> {c?.class_name || '-'}</div>}
                    {printCols.section && <div style={{ minWidth: 120 }}><strong>Section:</strong> {sec?.section_name || '-'}</div>}
                    {printCols.admission_date && <div style={{ minWidth: 120 }}><strong>Adm. Date:</strong> {s.admission_date || '-'}</div>}
                    {printCols.leaving_date && <div style={{ minWidth: 120 }}><strong>Leaving:</strong> {s.leaving_date || '-'}</div>}
                    {printCols.dob && <div style={{ minWidth: 120 }}><strong>DOB:</strong> {s.dob || '-'}</div>}
                    {printCols.age && <div style={{ minWidth: 120 }}><strong>Age:</strong> {age}</div>}
                    {printCols.medical_info && <div style={{ minWidth: 120 }}><strong>Medical:</strong> {s.medical_info || '-'}</div>}
                    {printCols.father_name && <div style={{ minWidth: 120 }}><strong>Father:</strong> {p?.father_name || '-'}</div>}
                    {printCols.father_cnic && <div style={{ minWidth: 120 }}><strong>F. CNIC:</strong> {p?.father_cnic || '-'}</div>}
                    {printCols.father_contact && <div style={{ minWidth: 120 }}><strong>F. Contact:</strong> {p?.father_contact || '-'}</div>}
                    {printCols.father_occupation && <div style={{ minWidth: 120 }}><strong>F. Occup:</strong> {p?.father_occupation || '-'}</div>}
                    {printCols.address && <div style={{ minWidth: 180 }}><strong>Address:</strong> {s?.address || '-'}</div>}
                    {printCols.mother_name && <div style={{ minWidth: 120 }}><strong>Mother:</strong> {p?.mother_name || '-'}</div>}
                    {printCols.mother_cnic && <div style={{ minWidth: 120 }}><strong>M. CNIC:</strong> {p?.mother_cnic || '-'}</div>}
                    {printCols.mother_contact && <div style={{ minWidth: 120 }}><strong>M. Contact:</strong> {p?.mother_contact || '-'}</div>}
                    {printCols.monthly_fee && <div style={{ minWidth: 120 }}><strong>Fee:</strong> Rs. {Number(s.monthly_fee || 0).toLocaleString()}</div>}
                    {printCols.fee_start_month && <div style={{ minWidth: 120 }}><strong>Fee Start:</strong> {s.fee_start_month || '-'}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Print Footer */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            <span>Total: {filtered.length} | Active: {activeCount} | Left: {leftCount} | Male: {maleCount} | Female: {femaleCount}</span>
            <span>{getSettings().school_name} — Confidential Report</span>
            <span>Printed: {format(new Date(), 'dd/MM/yyyy')} {format(new Date(), 'hh:mm a')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
