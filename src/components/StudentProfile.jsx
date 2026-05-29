import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections, apiStudentHistory, apiParents } from '../services/db';
import { differenceInYears, parseISO } from 'date-fns';
import { ArrowUpRight, History, X, IdCard } from 'lucide-react';
import StudentCard from './StudentCard';

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
  const [printProfile, setPrintProfile] = useState(false);
  
  // Section visibility toggles
  const [showBasicInfo, setShowBasicInfo] = useState(true);
  const [showParentInfo, setShowParentInfo] = useState(true);
  const [showHistoryInfo, setShowHistoryInfo] = useState(true);
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  // ... (existing load and effects)
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

  const handlePrintProfile = () => {
    setPrintProfile(true);
    setTimeout(() => window.print(), 150);
    setTimeout(() => setPrintProfile(false), 500);
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
            <div><strong>Date of Birth:</strong> {student.dob || '-'}</div>
            <div><strong>Age:</strong> {age} years</div>
            <div><strong>Gender:</strong> {student.gender}</div>
            <div><strong>Admission Date:</strong> {student.admission_date || '-'}</div>
            <div><strong>Monthly Fee:</strong> Rs. {student.monthly_fee}</div>
            <div><strong>Status:</strong> {student.status}</div>
            {student.leaving_date && <div><strong>Leaving Date:</strong> {student.leaving_date}</div>}
            {student.medical_info && <div><strong>Medical Info:</strong> {student.medical_info}</div>}
            {student.address && <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {student.address}</div>}
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => setShowPrintOptions(!showPrintOptions)}>
                Print Options
              </button>
              {showPrintOptions && (
                <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, background: 'white', padding: 16, borderRadius: 12, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', width: 250, zIndex: 10 }}>
                  <h4 className="font-semibold text-sm mb-3">Select Print Information</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={showBasicInfo} onChange={e => setShowBasicInfo(e.target.checked)} /> Basic Information
                  </label>
                  {parent && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={showParentInfo} onChange={e => setShowParentInfo(e.target.checked)} /> Parent Information
                    </label>
                  )}
                  {history.length > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={showHistoryInfo} onChange={e => setShowHistoryInfo(e.target.checked)} /> Promotion History
                    </label>
                  )}
                  <button className="btn btn-primary" style={{ width: '100%', padding: '6px 0', fontSize: '0.85rem' }} onClick={() => { setShowPrintOptions(false); handlePrintProfile(); }}>
                    Print Profile
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={handlePrint}><IdCard size={14} /> Print ID Card</button>
          </div>
        </div>
      </div>

      {/* Print Only: Student ID Card */}
      {printCard && (
        <div className="print-only" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <StudentCard 
            student={student} 
            parent={parent} 
            className={cls?.class_name} 
            sectionName={curSec?.section_name} 
          />
        </div>
      )}

      {/* Print Only: Student Profile */}
      {printProfile && (
        <div className="print-only" style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #4318FF', paddingBottom: '20px', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '28px', color: '#4318FF', margin: 0 }}>Student Profile Report</h1>
            <p style={{ color: '#666', marginTop: '5px' }}>Oxford Grammar School</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '30px' }}>
             {student.picture && (
                <img src={student.picture} alt={student.name} style={{ width: '100px', height: '100px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #4318FF' }} />
             )}
             <div>
                <h2 style={{ fontSize: '24px', margin: '0 0 5px 0' }}>{student.name}</h2>
                <div style={{ fontSize: '16px', color: '#555' }}>
                  <strong>ID:</strong> {student.id} &nbsp;|&nbsp; <strong>Roll No:</strong> {student.roll_no} &nbsp;|&nbsp; <strong>Class:</strong> {cls?.class_name || '-'} - {curSec?.section_name || '-'}
                </div>
             </div>
          </div>

          {showBasicInfo && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '18px', color: '#4318FF', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>Basic Information</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 0', width: '25%', fontWeight: 'bold' }}>Date of Birth:</td>
                    <td style={{ padding: '8px 0', width: '25%' }}>{student.dob || '-'}</td>
                    <td style={{ padding: '8px 0', width: '25%', fontWeight: 'bold' }}>Age:</td>
                    <td style={{ padding: '8px 0', width: '25%' }}>{age} years</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Gender:</td>
                    <td style={{ padding: '8px 0' }}>{student.gender}</td>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Status:</td>
                    <td style={{ padding: '8px 0' }}>{student.status}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Admission Date:</td>
                    <td style={{ padding: '8px 0' }}>{student.admission_date || '-'}</td>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Monthly Fee:</td>
                    <td style={{ padding: '8px 0' }}>Rs. {student.monthly_fee}</td>
                  </tr>
                  {(student.leaving_date || student.medical_info) && (
                    <tr>
                      <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{student.leaving_date ? 'Leaving Date:' : ''}</td>
                      <td style={{ padding: '8px 0' }}>{student.leaving_date || ''}</td>
                      <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{student.medical_info ? 'Medical Info:' : ''}</td>
                      <td style={{ padding: '8px 0' }}>{student.medical_info || ''}</td>
                    </tr>
                  )}
                  {student.address && (
                    <tr>
                      <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Address:</td>
                      <td colSpan="3" style={{ padding: '8px 0' }}>{student.address}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showParentInfo && parent && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '18px', color: '#4318FF', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>Parent Information</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 0', width: '25%', fontWeight: 'bold' }}>Father's Name:</td>
                    <td style={{ padding: '8px 0', width: '25%' }}>{parent.father_name}</td>
                    <td style={{ padding: '8px 0', width: '25%', fontWeight: 'bold' }}>Father's CNIC:</td>
                    <td style={{ padding: '8px 0', width: '25%' }}>{parent.father_cnic}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Occupation:</td>
                    <td style={{ padding: '8px 0' }}>{parent.father_occupation || '-'}</td>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Contact:</td>
                    <td style={{ padding: '8px 0' }}>{parent.father_contact || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Mother's Name:</td>
                    <td style={{ padding: '8px 0' }}>{parent.mother_name || '-'}</td>
                    <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Mother's Contact:</td>
                    <td style={{ padding: '8px 0' }}>{parent.mother_contact || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {showHistoryInfo && history.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '18px', color: '#4318FF', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>Promotion History</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4' }}>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Date</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>From Class</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>To Class</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{h.date}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{getClassName(h.from_class_id)} ({getSectionName(h.from_section_id)})</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{getClassName(h.to_class_id)} ({getSectionName(h.to_section_id)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div style={{ marginTop: '50px', textAlign: 'center', fontSize: '12px', color: '#888' }}>
            Report generated on {new Date().toLocaleDateString()}
          </div>
        </div>
      )}
    </>
  );
}
