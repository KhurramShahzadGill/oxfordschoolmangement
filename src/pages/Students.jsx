import React, { useState, useEffect } from 'react';
import { apiStudents, apiParents, apiClasses, apiSections } from '../services/db';
import { Plus, Edit2, Trash2, Search as SearchIcon, Eye, Filter } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';
import StudentForm from '../components/StudentForm';
import StudentProfile from '../components/StudentProfile';

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
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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
    return true;
  });

  const filterSections = sections.filter(s => s.class_id === filterClass);

  // Summary stats
  const activeCount = filtered.filter(s => s.status === 'Active').length;
  const leftCount = filtered.filter(s => s.status === 'Left').length;
  const maleCount = filtered.filter(s => s.gender === 'Male').length;
  const femaleCount = filtered.filter(s => s.gender === 'Female').length;

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditData(null); }}>
            <Plus size={16} /> New Admission
          </button>
        </div>

        {showForm && (
          <StudentForm
            initial={editData}
            parents={parents}
            isEdit={!!editData}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditData(null); }}
          />
        )}

        {/* Search & Filters */}
        <div className="card mb-6">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, position: 'relative', minWidth: 200 }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-secondary)' }} />
              <input className="form-input" style={{ paddingLeft: 42, padding: '10px 14px 10px 42px' }}
                placeholder="Search by ID, Roll No, or Name..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="form-select" style={{ flex: 1, minWidth: 120, padding: '10px 14px' }} value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, minWidth: 120, padding: '10px 14px' }} value={filterSection}
              onChange={e => setFilterSection(e.target.value)} disabled={!filterClass}>
              <option value="">All Sections</option>
              {filterSections.map(s => <option key={s.id} value={s.id}>Section {s.section_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, minWidth: 120, padding: '10px 14px' }} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Left">Left</option>
            </select>
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
                    <th>ID</th><th>Roll No</th><th>Name</th><th>Class</th><th>Section</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
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
                            {s.picture && <img src={s.picture} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />}
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
    </div>
  );
}
