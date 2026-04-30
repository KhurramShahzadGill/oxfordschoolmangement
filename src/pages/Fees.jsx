import React, { useState, useEffect } from 'react';
import { apiFees, apiStudents, apiParents, apiClasses, apiSections } from '../services/db';
import { CheckCircle, Search as SearchIcon, X, ChevronDown, ChevronRight, AlertTriangle, Receipt, Printer, Plus, Minus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import FeeVoucher from '../components/FeeVoucher';

const fmtM = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };
const nextMonth = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`; };

const monthRange = (from, to) => {
  const months = [];
  let m = from;
  while (m <= to) { months.push(m); m = nextMonth(m); }
  return months;
};

export default function Fees() {
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  const curMonth = format(new Date(), 'yyyy-MM');
  const [fromMonth, setFromMonth] = useState(curMonth);
  const [toMonth, setToMonth] = useState(curMonth);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');

  const [payStudent, setPayStudent] = useState(null);
  // CollectionItems: [{ month, type: 'Monthly Fee' | 'Fine' | 'Paper Fund' | 'Other', payable, paying }]
  const [collectionItems, setCollectionItems] = useState([]);
  const [printData, setPrintData] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const loadData = async () => {
    setLoading(true);
    const [sD,pD,cD,secD,fD] = await Promise.all([apiStudents.getAll(),apiParents.getAll(),apiClasses.getAll(),apiSections.getAll(),apiFees.getAll()]);
    setStudents(sD); setParents(pD); setClasses(cD); setSections(secD); setFees(fD); setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const getParent = (pid) => parents.find(p => p.id === pid);
  const getClass = (id) => classes.find(c => c.id === id);
  const getSection = (id) => sections.find(s => s.id === id);
  const getFee = (sid, month) => fees.find(f => f.student_id === sid && f.month === month);

  const getArrears = (student) => {
    const start = student.fee_start_month;
    if (!start || start >= fromMonth) return [];
    const arr = [];
    let m = start;
    while (m < fromMonth) {
      const rec = getFee(student.id, m);
      if (!rec || rec.status !== 'Paid') arr.push(m);
      m = nextMonth(m);
    }
    return arr;
  };

  const getPeriodStatus = (student) => {
    const months = monthRange(fromMonth, toMonth);
    let paid = 0, unpaid = 0, paidAmt = 0, unpaidAmt = 0;
    months.forEach(m => {
      if (student.fee_start_month && m < student.fee_start_month) return;
      const rec = getFee(student.id, m);
      if (rec && rec.status === 'Paid') { paid++; paidAmt += Number(rec.amount_paid || 0); }
      else { unpaid++; unpaidAmt += Number(student.monthly_fee || 0); }
    });
    return { paid, unpaid, paidAmt, unpaidAmt };
  };

  const filtered = students.filter(s => {
    if (s.status !== 'Active') return false;
    if (s.fee_start_month && toMonth < s.fee_start_month) return false;
    if (filterClass && s.class_id !== filterClass) return false;
    if (filterSection && s.section_id !== filterSection) return false;
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      if (!(s.id?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))) return false;
    }
    if (parentSearch) {
      const p = getParent(s.parent_id);
      if (!p) return false;
      const q = parentSearch.toLowerCase().replace(/-/g,'');
      if (!((p.father_cnic||'').replace(/-/g,'').includes(q)||(p.mother_cnic||'').replace(/-/g,'').includes(q)||(p.father_name||'').toLowerCase().includes(parentSearch.toLowerCase())||(p.mother_name||'').toLowerCase().includes(parentSearch.toLowerCase()))) return false;
    }
    if (filterStatus) {
      const ps = getPeriodStatus(s);
      if (filterStatus === 'Paid' && ps.unpaid > 0) return false;
      if (filterStatus === 'Unpaid' && ps.unpaid === 0) return false;
    }
    return true;
  });

  const grouped = {};
  filtered.forEach(s => {
    const key = `${s.class_id}||${s.section_id}`;
    if (!grouped[key]) grouped[key] = { className: getClass(s.class_id)?.class_name||'-', sectionName: getSection(s.section_id)?.section_name||'-', students: [] };
    grouped[key].students.push(s);
  });

  useEffect(() => { const e={}; Object.keys(grouped).forEach(k=>e[k]=true); setExpandedGroups(e); }, [filterClass,filterSection,studentSearch,parentSearch,fromMonth,toMonth,filterStatus]);
  const toggleGroup = (k) => setExpandedGroups(p=>({...p,[k]:!p[k]}));

  const openPayModal = (s) => {
    const arrears = getArrears(s);
    const currentMonths = monthRange(fromMonth, toMonth).filter(m => {
      if (s.fee_start_month && m < s.fee_start_month) return false;
      const rec = getFee(s.id, m);
      return !rec || rec.status !== 'Paid';
    });

    const items = [];
    [...arrears, ...currentMonths].forEach(m => {
      const existing = getFee(s.id, m);
      const payable = Number(s.monthly_fee || 0);
      // isMarkedPaid is false initially (Unpaid Red)
      items.push({ month: m, type: 'Monthly Fee', payable, paying: payable, isMarkedPaid: false });
      
      const fine = Number(existing?.fine || 0) || 0;
      const paper = Number(existing?.paper_fund || 0) || 0;
      const other = Number(existing?.other_charges || 0) || 0;
      
      if (fine > 0 || m === curMonth) items.push({ month: m, type: 'Fine', payable: fine || 0, paying: fine || 0, isMarkedPaid: false });
      if (paper > 0 || m === curMonth) items.push({ month: m, type: 'Paper Fund', payable: paper || 0, paying: paper || 0, isMarkedPaid: false });
      if (other > 0 || m === curMonth) items.push({ month: m, type: 'Other', payable: other || 0, paying: other || 0, isMarkedPaid: false });
    });

    setPayStudent(s);
    setCollectionItems(items);
  };

  const handlePay = async (e) => {
    if (e) e.preventDefault();
    if (!payStudent) return;

    const paidItems = collectionItems.filter(i => i.isMarkedPaid);
    if (paidItems.length === 0) return;

    const monthsData = {};
    paidItems.forEach(item => {
      if (!monthsData[item.month]) monthsData[item.month] = { fine: 0, paper_fund: 0, other_charges: 0, total_paying: 0 };
      
      if (item.type === 'Monthly Fee') monthsData[item.month].total_paying += Number(item.paying);
      else if (item.type === 'Fine') { monthsData[item.month].fine = Number(item.paying); monthsData[item.month].total_paying += Number(item.paying); }
      else if (item.type === 'Paper Fund') { monthsData[item.month].paper_fund = Number(item.paying); monthsData[item.month].total_paying += Number(item.paying); }
      else if (item.type === 'Other') { monthsData[item.month].other_charges = Number(item.paying); monthsData[item.month].total_paying += Number(item.paying); }
    });

    for (const month in monthsData) {
      const existing = getFee(payStudent.id, month);
      const data = {
        student_id: payStudent.id,
        month,
        fine: monthsData[month].fine,
        paper_fund: monthsData[month].paper_fund,
        other_charges: monthsData[month].other_charges,
        status: 'Paid',
        paid_date: format(new Date(), 'yyyy-MM-dd'),
        amount_paid: (existing ? Number(existing.amount_paid || 0) : 0) + monthsData[month].total_paying
      };
      if (existing) await apiFees.update(existing.id, data);
      else await apiFees.create(data);
    }
    loadData();
  };

  const handlePrint = (student, items) => {
    const months = [...new Set(items.map(i => i.month))];
    const primaryMonth = months[months.length - 1] || curMonth;
    
    // Find ALL unpaid months for this student to show accurate debt
    const start = student.fee_start_month;
    const allUnpaid = [];
    if (start) {
      let m = start;
      const today = format(new Date(), 'yyyy-MM');
      while (m <= today) {
        const rec = getFee(student.id, m);
        const isBeingPaid = items.some(i => i.month === m && i.type === 'Monthly Fee');
        if ((!rec || rec.status !== 'Paid') && !isBeingPaid) {
          allUnpaid.push(m);
        }
        m = nextMonth(m);
      }
    }

    const feeData = {
      month: primaryMonth,
      paid_date: format(new Date(), 'yyyy-MM-dd'),
      amount_paid: items.reduce((s, i) => s + Number(i.paying), 0),
      breakdown: items
    };

    setPrintData({ student, fee: feeData, arrears: allUnpaid, month: primaryMonth });
    setTimeout(() => window.print(), 300);
    setTimeout(() => setPrintData(null), 1000);
  };

  const updateItem = (index, val) => {
    const newItems = [...collectionItems];
    newItems[index].paying = val;
    setCollectionItems(newItems);
  };

  const inp = { padding: '8px 12px', fontSize: '0.85rem' };

  return (
    <div>
      <div className="no-print">
        <h1 className="text-2xl font-bold mb-6">Fee Management</h1>

        {/* Filters */}
        <div className="card mb-6">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 140 }}><label className="form-label text-xs">From Month</label><input type="month" className="form-input" style={inp} value={fromMonth} onChange={e => setFromMonth(e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 140 }}><label className="form-label text-xs">To Month</label><input type="month" className="form-input" style={inp} value={toMonth} onChange={e => setToMonth(e.target.value)} /></div>
            <select className="form-select" style={{ flex: 1, ...inp, alignSelf: 'flex-end' }} value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, ...inp, alignSelf: 'flex-end' }} value={filterSection} onChange={e => setFilterSection(e.target.value)} disabled={!filterClass}>
              <option value="">All Sections</option>
              {sections.filter(s => s.class_id === filterClass).map(s => <option key={s.id} value={s.id}>Sec {s.section_name}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, ...inp, alignSelf: 'flex-end' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option><option value="Paid">All Paid</option><option value="Unpaid">Has Unpaid</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: 1, minWidth: 200, ...inp }} placeholder="Student ID, Roll, Name..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
            <input className="form-input" style={{ flex: 1, minWidth: 200, ...inp }} placeholder="Parent CNIC, Name..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
          </div>
        </div>

        {/* Grouped Students Table */}
        {loading ? <p style={{ textAlign: 'center', padding: 24 }}>Loading...</p> : Object.entries(grouped).map(([key, g]) => {
          const isExp = expandedGroups[key] !== false;
          return (
            <div key={key} className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggleGroup(key)} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer', background: 'var(--bg-primary)', borderBottom: isExp ? '1px solid var(--border-color)' : 'none', gap: 10 }}>
                {isExp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="font-semibold">{g.className}</span>
                <span className="badge badge-primary">Sec {g.sectionName}</span>
                <span className="text-xs text-secondary-color">({g.students.length})</span>
              </div>
              {isExp && (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>ID</th><th>Roll</th><th>Name</th><th>Fee</th><th>Arrears</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                  <tbody>
                    {g.students.map(s => {
                      const ps = getPeriodStatus(s);
                      const arrears = getArrears(s);
                      const arrTotal = arrears.length * Number(s.monthly_fee || 0);
                      return (
                        <tr key={s.id}>
                          <td className="text-xs text-secondary-color">{s.id}</td>
                          <td className="font-medium">{s.roll_no}</td>
                          <td><div className="font-medium">{s.name}</div></td>
                          <td>Rs. {s.monthly_fee}</td>
                          <td>{arrTotal > 0 ? <span className="text-danger font-medium">Rs. {arrTotal.toLocaleString()}</span> : '—'}</td>
                          <td><span className={`badge ${ps.unpaid === 0 ? 'badge-success' : 'badge-danger'}`}>{ps.unpaid === 0 ? 'All Paid' : 'Unpaid'}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => openPayModal(s)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                              <Receipt size={13} /> Fee Voucher
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* Advanced Collection Modal */}
      {payStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: 650, position: 'relative', animation: 'fadeIn 0.3s ease' }}>
            <button onClick={() => setPayStudent(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h2 className="text-xl font-bold mb-4">Fee Collection & Voucher Generator</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {payStudent.picture && <img src={payStudent.picture} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />}
                <div>
                  <div className="font-bold text-lg">{payStudent.name}</div>
                  <div className="text-xs text-secondary-color">Father: {getParent(payStudent.parent_id)?.father_name || '-'}</div>
                  <div className="text-xs text-secondary-color">ID: {payStudent.id} | Roll: {payStudent.roll_no}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-sm font-semibold">{getClass(payStudent.class_id)?.class_name} - {getSection(payStudent.section_id)?.section_name}</div>
                <div className="text-xs text-secondary-color">Monthly Fee: Rs. {payStudent.monthly_fee}</div>
              </div>
            </div>

            <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 20 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                  <tr><th>Month</th><th>Description</th><th>Payable</th><th>Amount Paying</th><th style={{ textAlign: 'center' }}>Action</th></tr>
                </thead>
                <tbody>
                  {collectionItems.map((item, idx) => (
                    <tr key={`${item.month}-${item.type}`}>
                      <td className="text-sm">{fmtM(item.month)}</td>
                      <td className="text-sm">{item.type}</td>
                      <td className="text-sm font-medium">Rs. {item.payable}</td>
                      <td>
                        <input type="number" className="form-input" style={{ ...inp, width: 100, height: 32 }} value={item.paying} onChange={e => updateItem(idx, e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button"
                          className="btn" 
                          style={{ padding: '2px 12px', fontSize: '0.7rem', background: item.isMarkedPaid ? 'var(--success)' : 'var(--danger)', color: 'white', fontWeight: 'bold', width: 70 }}
                          onClick={() => {
                            const newItems = [...collectionItems];
                            newItems[idx].isMarkedPaid = !newItems[idx].isMarkedPaid;
                            setCollectionItems(newItems);
                          }}
                        >
                          {item.isMarkedPaid ? 'Paid' : 'Unpaid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 32 }}>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--danger)' }}>Total Unpaid Amount</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>Rs. {collectionItems.filter(i => !i.isMarkedPaid).reduce((s, i) => s + Number(i.payable), 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--success)' }}>Total Paid Amount</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>Rs. {collectionItems.filter(i => i.isMarkedPaid).reduce((s, i) => s + Number(i.paying), 0).toLocaleString()}</div>
                </div>
              </div>
              <button type="button" className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={(e) => { 
                const paidItems = collectionItems.filter(i => i.isMarkedPaid);
                if (paidItems.length === 0) { alert('Please mark at least one item as Paid'); return; }
                handlePay(e); 
                handlePrint(payStudent, paidItems); 
                setPayStudent(null);
              }}>
                <Printer size={18} /> Print & Save Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Voucher Hidden Layer */}
      {printData && (
        <FeeVoucher
          student={printData.student}
          fee={printData.fee}
          arrears={printData.arrears}
          parent={getParent(printData.student.parent_id)}
          className={getClass(printData.student.class_id)?.class_name}
          sectionName={getSection(printData.student.section_id)?.section_name}
          breakdown={printData.fee.breakdown}
        />
      )}
    </div>
  );
}
