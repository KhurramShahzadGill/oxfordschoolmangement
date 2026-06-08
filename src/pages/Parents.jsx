import React, { useState, useEffect } from 'react';
import { apiParents, apiStudents } from '../services/db';
import { Edit2, Search as SearchIcon, Users } from 'lucide-react';
import { formatCnic, formatMobile } from '../utils/formatters';

export default function Parents() {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParent, setExpandedParent] = useState(null);
  const [parentStudents, setParentStudents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadParents = async (query = '') => {
    setLoading(true);
    const data = query ? await apiParents.search(query) : await apiParents.getAll();
    setParents(data);
    setLoading(false);
  };

  useEffect(() => { loadParents(); }, []);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    loadParents(e.target.value);
  };

  const toggleExpand = async (parentId) => {
    if (expandedParent === parentId) {
      setExpandedParent(null);
      return;
    }
    setExpandedParent(parentId);
    const students = await apiStudents.getByParentId(parentId);
    setParentStudents(students);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ ...p });
  };

  const saveEdit = async () => {
    await apiParents.update(editingId, editForm);
    setEditingId(null);
    loadParents(searchQuery);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="text-2xl font-bold">Parent Management</h1>
        <span className="text-sm text-secondary-color">Parents are created automatically during student admission</span>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div style={{ position: 'relative' }}>
          <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-secondary)' }} />
          <input className="form-input" style={{ paddingLeft: 42 }}
            placeholder="Search by CNIC, Father Name, or Mother Name..."
            value={searchQuery} onChange={handleSearch} />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <p style={{ padding: 24, textAlign: 'center' }}>Loading...</p> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>CNIC (ID)</th><th>Father Name</th><th>Mother Name</th><th>Contact</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {parents.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No parent records found.</td></tr>
                ) : parents.map(p => (
                  <React.Fragment key={p.id}>
                    {editingId === p.id ? (
                      <tr>
                        <td colSpan="5" style={{ padding: 16 }}>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="form-group"><label className="form-label">Father Name</label>
                              <input className="form-input" value={editForm.father_name || ''} onChange={e => setEditForm({...editForm, father_name: e.target.value})} /></div>
                            <div className="form-group"><label className="form-label">Father CNIC</label>
                              <input className="form-input" value={editForm.father_cnic || ''} onChange={e => setEditForm({...editForm, father_cnic: formatCnic(e.target.value)})} maxLength={15} /></div>
                            <div className="form-group"><label className="form-label">Father Occupation</label>
                              <input className="form-input" value={editForm.father_occupation || ''} onChange={e => setEditForm({...editForm, father_occupation: e.target.value})} /></div>
                            <div className="form-group"><label className="form-label">Father Contact</label>
                              <input className="form-input" value={editForm.father_contact || ''} onChange={e => setEditForm({...editForm, father_contact: formatMobile(e.target.value)})} maxLength={12} /></div>
                            <div className="form-group"><label className="form-label">Mother Name</label>
                              <input className="form-input" value={editForm.mother_name || ''} onChange={e => setEditForm({...editForm, mother_name: e.target.value})} /></div>
                            <div className="form-group"><label className="form-label">Mother CNIC</label>
                              <input className="form-input" value={editForm.mother_cnic || ''} onChange={e => setEditForm({...editForm, mother_cnic: formatCnic(e.target.value)})} maxLength={15} /></div>
                            <div className="form-group"><label className="form-label">Mother Contact</label>
                              <input className="form-input" value={editForm.mother_contact || ''} onChange={e => setEditForm({...editForm, mother_contact: formatMobile(e.target.value)})} maxLength={12} /></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td className="text-sm font-medium">{p.father_cnic}</td>
                          <td className="font-medium">{p.father_name}</td>
                          <td>{p.mother_name || '-'}</td>
                          <td>{p.father_contact || p.mother_contact || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => toggleExpand(p.id)} className="badge badge-primary" style={{ border: 'none', cursor: 'pointer', marginRight: 10 }}>
                              <Users size={12} style={{ marginRight: 4 }}/> Children
                            </button>
                            <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                          </td>
                        </tr>
                        {expandedParent === p.id && (
                          <tr style={{ backgroundColor: 'var(--bg-primary)' }}>
                            <td colSpan="5" style={{ padding: '12px 32px' }}>
                              <h4 className="text-sm font-semibold mb-2">Linked Students</h4>
                              {parentStudents.length === 0 ? (
                                <p className="text-sm text-secondary-color">No children enrolled.</p>
                              ) : parentStudents.map(s => (
                                <div key={s.id} style={{ display: 'flex', gap: 16, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-secondary-color">ID: {s.id}</span>
                                  <span className="text-secondary-color">Admission No: {s.roll_no}</span>
                                  <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
