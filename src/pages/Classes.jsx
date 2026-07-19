import React, { useState, useEffect } from 'react';
import { apiClasses, apiSections, apiStudents } from '../services/db';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Class Form
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm] = useState({ class_name: '' });
  const [editingClassId, setEditingClassId] = useState(null);

  // Section Form
  const [showSectionForm, setShowSectionForm] = useState(null); // class_id or null
  const [sectionForm, setSectionForm] = useState({ section_name: '' });
  const [editingSectionId, setEditingSectionId] = useState(null);

  // Expanded class rows
  const [expandedClass, setExpandedClass] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [cData, sData] = await Promise.all([
      apiClasses.getAll(),
      apiSections.getAll()
    ]);
    setClasses(cData);
    setSections(sData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ===== Class CRUD =====
  const handleClassSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClassId) {
        await apiClasses.update(editingClassId, classForm);
      } else {
        await apiClasses.create(classForm);
      }
      setClassForm({ class_name: '' });
      setEditingClassId(null);
      setShowClassForm(false);
      loadData();
    } catch (err) {
      alert('Could not save the class:\n\n' + err.message);
    }
  };

  const handleEditClass = (c) => {
    setClassForm({ class_name: c.class_name });
    setEditingClassId(c.id);
    setShowClassForm(true);
  };

  const handleDeleteClass = async (id) => {
    // Block deletion while students are still enrolled, otherwise they become orphaned
    const students = await apiStudents.getAll();
    const enrolled = students.filter(s => s.class_id === id);
    if (enrolled.length > 0) {
      alert(`Cannot delete this class: ${enrolled.length} student(s) are enrolled in it.\n\nPlease move or delete those students first.`);
      return;
    }
    if (window.confirm('Are you sure? This will also delete all sections under this class.')) {
      await apiClasses.delete(id);
      loadData();
    }
  };

  // ===== Section CRUD =====
  const handleSectionSubmit = async (e, classId) => {
    e.preventDefault();
    try {
      if (editingSectionId) {
        await apiSections.update(editingSectionId, { ...sectionForm, class_id: classId });
      } else {
        await apiSections.create({ ...sectionForm, class_id: classId });
      }
      setSectionForm({ section_name: '' });
      setEditingSectionId(null);
      setShowSectionForm(null);
      loadData();
    } catch (err) {
      alert('Could not save the section:\n\n' + err.message);
    }
  };

  const handleEditSection = (s) => {
    setSectionForm({ section_name: s.section_name });
    setEditingSectionId(s.id);
    setShowSectionForm(s.class_id);
  };

  const handleDeleteSection = async (id) => {
    const students = await apiStudents.getAll();
    const enrolled = students.filter(s => s.section_id === id);
    if (enrolled.length > 0) {
      alert(`Cannot delete this section: ${enrolled.length} student(s) are enrolled in it.\n\nPlease move or delete those students first.`);
      return;
    }
    if (window.confirm('Delete this section?')) {
      await apiSections.delete(id);
      loadData();
    }
  };

  // ===== Drag & drop ordering =====
  // Classes keep the order the school arranged them in, so a class added later
  // (Play Group, for example) can still sit at the top.
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDrop = async (targetId) => {
    const fromId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!fromId || fromId === targetId) return;

    const ids = classes.map(c => c.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // Show the new order straight away, then save it.
    setClasses(ids.map(id => classes.find(c => c.id === id)));
    try {
      await apiClasses.reorder(ids);
      loadData();
    } catch (err) {
      alert('Could not save the new order:\n\n' + err.message);
      loadData();
    }
  };

  const toggleExpand = (classId) => {
    setExpandedClass(expandedClass === classId ? null : classId);
    setShowSectionForm(null);
    setEditingSectionId(null);
    setSectionForm({ section_name: '' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="text-2xl font-bold">Class & Section Management</h1>
        <button className="btn btn-primary" onClick={() => { setShowClassForm(!showClassForm); setEditingClassId(null); setClassForm({ class_name: '' }); }}>
          <Plus size={16} /> Add Class
        </button>
      </div>
      <p className="text-xs text-secondary-color" style={{ marginBottom: 24 }}>
        Classes stay in the order you arrange them — drag <span style={{ fontSize: 14 }}>⠿</span> to move a class up or down.
      </p>

      {/* Add/Edit Class Form */}
      {showClassForm && (
        <div className="card mb-6" style={{ animation: 'fadeIn 0.2s ease' }}>
          <h2 className="text-lg font-semibold mb-4">{editingClassId ? 'Edit Class' : 'Add New Class'}</h2>
          <form onSubmit={handleClassSubmit} style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Class Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={classForm.class_name}
                onChange={e => setClassForm({ class_name: e.target.value })}
                placeholder="e.g. Class 1, Nursery, Prep"
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowClassForm(false); setEditingClassId(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingClassId ? 'Update' : 'Save'}</button>
          </form>
        </div>
      )}

      {/* Classes List */}
      <div className="card">
        {loading ? (
          <p className="text-secondary-color" style={{ padding: 24, textAlign: 'center' }}>Loading classes...</p>
        ) : classes.length === 0 ? (
          <p className="text-secondary-color" style={{ padding: 24, textAlign: 'center' }}>No classes found. Add one to get started.</p>
        ) : (
          <div>
            {classes.map(c => {
              const classSections = sections.filter(s => s.class_id === c.id);
              const isExpanded = expandedClass === c.id;

              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={e => { e.preventDefault(); if (dragOverId !== c.id) setDragOverId(c.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => handleDrop(c.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    borderTop: dragOverId === c.id && dragId !== c.id ? '2px solid var(--primary)' : '2px solid transparent',
                    opacity: dragId === c.id ? 0.5 : 1,
                    background: dragOverId === c.id && dragId !== c.id ? 'var(--bg-primary)' : 'transparent',
                  }}
                >
                  {/* Class Row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onClick={() => toggleExpand(c.id)}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1 }}>⠿</span>
                      {isExpanded ? <ChevronDown size={18} color="var(--primary)" /> : <ChevronRight size={18} color="var(--text-secondary)" />}
                      <span className="font-semibold">{c.class_name}</span>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                        {classSections.length} Section{classSections.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEditClass(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }} title="Edit Class">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteClass(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }} title="Delete Class">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Sections */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px 48px', animation: 'fadeIn 0.2s ease' }}>
                      {/* Sections List */}
                      {classSections.length > 0 ? (
                        <div style={{ marginBottom: 16 }}>
                          {classSections.map(s => (
                            <div key={s.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                              marginBottom: 6
                            }}>
                              <span className="font-medium text-sm">Section {s.section_name}</span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleEditSection(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteSection(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-secondary-color mb-4">No sections added yet.</p>
                      )}

                      {/* Add/Edit Section Form */}
                      {showSectionForm === c.id ? (
                        <form onSubmit={(e) => handleSectionSubmit(e, c.id)} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label text-xs">Section Name</label>
                            <input
                              type="text"
                              className="form-input"
                              required
                              value={sectionForm.section_name}
                              onChange={e => setSectionForm({ section_name: e.target.value })}
                              placeholder="e.g. A, B, C"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                            />
                          </div>
                          <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }} onClick={() => { setShowSectionForm(null); setEditingSectionId(null); }}>Cancel</button>
                          <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{editingSectionId ? 'Update' : 'Add'}</button>
                        </form>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                          onClick={() => { setShowSectionForm(c.id); setEditingSectionId(null); setSectionForm({ section_name: '' }); }}
                        >
                          <Plus size={14} /> Add Section
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
