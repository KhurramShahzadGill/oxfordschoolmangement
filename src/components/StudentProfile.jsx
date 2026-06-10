import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections, apiStudentHistory, apiParents, apiFees, apiCustomCharges, getSettings } from '../services/db';
import { differenceInYears, parseISO, format } from 'date-fns';
import { formatDate } from '../utils/formatters';
import { ArrowUpRight, History, X, IdCard } from 'lucide-react';
import StudentCard from './StudentCard';

export default function StudentProfile({ studentId, onClose, onUpdate }) {
  const [student, setStudent] = useState(null);
  const [parent, setParent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [history, setHistory] = useState([]);
  const [fees, setFees] = useState([]);
  const [charges, setCharges] = useState([]);
  const [showPromotion, setShowPromotion] = useState(false);
  const [promoClass, setPromoClass] = useState('');
  const [promoSection, setPromoSection] = useState('');
  const [printCard, setPrintCard] = useState(false);
  const [printProfile, setPrintProfile] = useState(false);
  
  // Section visibility toggles
  const [showBasicInfo, setShowBasicInfo] = useState(true);
  const [showParentInfo, setShowParentInfo] = useState(true);
  const [showFeeInfo, setShowFeeInfo] = useState(true);
  const [showHistoryInfo, setShowHistoryInfo] = useState(true);
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  // ... (existing load and effects)
  const load = async () => {
    const [s, cList, sList, h, fList, ccList] = await Promise.all([
      apiStudents.getById(studentId),
      apiClasses.getAll(),
      apiSections.getAll(),
      apiStudentHistory.getByStudentId(studentId),
      apiFees.getByStudentId(studentId),
      apiCustomCharges.getByStudentId(studentId),
    ]);
    setStudent(s);
    setClasses(cList);
    setSections(sList);
    setHistory(h);
    setFees(fList);
    setCharges(ccList);
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

  // ── Fee summary (paid / outstanding) ──
  const fmtMon = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };
  const nextMon = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
  const curMon = format(new Date(), 'yyyy-MM');
  const feeSummary = (() => {
    let totalDue = 0, totalPaid = 0;
    const outstanding = [];
    if (student.fee_start_month) {
      let m = student.fee_start_month;
      let guard = 0;
      while (m <= curMon && guard < 600) {
        const rec = fees.find(f => f.month === m);
        const due = Number(rec?.monthly_fee ?? student.monthly_fee ?? 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
        const paid = Number(rec?.amount_paid || 0);
        totalDue += due; totalPaid += paid;
        if (due - paid > 0) outstanding.push({ label: `Monthly Fee — ${fmtMon(m)}`, amount: due - paid });
        m = nextMon(m); guard++;
      }
    }
    charges.forEach(c => {
      totalDue += Number(c.amount || 0); totalPaid += Number(c.amount_paid || 0);
      const bal = Number(c.amount || 0) - Number(c.amount_paid || 0);
      if (bal > 0) outstanding.push({ label: c.title, amount: bal });
    });
    return { totalDue, totalPaid, outstanding, totalOutstanding: Math.max(0, totalDue - totalPaid) };
  })();
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
    document.body.classList.add('print-mode');
    setTimeout(() => window.print(), 150);
    setTimeout(() => { setPrintCard(false); document.body.classList.remove('print-mode'); }, 800);
  };

  const handlePrintProfile = () => {
    setPrintProfile(true);
    document.body.classList.add('print-mode');
    setTimeout(() => window.print(), 150);
    setTimeout(() => { setPrintProfile(false); document.body.classList.remove('print-mode'); }, 800);
  };

  const getClassName = (id) => classes.find(c => c.id === id)?.class_name || '-';
  const getSectionName = (id) => sections.find(s => s.id === id)?.section_name || '-';

  // Reusable labeled field cell for the on-screen profile
  const Field = ({ label, value, span }) => (
    <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 12px', gridColumn: span ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value || '-'}</div>
    </div>
  );
  const sectionTitle = { color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 };

  // Compact styles for the single-page A4 print
  const pSec = { marginBottom: 11, pageBreakInside: 'avoid' };
  const pH = { fontSize: 12.5, color: '#4318FF', borderBottom: '1px solid #c7d2fe', paddingBottom: 3, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const pTd = { padding: '2.5px 6px 2.5px 0', fontSize: 11, verticalAlign: 'top', color: '#0f172a' };
  const pTdB = { ...pTd, fontWeight: 'bold', width: '16%', color: '#334155' };
  const pTdV = { ...pTd, width: '34%' };

  return (
    <>
      {/* Modal Overlay */}
      <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 700, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>

          {/* Header — gradient banner */}
          <div style={{ background: 'linear-gradient(135deg,#4318FF 0%,#7c3aed 60%,#ec4899 100%)', borderRadius: 16, padding: '20px 22px', marginBottom: 22, display: 'flex', gap: 18, alignItems: 'center', color: 'white' }}>
            <div style={{ width: 84, height: 84, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.15)', boxShadow: '0 0 0 3px rgba(255,255,255,0.35)' }}>
              {student.picture ? (
                <img src={student.picture} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: 'white' }}>
                  {student.name?.charAt(0)}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{student.name}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>ID: {student.id}</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Adm No: {student.roll_no || '-'}</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{cls?.class_name || '-'}{curSec?.section_name ? ` (${curSec.section_name})` : ''}</span>
              </div>
            </div>
            <span style={{ background: student.status === 'Active' ? '#dcfce7' : '#fee2e2', color: student.status === 'Active' ? '#166534' : '#991b1b', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 800 }}>{student.status}</span>
          </div>

          {/* Student Information */}
          <h3 className="text-sm font-semibold mb-2" style={sectionTitle}>Student Information</h3>
          <div style={fieldGrid}>
            <Field label="Date of Birth" value={formatDate(student.dob)} />
            <Field label="Age" value={age !== '-' ? `${age} years` : '-'} />
            <Field label="Gender" value={student.gender} />
            <Field label="Admission Date" value={formatDate(student.admission_date)} />
            <Field label="Monthly Fee" value={`Rs. ${Number(student.monthly_fee || 0).toLocaleString()}`} />
            <Field label="Fee Starts From" value={student.fee_start_month ? fmtMon(student.fee_start_month) : '-'} />
            {student.leaving_date && <Field label="Leaving Date" value={formatDate(student.leaving_date)} />}
            {student.medical_info && <Field label="Medical Info" value={student.medical_info} span />}
            {student.address && <Field label="Address" value={student.address} span />}
          </div>

          {/* Parent Information */}
          {parent && (
            <>
              <h3 className="text-sm font-semibold mb-2" style={sectionTitle}>Parent / Guardian Information</h3>
              <div style={fieldGrid}>
                <Field label="Father's Name" value={parent.father_name} />
                <Field label="Father's CNIC" value={parent.father_cnic} />
                <Field label="Father's Occupation" value={parent.father_occupation} />
                <Field label="Father's Contact" value={parent.father_contact} />
                <Field label="Mother's Name" value={parent.mother_name} />
                <Field label="Mother's Contact" value={parent.mother_contact} />
              </div>
            </>
          )}

          {/* Fees & Charges */}
          <div style={{ marginBottom: 20 }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Fees &amp; Charges</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#eef2ff', borderRadius: 10, padding: '10px 14px' }}>
                <div className="text-xs" style={{ color: '#4338ca', fontWeight: 700, textTransform: 'uppercase' }}>Monthly Fee</div>
                <div className="font-bold" style={{ fontSize: '1.05rem' }}>Rs. {Number(student.monthly_fee || 0).toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: '#ecfdf5', borderRadius: 10, padding: '10px 14px' }}>
                <div className="text-xs" style={{ color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>Total Paid</div>
                <div className="font-bold" style={{ fontSize: '1.05rem', color: '#15803d' }}>Rs. {feeSummary.totalPaid.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: feeSummary.totalOutstanding > 0 ? '#fef2f2' : '#f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
                <div className="text-xs" style={{ color: feeSummary.totalOutstanding > 0 ? '#b91c1c' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Outstanding</div>
                <div className="font-bold" style={{ fontSize: '1.05rem', color: feeSummary.totalOutstanding > 0 ? '#dc2626' : '#64748b' }}>Rs. {feeSummary.totalOutstanding.toLocaleString()}</div>
              </div>
            </div>
            {feeSummary.outstanding.length > 0 && (
              <div style={{ marginTop: 10, border: '1px solid #fecaca', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#fef2f2', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>Pending Items</div>
                {feeSummary.outstanding.map((o, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: '0.82rem', borderTop: i ? '1px solid #fee2e2' : 'none' }}>
                    <span>{o.label}</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>Rs. {o.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={showFeeInfo} onChange={e => setShowFeeInfo(e.target.checked)} /> Fees &amp; Charges
                  </label>
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

      {/* Print Only: Student Profile — compact single-page A4 */}
      {printProfile && (
        <div className="print-only" style={{ padding: '4mm 2mm', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
          {/* Letterhead */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid #4318FF', paddingBottom: '7px', marginBottom: '7px' }}>
            <img src={getSettings().logo || '/logo.png'} alt="Logo" style={{ height: '46px', width: '46px', objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>{getSettings().school_name}</div>
              <div style={{ fontSize: '10px', color: '#334155' }}>{getSettings().tagline} &nbsp;•&nbsp; {getSettings().address} &nbsp;•&nbsp; Ph: {getSettings().phone}</div>
            </div>
            <div style={{ background: '#eef2ff', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', fontWeight: 800, color: '#4318FF', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Student<br />Profile</div>
          </div>

          {/* Identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            {student.picture && (
              <img src={student.picture} alt={student.name} style={{ width: '62px', height: '62px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #4318FF', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{student.name}</div>
              <div style={{ fontSize: '11px', color: '#1e293b', marginTop: '2px' }}>
                <strong>ID:</strong> {student.id} &nbsp;|&nbsp; <strong>Admission No:</strong> {student.roll_no || '-'} &nbsp;|&nbsp; <strong>Class:</strong> {cls?.class_name || '-'} {curSec?.section_name ? `(${curSec.section_name})` : ''} &nbsp;|&nbsp; <strong>Status:</strong> {student.status}
              </div>
            </div>
          </div>

          {showBasicInfo && (
            <div style={pSec}>
              <h3 style={pH}>Student Information</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={pTdB}>Date of Birth:</td><td style={pTdV}>{formatDate(student.dob)}</td>
                    <td style={pTdB}>Age:</td><td style={pTdV}>{age !== '-' ? `${age} years` : '-'}</td>
                  </tr>
                  <tr>
                    <td style={pTdB}>Gender:</td><td style={pTdV}>{student.gender || '-'}</td>
                    <td style={pTdB}>Admission Date:</td><td style={pTdV}>{formatDate(student.admission_date)}</td>
                  </tr>
                  <tr>
                    <td style={pTdB}>Monthly Fee:</td><td style={pTdV}>Rs. {Number(student.monthly_fee || 0).toLocaleString()}</td>
                    <td style={pTdB}>Fee Starts:</td><td style={pTdV}>{student.fee_start_month ? fmtMon(student.fee_start_month) : '-'}</td>
                  </tr>
                  {(student.leaving_date || student.medical_info) && (
                    <tr>
                      <td style={pTdB}>{student.leaving_date ? 'Leaving Date:' : 'Medical Info:'}</td>
                      <td style={pTdV}>{student.leaving_date ? formatDate(student.leaving_date) : (student.medical_info || '-')}</td>
                      <td style={pTdB}>{student.leaving_date && student.medical_info ? 'Medical Info:' : ''}</td>
                      <td style={pTdV}>{student.leaving_date && student.medical_info ? student.medical_info : ''}</td>
                    </tr>
                  )}
                  {student.address && (
                    <tr><td style={pTdB}>Address:</td><td colSpan="3" style={pTd}>{student.address}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showParentInfo && parent && (
            <div style={pSec}>
              <h3 style={pH}>Parent / Guardian Information</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={pTdB}>Father's Name:</td><td style={pTdV}>{parent.father_name || '-'}</td>
                    <td style={pTdB}>Father's CNIC:</td><td style={pTdV}>{parent.father_cnic || '-'}</td>
                  </tr>
                  <tr>
                    <td style={pTdB}>Occupation:</td><td style={pTdV}>{parent.father_occupation || '-'}</td>
                    <td style={pTdB}>Contact:</td><td style={pTdV}>{parent.father_contact || '-'}</td>
                  </tr>
                  <tr>
                    <td style={pTdB}>Mother's Name:</td><td style={pTdV}>{parent.mother_name || '-'}</td>
                    <td style={pTdB}>Mother's Contact:</td><td style={pTdV}>{parent.mother_contact || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {showFeeInfo && (
            <div style={pSec}>
              <h3 style={pH}>Fees &amp; Charges</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: feeSummary.outstanding.length ? '6px' : 0 }}>
                <tbody>
                  <tr>
                    <td style={pTdB}>Monthly Fee:</td><td style={pTdV}>Rs. {Number(student.monthly_fee || 0).toLocaleString()}</td>
                    <td style={pTdB}>Total Paid:</td><td style={pTdV}>Rs. {feeSummary.totalPaid.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={pTdB}>Outstanding:</td>
                    <td style={{ ...pTdV, fontWeight: 'bold', color: feeSummary.totalOutstanding > 0 ? '#b91c1c' : '#15803d' }}>Rs. {feeSummary.totalOutstanding.toLocaleString()}</td>
                    <td style={pTdB}>Total Charged:</td><td style={pTdV}>Rs. {feeSummary.totalDue.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              {feeSummary.outstanding.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '3px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px', textAlign: 'left', color: '#334155' }}>Pending Item</th>
                      <th style={{ padding: '3px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px', textAlign: 'right', color: '#334155' }}>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeSummary.outstanding.map((o, i) => (
                      <tr key={i}>
                        <td style={{ padding: '2.5px 8px', borderBottom: '1px solid #eee', fontSize: '11px' }}>{o.label}</td>
                        <td style={{ padding: '2.5px 8px', borderBottom: '1px solid #eee', fontSize: '11px', textAlign: 'right', fontWeight: 'bold' }}>{o.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {showHistoryInfo && history.length > 0 && (
            <div style={pSec}>
              <h3 style={pH}>Promotion History</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '3px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px', color: '#334155' }}>Date</th>
                    <th style={{ padding: '3px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px', color: '#334155' }}>From Class</th>
                    <th style={{ padding: '3px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px', color: '#334155' }}>To Class</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ padding: '2.5px 8px', borderBottom: '1px solid #eee', fontSize: '11px' }}>{formatDate(h.date)}</td>
                      <td style={{ padding: '2.5px 8px', borderBottom: '1px solid #eee', fontSize: '11px' }}>{getClassName(h.from_class_id)} ({getSectionName(h.from_section_id)})</td>
                      <td style={{ padding: '2.5px 8px', borderBottom: '1px solid #eee', fontSize: '11px' }}>{getClassName(h.to_class_id)} ({getSectionName(h.to_section_id)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '14px', paddingTop: '6px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#475569' }}>
            <span>Computer-generated report — {getSettings().school_name}</span>
            <span>Generated on {format(new Date(), 'dd-MM-yyyy')}</span>
          </div>
        </div>
      )}
    </>
  );
}
