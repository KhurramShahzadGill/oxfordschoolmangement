import React, { useState, useEffect } from 'react';
import { apiParents, apiStudents } from '../services/db';
import { Edit2, Trash2, Users } from 'lucide-react';
import { formatCnic, formatMobile, validateCnic, validateMobile } from '../utils/formatters';
import ParentSearch from '../components/ParentSearch';

export default function Parents() {
  const [parents, setParents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParent, setSelectedParent] = useState(null);
  const [expandedParent, setExpandedParent] = useState(null);
  const [parentStudents, setParentStudents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadAll = async () => {
    setLoading(true);
    const [pData, sData] = await Promise.all([apiParents.getAll(), apiStudents.getAll()]);
    setParents(pData);
    setAllStudents(sData);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSelectParent = async (p) => {
    setSelectedParent(p);
    setExpandedParent(p.id);
    const students = await apiStudents.getByParentId(p.id);
    setParentStudents(students);
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
    const checks = [
      [editForm.father_cnic,    validateCnic,   "Father's CNIC must be complete: 00000-0000000-0"],
      [editForm.mother_cnic,    validateCnic,   "Mother's CNIC must be complete: 00000-0000000-0"],
      [editForm.father_contact, validateMobile, "Father's Contact must be complete: 0000-0000000"],
      [editForm.mother_contact, validateMobile, "Mother's Contact must be complete: 0000-0000000"],
    ];
    for (const [value, validate, message] of checks) {
      if (value && !validate(value)) { alert(message); return; }
    }
    await apiParents.update(editingId, editForm);
    setEditingId(null);
    loadAll();
  };

  // Delete a parent along with all of their linked student records
  const handleDeleteParent = async (p) => {
    const children = await apiStudents.getByParentId(p.id);
    const who = p.father_name || p.father_cnic || 'this parent';
    const message = children.length > 0
      ? `This will permanently delete parent "${who}" AND all ${children.length} linked student record(s). This action cannot be undone. Continue?`
      : `Delete parent "${who}"? This action cannot be undone.`;
    if (!window.confirm(message)) return;

    for (const s of children) {
      await apiStudents.delete(s.id);
    }
    await apiParents.delete(p.id);

    if (expandedParent === p.id) setExpandedParent(null);
    if (selectedParent?.id === p.id) setSelectedParent(null);
    loadAll();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="text-2xl font-bold">Parent Management</h1>
        <span className="text-sm text-secondary-color">Parents are created automatically during student admission</span>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <ParentSearch
          parents={parents}
          students={allStudents}
          selected={selectedParent}
          onSelect={handleSelectParent}
          onClear={() => { setSelectedParent(null); setExpandedParent(null); }}
          placeholder="Search by Parent or any Child name (or CNIC / Contact / ID)..."
        />
      </div>

      {/* Table */}
      <div className="card">
        {selectedParent && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Showing 1 selected parent. Their enrolled children are listed below.</span>
            <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedParent(null); setExpandedParent(null); }}>Show all parents</button>
          </div>
        )}
        {loading ? <p style={{ padding: 24, textAlign: 'center' }}>Loading...</p> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>CNIC (ID)</th><th>Father Name</th><th>Mother Name</th><th>Contact</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {(() => { const displayParents = selectedParent ? parents.filter(p => p.id === selectedParent.id) : parents; return displayParents.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No parent records found.</td></tr>
                ) : displayParents.map(p => (
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
                            <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: 8 }}><Edit2 size={16} /></button>
                            <button onClick={() => handleDeleteParent(p)} title="Delete parent and all linked students" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={16} /></button>
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
                )); })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
