import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections, apiStudentHistory, apiParents } from '../services/db';
import { differenceInYears, parseISO } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, History, X, Printer, IdCard } from 'lucide-react';

export default function StudentProfile({ studentId, onClose, onUpdate }) {
  const [student, setStudent] = useState(null);
  const [parent, setParent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [history, setHistory] = useState([]);
  const [showPromotion, setShowPromotion] = useState(false);
  const [promoClass, setPromoClass] = useState('');
  const [promoSection, setPromoSection] = useState('');
  const [printCard, setPrintCard] = useState(false);

  const load = async () => {
    const [s, cList, sList, h] = await Promise.all([
      apiStudents.getById(studentId),
      apiClasses.getAll(),
      apiSections.getAll(),
      apiStudentHistory.getByStudentId(studentId)
    ]);
    setStudent(s);
    setClasses(cList);
    setSections(sList);
    setHistory(h);
    if (s?.parent_id) {
      const p = await apiParents.getById(s.parent_id);
      setParent(p);
    }
  };

  useEffect(() => { load(); }, [studentId]);

  if (!student) return null;

  const cls = classes.find(c => c.id === student.class_id);
  const sec = sections.filter(s => s.class_id === student.class_id);
  const curSec = sections.find(s => s.id === student.section_id);
  const age = student.dob ? differenceInYears(new Date(), parseISO(student.dob)) : '-';
  const promoSections = sections.filter(s => s.class_id === promoClass);

  const handlePromote = async () => {
    if (!promoClass || !promoSection) return alert('Select class and section');
    await apiStudents.promote(student.id, promoClass, promoSection);
    setShowPromotion(false);
    load();
    if (onUpdate) onUpdate();
  };

  const handlePrint = () => {
    setPrintCard(true);
    setTimeout(() => window.print(), 150);
    setTimeout(() => setPrintCard(false), 500);
  };

  const getClassName = (id) => classes.find(c => c.id === id)?.class_name || '-';
  const getSectionName = (id) => sections.find(s => s.id === id)?.section_name || '-';

  return (
    <>
      {/* Modal Overlay */}
      <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 700, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>

          {/* Header */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', border: '3px solid var(--primary)', flexShrink: 0 }}>
              {student.picture ? (
                <img src={student.picture} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 'bold', color: 'var(--primary)' }}>
                  {student.name?.charAt(0)}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h2 className="text-xl font-bold">{student.name}</h2>
              <p className="text-sm text-secondary-color">ID: {student.id} &bull; Roll No: {student.roll_no}</p>
              <p className="text-sm">{cls?.class_name || '-'} - Section {curSec?.section_name || '-'}</p>
            </div>
            <span className={`badge ${student.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{student.status}</span>
          </div>

          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: '0.85rem' }}>
            <div><strong>Age:</strong> {age} years</div>
            <div><strong>Gender:</strong> {student.gender}</div>
            <div><strong>Admission:</strong> {student.admission_date}</div>
            <div><strong>Monthly Fee:</strong> Rs. {student.monthly_fee}</div>
            {student.leaving_date && <div><strong>Leaving Date:</strong> {student.leaving_date}</div>}
            {student.medical_info && <div style={{ gridColumn: 'span 2' }}><strong>Medical:</strong> {student.medical_info}</div>}
          </div>

          {/* Parent Info */}
          {parent && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Parent Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem', background: 'var(--bg-primary)', padding: 16, borderRadius: 12 }}>
                <div><strong>Father:</strong> {parent.father_name}</div>
                <div><strong>CNIC:</strong> {parent.father_cnic}</div>
                <div><strong>Occupation:</strong> {parent.father_occupation || '-'}</div>
                <div><strong>Contact:</strong> {parent.father_contact || '-'}</div>
                <div><strong>Mother:</strong> {parent.mother_name || '-'}</div>
                <div><strong>Contact:</strong> {parent.mother_contact || '-'}</div>
              </div>
            </div>
          )}

          {/* Promotion */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Class Promotion</h3>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setShowPromotion(!showPromotion)}>
                <ArrowUpRight size={14} /> Promote
              </button>
            </div>
            {showPromotion && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label text-xs">New Class</label>
                  <select className="form-select" style={{ padding: '8px 10px', fontSize: '0.85rem' }} value={promoClass} onChange={e => { setPromoClass(e.target.value); setPromoSection(''); }}>
                    <option value="">Select</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label text-xs">New Section</label>
                  <select className="form-select" style={{ padding: '8px 10px', fontSize: '0.85rem' }} value={promoSection} onChange={e => setPromoSection(e.target.value)}>
                    <option value="">Select</option>
                    {promoSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={handlePromote}>Confirm</button>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase' }}><History size={14} style={{ display: 'inline', marginRight: 4 }} /> Promotion History</h3>
              {history.map(h => (
                <div key={h.id} style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getClassName(h.from_class_id)} ({getSectionName(h.from_section_id)}) → {getClassName(h.to_class_id)} ({getSectionName(h.to_section_id)})</span>
                  <span className="text-secondary-color">{h.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={handlePrint}><IdCard size={14} /> Print ID Card</button>
          </div>
        </div>
      </div>

      {/* Print Only: Student ID Card */}
      {printCard && (
        <div className="print-only" style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '54mm', height: '86mm', border: '2px solid #1e293b', borderRadius: 12, overflow: 'hidden', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div style={{ background: '#4318FF', color: 'white', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>Oxford Grammar School</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px 8px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #4318FF', overflow: 'hidden', marginBottom: 10 }}>
                {student.picture ? <img src={student.picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>{student.name}</div>
              <div style={{ fontSize: 9, color: '#4318FF', fontWeight: 600 }}>STUDENT</div>
            </div>
            <div style={{ padding: '0 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 9 }}>
              <div style={{ marginBottom: 4 }}><strong>ID:</strong> {student.id}</div>
              <div style={{ marginBottom: 4 }}><strong>Class:</strong> {cls?.class_name} - {curSec?.section_name}</div>
              <div><strong>Parent:</strong> {parent?.father_name || '-'}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 10, display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0' }}>
              <QRCodeSVG value={`STUDENT:${student.id}`} size={44} level="M" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
