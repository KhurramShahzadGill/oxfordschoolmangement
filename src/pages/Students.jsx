import React, { useState, useEffect } from 'react';
import { apiStudents, apiParents, apiClasses, apiSections } from '../services/db';
import { Plus, Edit2, Trash2, Search as SearchIcon, Eye, FileSpreadsheet, Printer, X } from 'lucide-react';
import { differenceInYears, parseISO, format } from 'date-fns';
import StudentForm from '../components/StudentForm';
import StudentProfile from '../components/StudentProfile';
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
              PDF print aur Excel export ke liye columns chunein
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
            <span>{selectedCount} column{selectedCount !== 1 ? 's' : ''} export ke liye selected hain</span>
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
  const [parentSearch, setParentSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [ageFrom, setAgeFrom] = useState('');
  const [ageTo, setAgeTo] = useState('');

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
    const parentData = {
      father_name: form.father_name, father_cnic: form.father_cnic,
      father_occupation: form.father_occupation, father_contact: form.father_contact,
      mother_name: form.mother_name, mother_cnic: form.mother_cnic, mother_contact: form.mother_contact,
    };
    const { parent } = await apiParents.createOrGet(parentData);

    const studentData = {
      id: form.id, roll_no: form.roll_no, name: form.name, dob: form.dob,
      gender: form.gender, admission_date: form.admission_date, leaving_date: form.leaving_date,
      medical_info: form.medical_info, monthly_fee: form.monthly_fee, fee_start_month: form.fee_start_month,
      admission_fee: form.admission_fee, security_fee: form.security_fee, paper_fund: form.paper_fund,
      stationery_fee: form.stationery_fee, other_fee: form.other_fee,
      address: form.address,
      picture: form.picture, status: form.status, parent_id: parent.id, class_id: form.class_id, section_id: form.section_id,
    };

    try {
      if (editData) {
        await apiStudents.update(editData.id, studentData);
      } else {
        await apiStudents.create(studentData);
      }
      setShowForm(false); setEditData(null); loadData();
    } catch (err) {
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
    if (window.confirm('Are you sure you want to delete this student?')) {
      await apiStudents.delete(id);
      loadData();
    }
  };

  // Filtering logic
  const filtered = students.filter(s => {
    if (filterClass && s.class_id !== filterClass) return false;
    if (filterSection && s.section_id !== filterSection) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q))) return false;
    }
    if (parentSearch) {
      const p = parents.find(pr => pr.id === s.parent_id);
      if (!p) return false;
      const q = parentSearch.toLowerCase().replace(/-/g, '');
      if (!((p.father_cnic || '').replace(/-/g, '').includes(q) || (p.mother_cnic || '').replace(/-/g, '').includes(q) || (p.father_name || '').toLowerCase().includes(parentSearch.toLowerCase()) || (p.mother_name || '').toLowerCase().includes(parentSearch.toLowerCase()))) return false;
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
    if (filtered.length === 0) { alert('Export karne ke liye koi student nahi mila.'); return; }
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
    if (Object.keys(rows[0] || {}).length === 0) { alert('Kam az kam ek column zaroor chunein.'); return; }
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

  const thStyle = { padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.03em', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)' };
  const tdStyle = { padding: '5px 8px', fontSize: 10, wordBreak: 'break-word', overflowWrap: 'break-word', borderRight: '1px solid #e2e8f0', verticalAlign: 'top', lineHeight: 1.4 };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Single Export button opens the modal */}
            <button
              onClick={() => setShowExportModal(true)}
              title="PDF print ya Excel export ke liye columns chunein"
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
            isEdit={!!editData}
            nextId={(() => {
              const numericIds = students.map(s => parseInt(s.id)).filter(id => !isNaN(id));
              return numericIds.length > 0 ? Math.max(...numericIds) + 1 : students.length + 1;
            })()}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditData(null); }}
          />
        )}

        {/* Search & Filters */}
        <div className="card mb-6" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: 10, color: 'var(--text-secondary)' }} />
              <input className="form-input" style={{ paddingLeft: 42, width: '100%', padding: '10px 14px 10px 42px' }}
                placeholder="Search by Student ID, Admission No, or Name..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div style={{ position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: 10, color: 'var(--text-secondary)' }} />
              <input className="form-input" style={{ paddingLeft: 42, width: '100%', padding: '10px 14px 10px 42px' }}
                placeholder="Search by Parent Name or CNIC..."
                value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
            </div>
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

        {/* Students Table */}
        <div className="card">
          {loading ? <p style={{ padding: 24, textAlign: 'center' }}>Loading...</p> : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Admission No</th><th>Name</th><th>Class</th><th>Section</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No students found.</td></tr>
                  ) : filtered.map(s => {
                    const c = classes.find(cl => cl.id === s.class_id);
                    const sec = sections.find(sc => sc.id === s.section_id);
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

      {/* ═══════════════════════════════════════════
          PRINT-ONLY: Professional Student List
          ═══════════════════════════════════════════ */}
      {printStudentList && (
        <div className="print-only">
          {/* Report Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #4318FF', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4318FF', letterSpacing: '-0.02em' }}>Oxford Grammar School</div>
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
            <span>Oxford Grammar School — Confidential Report</span>
            <span>Printed: {format(new Date(), 'dd/MM/yyyy')} {format(new Date(), 'hh:mm a')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
