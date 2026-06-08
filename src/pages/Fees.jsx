import React, { useState, useEffect } from 'react';
import { apiFees, apiStudents, apiParents, apiClasses, apiSections, apiCustomCharges } from '../services/db';
import { X, ChevronDown, ChevronRight, Receipt, Printer, History, FileSpreadsheet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import FeeVoucher from '../components/FeeVoucher';
import * as XLSX from 'xlsx';

const fmtM = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };
const nextMonth = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`; };

/* One-time admission charges captured in the student profile. Each tracks a `<key>_paid` amount. */
const ADMISSION_HEADS = [
  { key: 'admission_fee',  label: 'Admission Fee' },
  { key: 'security_fee',   label: 'Security Fee' },
  { key: 'paper_fund',     label: 'Paper Fund' },
  { key: 'stationery_fee', label: 'Stationery Fee' },
  { key: 'other_fee',      label: 'Others' },
];
const getAdmissionDues = (student) => ADMISSION_HEADS
  .map(h => ({ ...h, amount: Number(student[h.key] || 0), paid: Number(student[h.key + '_paid'] || 0) }))
  .map(h => ({ ...h, balance: h.amount - h.paid }))
  .filter(h => h.balance > 0);

/* ───────── Column Groups for Fee Export Modal ───────── */
const FEE_COL_GROUPS = [
  {
    label: 'Basic Info',
    columns: [
      { key: 'id',      label: 'Student ID' },
      { key: 'roll_no', label: 'Admission No' },
      { key: 'name',    label: 'Student Name' },
      { key: 'status',  label: 'Fee Status' },
    ],
  },
  {
    label: 'Academic',
    columns: [
      { key: 'class',   label: 'Class' },
      { key: 'section', label: 'Section' },
    ],
  },
  {
    label: 'Fee Details',
    columns: [
      { key: 'monthly_fee',      label: 'Monthly Fee (Rs.)' },
      { key: 'period',           label: 'Period (From–To)' },
      { key: 'months_paid',      label: 'Months Paid' },
      { key: 'months_unpaid',    label: 'Months Unpaid' },
      { key: 'amount_collected', label: 'Amount Collected' },
      { key: 'amount_pending',   label: 'Amount Pending' },
      { key: 'arrears',          label: 'Arrears (Rs.)' },
    ],
  },
  {
    label: 'Parent Info',
    columns: [
      { key: 'father_name',    label: 'Father Name' },
      { key: 'father_contact', label: 'Father Contact' },
      { key: 'father_cnic',    label: 'Father CNIC' },
      { key: 'address',        label: 'Address' },
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
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', animation: 'fadeIn 0.25s ease' }}>

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
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '7px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filter Info Bar */}
        {filterSummary && (
          <div style={{ padding: '9px 26px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>📋</span> {filterSummary}
          </div>
        )}

        {/* Column Groups */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {columnGroups.map(group => {
              const allSel = group.columns.every(c => selectedCols[c.key]);
              return (
                <div key={group.label} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</span>
                    <button onClick={() => toggleGroup(group)} style={{ background: allSel ? '#4318FF' : '#e0e7ff', color: allSel ? 'white' : '#4318FF', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                      {allSel ? '✕ Deselect' : '✓ All'}
                    </button>
                  </div>
                  <div style={{ padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {group.columns.map(col => (
                      <label key={col.key} onClick={() => onColChange(col.key, !selectedCols[col.key])} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: selectedCols[col.key] ? '#4318FF' : 'white', border: `1.5px solid ${selectedCols[col.key] ? '#4318FF' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                          {selectedCols[col.key] && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500, userSelect: 'none' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '9px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600 }}>
            ✓ {selectedCount} column{selectedCount !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 26px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
          <button onClick={() => { onExcel(); onClose(); }} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          <button onClick={() => { onPrint(); onClose(); }} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4318FF,#3311DB)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(67,24,255,0.3)' }}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [customCharges, setCustomCharges] = useState([]);
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
  const [fineDesc, setFineDesc] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [printData, setPrintData] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [historyStudent, setHistoryStudent] = useState(null);
  const [histFromMonth, setHistFromMonth] = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-5); return format(d,'yyyy-MM'); });
  const [histToMonth, setHistToMonth] = useState(curMonth);

  // Export / Print States
  const [printFeeList, setPrintFeeList] = useState(false);
  const [printHistoryStudent, setPrintHistoryStudent] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [printCols, setPrintCols] = useState({
    id: true, roll_no: true, name: true, status: true,
    class: true, section: true,
    monthly_fee: true, period: false, months_paid: false, months_unpaid: true,
    amount_collected: true, amount_pending: true, arrears: true,
    father_name: false, father_contact: false, father_cnic: false, address: false,
  });

  const loadData = async () => {
    setLoading(true);
    const [sD,pD,cD,secD,fD,ccD] = await Promise.all([apiStudents.getAll(),apiParents.getAll(),apiClasses.getAll(),apiSections.getAll(),apiFees.getAll(),apiCustomCharges.getAll()]);
    setStudents(sD); setParents(pD); setClasses(cD); setSections(secD); setFees(fD); setCustomCharges(ccD); setLoading(false);
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
      const totalDue = Number(student.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
      if (Number(rec?.amount_paid || 0) < totalDue) arr.push(m);
      m = nextMonth(m);
    }
    return arr;
  };

  const getArrearsAmount = (student) => {
    const start = student.fee_start_month;
    let amount = 0;
    if (start && start < fromMonth) {
      let m = start;
      while (m < fromMonth) {
        const rec = getFee(student.id, m);
        const totalDue = Number(student.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
        const bal = totalDue - Number(rec?.amount_paid || 0);
        if (bal > 0) amount += bal;
        m = nextMonth(m);
      }
    }
    const myCharges = customCharges.filter(c => c.student_id === student.id);
    myCharges.forEach(c => {
      const bal = Number(c.amount) - Number(c.amount_paid || 0);
      if (bal > 0) amount += bal;
    });
    getAdmissionDues(student).forEach(h => { amount += h.balance; });
    return amount;
  };

  const getPeriodStatus = (student) => {
    const months = monthRange(fromMonth, toMonth);
    let paid = 0, unpaid = 0, paidAmt = 0, unpaidAmt = 0;
    months.forEach(m => {
      if (student.fee_start_month && m < student.fee_start_month) return;
      const rec = getFee(student.id, m);
      const totalDue = Number(student.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
      const bal = totalDue - Number(rec?.amount_paid || 0);
      
      if (rec) paidAmt += Number(rec.amount_paid || 0);
      if (bal <= 0) { paid++; }
      else { unpaid++; unpaidAmt += bal; }
    });
    
    const myCharges = customCharges.filter(c => c.student_id === student.id);
    myCharges.forEach(c => {
      const bal = Number(c.amount) - Number(c.amount_paid || 0);
      paidAmt += Number(c.amount_paid || 0);
      if (bal <= 0) { paid++; }
      else { unpaid++; unpaidAmt += bal; }
    });
    getAdmissionDues(student).forEach(h => { unpaid++; unpaidAmt += h.balance; });
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

  // Summary totals for all filtered students across selected period
  const filteredSummary = filtered.reduce((acc, s) => {
    const months = monthRange(fromMonth, toMonth);
    months.forEach(m => {
      if (s.fee_start_month && m < s.fee_start_month) return;
      const rec = getFee(s.id, m);
      const totalDue = Number(s.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
      const bal = totalDue - Number(rec?.amount_paid || 0);
      acc.collected += Number(rec?.amount_paid || 0);
      acc.pending += Math.max(0, bal);
      acc.total += totalDue;
    });
    return acc;
  }, { collected: 0, pending: 0, total: 0 });

  // History records for selected student and date range
  const historyRecords = historyStudent
    ? [
        ...fees
          .filter(f => f.student_id === historyStudent.id && f.month >= histFromMonth && f.month <= histToMonth)
          .map(f => ({ ...f, isCustom: false, dateKey: f.month })),
        ...customCharges
          .filter(c => c.student_id === historyStudent.id && c.date_created?.substring(0,7) >= histFromMonth && c.date_created?.substring(0,7) <= histToMonth)
          .map(c => ({ ...c, isCustom: true, dateKey: c.date_created?.substring(0,7) || '2026-01' }))
      ].sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1))
    : [];

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
      const totalDue = Number(s.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
      return Number(rec?.amount_paid || 0) < totalDue;
    });

    const items = [];
    [...arrears, ...currentMonths].forEach(m => {
      const existing = getFee(s.id, m);
      const paidAlready = Number(existing?.amount_paid || 0);
      const monthlyDue = Number(s.monthly_fee || 0);

      // Only the monthly fee is auto-listed. Fines are added manually via the "Save Fine" button.
      const remainingMonthly = Math.max(0, monthlyDue - paidAlready);
      if (remainingMonthly > 0 || (!existing && m === curMonth)) {
        items.push({ month: m, type: 'Monthly Fee', payable: remainingMonthly || monthlyDue, paying: remainingMonthly || monthlyDue, isMarkedPaid: false });
      }
    });

    // One-time admission charges (from profile) appear as dues until fully paid
    getAdmissionDues(s).forEach(h => {
      items.push({ admissionKey: h.key, month: 'N/A', type: h.label, payable: h.balance, paying: h.balance, isMarkedPaid: false, isAdmission: true });
    });

    // Outstanding fines (stored as custom charges) appear as dues
    const myCharges = customCharges.filter(c => c.student_id === s.id);
    myCharges.forEach(c => {
      const bal = Number(c.amount) - Number(c.amount_paid || 0);
      if (bal > 0) {
        items.push({ charge_id: c.id, month: 'N/A', type: c.title, payable: bal, paying: bal, isMarkedPaid: false, isCustom: true });
      }
    });

    setPayStudent(s);
    setCollectionItems(items);
  };

  const addFine = async () => {
    if (!payStudent) return;
    const amount = Number(fineAmount);
    if (!amount || amount <= 0) { alert('Fine ki amount likhein'); return; }
    const title = fineDesc.trim() ? `Fine (${fineDesc.trim()})` : 'Fine';
    const created = await apiCustomCharges.create({
      student_id: payStudent.id, title, amount,
      amount_paid: 0, status: 'Unpaid', paid_date: null,
    });
    await loadData();
    setCollectionItems(prev => [...prev, { charge_id: created.id, month: 'N/A', type: title, payable: amount, paying: amount, isMarkedPaid: true, isCustom: true }]);
    setFineDesc(''); setFineAmount('');
  };

  const handlePay = async (e) => {
    if (e) e.preventDefault();
    if (!payStudent) return;

    const paidItems = collectionItems.filter(i => i.isMarkedPaid);
    if (paidItems.length === 0) return;

    const customItems = paidItems.filter(i => i.isCustom);
    for (const item of customItems) {
      if (item.charge_id === 'new') {
        await apiCustomCharges.create({
          student_id: payStudent.id,
          title: item.type,
          amount: Number(item.payable),
          amount_paid: Number(item.paying),
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          status: Number(item.paying) >= Number(item.payable) ? 'Paid' : 'Partial'
        });
      } else {
        const existing = customCharges.find(c => c.id === item.charge_id);
        const newPaid = Number(existing?.amount_paid || 0) + Number(item.paying);
        await apiCustomCharges.update(item.charge_id, {
          amount_paid: newPaid,
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          status: newPaid >= Number(existing?.amount || 0) ? 'Paid' : 'Partial'
        });
      }
    }

    const monthlyItems = paidItems.filter(i => !i.isCustom);
    if (monthlyItems.length > 0) {
      const monthsData = {};
      monthlyItems.forEach(item => {
        if (!monthsData[item.month]) {
          const ex = getFee(payStudent.id, item.month);
          monthsData[item.month] = { 
            fine: Number(ex?.fine || 0), 
            paper_fund: Number(ex?.paper_fund || 0), 
            other_charges: Number(ex?.other_charges || 0), 
            total_paying: 0 
          };
        }
        
        monthsData[item.month].total_paying += Number(item.paying);
        if (item.type === 'Fine') monthsData[item.month].fine = Math.max(monthsData[item.month].fine, Number(item.payable));
        else if (item.type === 'Paper Fund') monthsData[item.month].paper_fund = Math.max(monthsData[item.month].paper_fund, Number(item.payable));
        else if (item.type === 'Other Charges') monthsData[item.month].other_charges = Math.max(monthsData[item.month].other_charges, Number(item.payable));
      });

      for (const month in monthsData) {
        const existing = getFee(payStudent.id, month);
        const newTotalPaid = (existing ? Number(existing.amount_paid || 0) : 0) + monthsData[month].total_paying;
        const totalExpected = Number(payStudent.monthly_fee || 0) + monthsData[month].fine + monthsData[month].paper_fund + monthsData[month].other_charges;

        const data = {
          student_id: payStudent.id,
          month,
          fine: monthsData[month].fine,
          paper_fund: monthsData[month].paper_fund,
          other_charges: monthsData[month].other_charges,
          status: newTotalPaid >= totalExpected ? 'Paid' : 'Partial',
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          amount_paid: newTotalPaid
        };
        if (existing) await apiFees.update(existing.id, data);
        else await apiFees.create(data);
      }
    }

    // One-time admission charges → accumulate paid amount on the student record
    const admissionItems = paidItems.filter(i => i.isAdmission);
    if (admissionItems.length > 0) {
      const updates = {};
      admissionItems.forEach(i => {
        const key = i.admissionKey + '_paid';
        const prev = updates[key] !== undefined ? updates[key] : Number(payStudent[key] || 0);
        updates[key] = prev + Number(i.paying);
      });
      await apiStudents.update(payStudent.id, updates);
    }

    loadData();
  };

  const handlePrint = (student, items) => {
    const monthlyItems = items.filter(i => !i.isCustom);
    const months = [...new Set(monthlyItems.map(i => i.month))];
    const primaryMonth = months[months.length - 1] || curMonth;
    
    const start = student.fee_start_month;
    const allUnpaid = [];
    if (start) {
      let m = start;
      const today = format(new Date(), 'yyyy-MM');
      while (m <= today) {
        const isBeingPaid = items.some(i => !i.isCustom && i.month === m);
        if (!isBeingPaid) {
          const rec = getFee(student.id, m);
          const totalDue = Number(student.monthly_fee || 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
          const bal = totalDue - Number(rec?.amount_paid || 0);
          if (bal > 0) {
            allUnpaid.push({ month: m, balance: bal });
          }
        }
        m = nextMonth(m);
      }
    }

    const myCharges = customCharges.filter(c => c.student_id === student.id);
    myCharges.forEach(c => {
      const isBeingPaid = items.some(i => i.charge_id === c.id);
      if (!isBeingPaid) {
        const bal = Number(c.amount) - Number(c.amount_paid || 0);
        if (bal > 0) {
          allUnpaid.push({ month: c.title, balance: bal, isCustom: true });
        }
      }
    });

    // One-time admission charges not being paid now → show as dues
    getAdmissionDues(student).forEach(h => {
      const isBeingPaid = items.some(i => i.isAdmission && i.admissionKey === h.key);
      if (!isBeingPaid) {
        allUnpaid.push({ month: h.label, balance: h.balance, isCustom: true });
      }
    });

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

  // Excel Export for Fee Module — respects printCols
  const handleFeeExportExcel = () => {
    if (filtered.length === 0) { alert('Export karne ke liye koi student nahi mila.'); return; }
    const rows = [];
    filtered.forEach(s => {
      const p = parents.find(pr => pr.id === s.parent_id);
      const c = classes.find(cl => cl.id === s.class_id);
      const sec = sections.find(sc => sc.id === s.section_id);
      const ps = getPeriodStatus(s);
      const arrTotal = getArrearsAmount(s);
      const row = {};
      if (printCols.id)               row['Student ID']            = s.id || '';
      if (printCols.roll_no)          row['Admission No']          = s.roll_no || '';
      if (printCols.name)             row['Student Name']          = s.name || '';
      if (printCols.status)           row['Fee Status']            = ps.unpaid === 0 ? 'All Paid' : 'Unpaid';
      if (printCols.class)            row['Class']                 = c?.class_name || '';
      if (printCols.section)          row['Section']               = sec?.section_name || '';
      if (printCols.monthly_fee)      row['Monthly Fee (Rs.)']     = s.monthly_fee || 0;
      if (printCols.period)           row['Period']                = `${fromMonth} to ${toMonth}`;
      if (printCols.months_paid)      row['Months Paid']           = ps.paid;
      if (printCols.months_unpaid)    row['Months Unpaid']         = ps.unpaid;
      if (printCols.amount_collected) row['Amount Collected (Rs.)']= ps.paidAmt;
      if (printCols.amount_pending)   row['Amount Pending (Rs.)']  = ps.unpaidAmt;
      if (printCols.arrears)          row['Arrears (Rs.)']         = arrTotal;
      if (printCols.father_name)      row['Father Name']           = p?.father_name || '';
      if (printCols.father_contact)   row['Father Contact']        = p?.father_contact || '';
      if (printCols.father_cnic)      row['Father CNIC']           = p?.father_cnic || '';
      if (printCols.address)          row['Address']               = s?.address || '';
      if (Object.keys(row).length > 0) rows.push(row);
    });
    if (rows.length === 0 || Object.keys(rows[0] || {}).length === 0) { alert('Kam az kam ek column zaroor chunein.'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Report');
    const fileName = `Fee_Report_${fromMonth}_to_${toMonth}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrintList = () => {
    setPrintFeeList(true);
    setTimeout(() => window.print(), 200);
    setTimeout(() => setPrintFeeList(false), 800);
  };

  // Build filter summary for export modal
  const feeFilterSummary = [
    `${filtered.length} students`,
    `Period: ${fmtM(fromMonth)} – ${fmtM(toMonth)}`,
    filterClass && `Class: ${classes.find(c => c.id === filterClass)?.class_name}`,
    filterSection && `Section: ${sections.find(s => s.id === filterSection)?.section_name}`,
    filterStatus && `Status: ${filterStatus}`,
    studentSearch && `Search: "${studentSearch}"`,
  ].filter(Boolean).join(' · ');

  const thStyle = { padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.03em', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)' };
  const tdStyle = { padding: '5px 8px', fontSize: 10, wordBreak: 'break-word', overflowWrap: 'break-word', borderRight: '1px solid #e2e8f0', verticalAlign: 'top', lineHeight: 1.4 };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="text-2xl font-bold">Fee Management</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Single button opens Export Modal */}
            <button
              onClick={() => setShowExportModal(true)}
              title="PDF print ya Excel export ke liye columns chunein"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#4318FF,#3311DB)', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 2px 8px rgba(67,24,255,0.3)' }}
            >
              <Printer size={15} />
              <FileSpreadsheet size={15} />
              Export / Print ({filtered.length})
            </button>
          </div>
        </div>

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
            <select className="form-select" style={{ flex: 1, minWidth: 150, ...inp }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option><option value="Paid">Paid</option><option value="Unpaid">Unpaid</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: 1, minWidth: 200, ...inp }} placeholder="Student ID, Admission No, Name..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
            <input className="form-input" style={{ flex: 1, minWidth: 200, ...inp }} placeholder="Parent CNIC, Name..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
          </div>
        </div>

        {/* Filtered Summary Bar — 2 cards only */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <div style={{ flex: 1, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/><path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Filtered Record — Paid Fee</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>Rs. {filteredSummary.collected.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#4ade80', marginTop: 2 }}>{filtered.length} students in view</div>
              </div>
            </div>
            <div style={{ flex: 1, background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '1px solid #fca5a5', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/><path d="M12 8v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Filtered Record — Unpaid Fee</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>Rs. {filteredSummary.pending.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#f87171', marginTop: 2 }}>Across selected period</div>
              </div>
            </div>
          </div>
        )}

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
                  <thead><tr><th>ID</th><th>Admission No</th><th>Name</th><th>Fee</th><th>Arrears</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                  <tbody>
                    {g.students.map(s => {
                      const ps = getPeriodStatus(s);
                      const arrTotal = getArrearsAmount(s);
                      return (
                        <tr key={s.id}>
                          <td className="text-xs text-secondary-color">{s.id}</td>
                          <td className="font-medium">{s.roll_no}</td>
                          <td><div className="font-medium">{s.name}</div></td>
                          <td>Rs. {s.monthly_fee}</td>
                          <td>{arrTotal > 0 ? <span className="text-danger font-medium">Rs. {arrTotal.toLocaleString()}</span> : '—'}</td>
                          <td><span className={`badge ${ps.unpaid === 0 ? 'badge-success' : 'badge-danger'}`}>{ps.unpaid === 0 ? 'All Paid' : 'Unpaid'}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button onClick={() => { setHistoryStudent(s); const d=new Date(); d.setMonth(d.getMonth()-5); setHistFromMonth(format(d,'yyyy-MM')); setHistToMonth(curMonth); }} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                <History size={13} /> History
                              </button>
                              <button onClick={() => openPayModal(s)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                <Receipt size={13} /> Fee Voucher
                              </button>
                            </div>
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

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Fee Report — Export Settings"
        columnGroups={FEE_COL_GROUPS}
        selectedCols={printCols}
        onColChange={(key, val) => setPrintCols(prev => ({ ...prev, [key]: val }))}
        onPrint={handlePrintList}
        onExcel={handleFeeExportExcel}
        filterSummary={feeFilterSummary}
      />

      {/* Advanced Collection Modal */}
      {payStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: 650, position: 'relative', animation: 'fadeIn 0.3s ease' }}>
            <button onClick={() => { setPayStudent(null); setFineDesc(''); setFineAmount(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h2 className="text-xl font-bold mb-4">Fee Collection & Voucher Generator</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {payStudent.picture && <img src={payStudent.picture} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />}
                <div>
                  <div className="font-bold text-lg">{payStudent.name}</div>
                  <div className="text-xs text-secondary-color">Father: {getParent(payStudent.parent_id)?.father_name || '-'}</div>
                  <div className="text-xs text-secondary-color">ID: {payStudent.id} | Admission No: {payStudent.roll_no}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-sm font-semibold">{getClass(payStudent.class_id)?.class_name} - {getSection(payStudent.section_id)?.section_name}</div>
                <div className="text-xs text-secondary-color">Monthly Fee: Rs. {payStudent.monthly_fee}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 15, background: '#fff7ed', padding: 12, borderRadius: 8, border: '1px dashed #fdba74', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9a3412', whiteSpace: 'nowrap' }}>Add Fine:</span>
              <input type="text" value={fineDesc} onChange={e => setFineDesc(e.target.value)} placeholder="Fine Description (e.g. Late fee, Broken chair)" className="form-input" style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }} />
              <input type="number" value={fineAmount} onChange={e => setFineAmount(e.target.value)} placeholder="Amount" className="form-input" style={{ width: 110, padding: '8px 12px', fontSize: '0.85rem' }} />
              <button type="button" className="btn btn-primary" onClick={addFine} style={{ whiteSpace: 'nowrap' }}>+ Save Fine</button>
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
                  <div className="text-xs uppercase font-bold tracking-wider" style={{ color: '#64748b' }}>Total Payable</div>
                  <div className="text-xl font-bold">Rs. {collectionItems.reduce((s, i) => s + Number(i.payable), 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--success)' }}>Amount Paying</div>
                  <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>Rs. {collectionItems.filter(i => i.isMarkedPaid).reduce((s, i) => s + Number(i.paying), 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--danger)' }}>Remaining</div>
                  <div className="text-xl font-bold" style={{ color: 'var(--danger)' }}>Rs. {(collectionItems.reduce((s, i) => s + Number(i.payable), 0) - collectionItems.filter(i => i.isMarkedPaid).reduce((s, i) => s + Number(i.paying), 0)).toLocaleString()}</div>
                </div>
              </div>
              <button type="button" className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={(e) => { 
                const paidItems = collectionItems.filter(i => i.isMarkedPaid);
                if (paidItems.length === 0) { alert('Please mark at least one item as Paid'); return; }
                handlePay(e);
                handlePrint(payStudent, paidItems);
                setPayStudent(null); setFineDesc(''); setFineAmount('');
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

      {/* Transaction History Modal — Premium Redesign */}
      {historyStudent && (() => {
        const hPaid = historyRecords.reduce((s, f) => s + Number(f.amount_paid || 0), 0);
        const hDue = historyRecords.reduce((s, f) => {
          if (f.isCustom) return s + Number(f.amount || 0);
          return s + Number(historyStudent.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0);
        }, 0);
        const hPending = Math.max(0, hDue - hPaid);
        const paidCount = historyRecords.filter(f => f.status === 'Paid').length;
        const partialCount = historyRecords.filter(f => f.status === 'Partial').length;
        const unpaidCount = historyRecords.filter(f => !f.status || f.status === 'Unpaid').length;
        return (
          <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '30px 16px', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '100%', maxWidth: 780, borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', background: 'var(--bg-secondary)' }}>

              {/* Gradient Header */}
              <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', padding: '28px 28px 22px', position: 'relative' }}>
                <button onClick={() => { setPrintHistoryStudent(true); setTimeout(() => window.print(), 200); setTimeout(() => setPrintHistoryStudent(false), 800); }} style={{ position: 'absolute', top: 16, right: 48, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 12px', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}><Printer size={15} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Print Invoice</span></button>
                <button onClick={() => setHistoryStudent(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)', flexShrink: 0, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {historyStudent.picture
                      ? <img src={historyStudent.picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{historyStudent.name?.charAt(0)}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 3 }}>{historyStudent.name}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[['ID', historyStudent.id], ['Admission No', historyStudent.roll_no], ['Class', `${getClass(historyStudent.class_id)?.class_name} – ${getSection(historyStudent.section_id)?.section_name}`], ['Monthly Fee', `Rs. ${Number(historyStudent.monthly_fee||0).toLocaleString()}`]].map(([k,v]) => (
                        <span key={k} style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 8px' }}><strong style={{ color: 'rgba(255,255,255,0.9)' }}>{k}:</strong> {v}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats row inside header */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  {[{ label: 'Paid Fee', val: `Rs. ${hPaid.toLocaleString()}`, c: '#4ade80' }, { label: 'Balance Due', val: `Rs. ${hPending.toLocaleString()}`, c: '#f87171' }, { label: 'Total Charged', val: `Rs. ${hDue.toLocaleString()}`, c: '#93c5fd' }, { label: 'Records', val: historyRecords.length, c: '#e2e8f0' }].map(s => (
                    <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: s.c }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: 24 }}>
                {/* Date Range + status pills */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label text-xs">From Month</label>
                    <input type="month" className="form-input" style={{ padding: '7px 10px', fontSize: '0.85rem' }} value={histFromMonth} onChange={e => setHistFromMonth(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label text-xs">To Month</label>
                    <input type="month" className="form-input" style={{ padding: '7px 10px', fontSize: '0.85rem' }} value={histToMonth} onChange={e => setHistToMonth(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                    {paidCount > 0 && <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 99, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700 }}>✓ Paid: {paidCount}</span>}
                    {partialCount > 0 && <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 99, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700 }}>◑ Partial: {partialCount}</span>}
                    {unpaidCount > 0 && <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 99, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700 }}>✕ Unpaid: {unpaidCount}</span>}
                  </div>
                </div>

                {/* Transaction cards or empty state */}
                {historyRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                    <History size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No transactions found</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Try adjusting the date range</div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {historyRecords.map((f, idx) => {
                      const totalDue = f.isCustom ? Number(f.amount || 0) : (Number(historyStudent.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0));
                      const bal = totalDue - Number(f.amount_paid || 0);
                      const pct = totalDue > 0 ? Math.round((Number(f.amount_paid || 0) / totalDue) * 100) : 0;
                      const isPaid = f.status === 'Paid';
                      const isPartial = f.status === 'Partial';
                      const sc = isPaid ? { border: '#86efac', bg: '#f0fdf4', badge: '#22c55e', badgeTxt: '#fff', label: 'PAID' }
                               : isPartial ? { border: '#fde68a', bg: '#fffbeb', badge: '#f59e0b', badgeTxt: '#fff', label: 'PARTIAL' }
                               : { border: '#fecaca', bg: '#fef2f2', badge: '#ef4444', badgeTxt: '#fff', label: 'UNPAID' };
                      return (
                        <div key={idx} style={{ border: `1px solid ${sc.border}`, background: sc.bg, borderRadius: 14, padding: '14px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{f.isCustom ? f.title : fmtM(f.month)}</div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Paid on: {f.paid_date || 'Not recorded'}</div>
                            </div>
                            <span style={{ background: sc.badge, color: sc.badgeTxt, borderRadius: 8, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>{sc.label}</span>
                          </div>

                          {/* Charge breakdown chips */}
                          {!f.isCustom ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                              <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Monthly: Rs. {Number(historyStudent.monthly_fee||0).toLocaleString()}</span>
                              {Number(f.fine||0) > 0 && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Fine: Rs. {Number(f.fine).toLocaleString()}</span>}
                              {Number(f.paper_fund||0) > 0 && <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Paper Fund: Rs. {Number(f.paper_fund).toLocaleString()}</span>}
                              {Number(f.other_charges||0) > 0 && <span style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Other: Rs. {Number(f.other_charges).toLocaleString()}</span>}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>Custom Charge: {f.title}</span>
                            </div>
                          )}

                          {/* Progress bar + amounts */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: isPaid ? '#22c55e' : isPartial ? '#f59e0b' : '#ef4444', borderRadius: 99, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{pct}%</span>
                            <div style={{ display: 'flex', gap: 14, whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>Paid: Rs. {Number(f.amount_paid||0).toLocaleString()}</span>
                              {bal > 0 && <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700 }}>Due: Rs. {bal.toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════
          PRINT-ONLY: Professional Fee List
          ═══════════════════════════════════════════ */}
      {printFeeList && (
        <div className="print-only">
          {/* Report Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #4318FF', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4318FF', letterSpacing: '-0.02em' }}>Oxford Grammar School</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>Fee Report</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 6, fontSize: 10, color: '#64748b', flexWrap: 'wrap' }}>
              <span>Period: <strong>{fmtM(fromMonth)} – {fmtM(toMonth)}</strong></span>
              <span>Total Students: <strong>{filtered.length}</strong></span>
              <span>Collected: <strong style={{ color: '#059669' }}>Rs. {filteredSummary.collected.toLocaleString()}</strong></span>
              <span>Pending: <strong style={{ color: '#dc2626' }}>Rs. {filteredSummary.pending.toLocaleString()}</strong></span>
              {filterClass && <span>Class: <strong>{classes.find(c => c.id === filterClass)?.class_name}</strong></span>}
              {filterSection && <span>Section: <strong>{sections.find(s => s.id === filterSection)?.section_name}</strong></span>}
              <span>Printed: <strong>{format(new Date(), 'dd MMM yyyy, hh:mm a')}</strong></span>
            </div>
          </div>

          {/* Smart Wrap List Layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((s, idx) => {
              const c = classes.find(cl => cl.id === s.class_id);
              const sec = sections.find(sc => sc.id === s.section_id);
              const p = parents.find(pr => pr.id === s.parent_id);
              const ps = getPeriodStatus(s);
              const arrTotal = getArrearsAmount(s);
              const isPaid = ps.unpaid === 0;

              return (
                <div key={s.id} style={{ borderBottom: '1px solid #000', paddingBottom: 10, pageBreakInside: 'avoid' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 11, color: '#000000' }}>
                    <div style={{ width: '100%', fontSize: 13, fontWeight: 900, marginBottom: 4, color: '#000000' }}>
                      #{idx + 1} - {s.name} (Admission No: {s.roll_no || '-'})
                    </div>
                    {printCols.id && <div style={{ minWidth: 120 }}><strong>ID:</strong> {s.id}</div>}
                    {printCols.status && <div style={{ minWidth: 120 }}><strong>Status:</strong> {isPaid ? 'Paid' : 'Unpaid'}</div>}
                    {printCols.class && <div style={{ minWidth: 120 }}><strong>Class:</strong> {c?.class_name || '-'}</div>}
                    {printCols.section && <div style={{ minWidth: 120 }}><strong>Section:</strong> {sec?.section_name || '-'}</div>}
                    {printCols.monthly_fee && <div style={{ minWidth: 120 }}><strong>Fee:</strong> Rs. {Number(s.monthly_fee || 0).toLocaleString()}</div>}
                    {printCols.period && <div style={{ minWidth: 150 }}><strong>Period:</strong> {fmtM(fromMonth)} – {fmtM(toMonth)}</div>}
                    {printCols.months_paid && <div style={{ minWidth: 120 }}><strong>M. Paid:</strong> {ps.paid}</div>}
                    {printCols.months_unpaid && <div style={{ minWidth: 120 }}><strong>M. Unpaid:</strong> {ps.unpaid}</div>}
                    {printCols.amount_collected && <div style={{ minWidth: 120 }}><strong>Collected:</strong> Rs. {ps.paidAmt.toLocaleString()}</div>}
                    {printCols.amount_pending && <div style={{ minWidth: 120 }}><strong>Pending:</strong> Rs. {ps.unpaidAmt.toLocaleString()}</div>}
                    {printCols.arrears && <div style={{ minWidth: 120 }}><strong>Arrears:</strong> Rs. {arrTotal.toLocaleString()}</div>}
                    {printCols.father_name && <div style={{ minWidth: 120 }}><strong>Father:</strong> {p?.father_name || '-'}</div>}
                    {printCols.father_cnic && <div style={{ minWidth: 120 }}><strong>F. CNIC:</strong> {p?.father_cnic || '-'}</div>}
                    {printCols.father_contact && <div style={{ minWidth: 120 }}><strong>F. Contact:</strong> {p?.father_contact || '-'}</div>}
                    {printCols.address && <div style={{ minWidth: 180 }}><strong>Address:</strong> {s?.address || '-'}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Print Footer */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            <span>Total: {filtered.length} students | Period: {fmtM(fromMonth)} – {fmtM(toMonth)}</span>
            <span>Collected: Rs. {filteredSummary.collected.toLocaleString()} | Pending: Rs. {filteredSummary.pending.toLocaleString()}</span>
            <span>Oxford Grammar School — Printed: {format(new Date(), 'dd/MM/yyyy hh:mm a')}</span>
          </div>
        </div>
      )}

      {/* PRINT-ONLY: History Student Invoice */}
      {printHistoryStudent && historyStudent && (() => {
        const hPaid = historyRecords.reduce((s, f) => s + Number(f.amount_paid || 0), 0);
        const hDue = historyRecords.reduce((s, f) => {
          if (f.isCustom) return s + Number(f.amount || 0);
          return s + Number(historyStudent.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0);
        }, 0);
        const hPending = Math.max(0, hDue - hPaid);
        const parent = parents.find(p => p.id === historyStudent.parent_id);

        return (
          <div className="print-only" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#000', letterSpacing: '-0.02em' }}>Oxford Grammar School</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#000', marginTop: 4, textTransform: 'uppercase' }}>Transaction History Ledger</div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#000' }}>
                Period: {fmtM(histFromMonth)} – {fmtM(histToMonth)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{historyStudent.name}</div>
                <div><strong>ID / Admission No:</strong> {historyStudent.id} / {historyStudent.roll_no}</div>
                <div><strong>Class:</strong> {getClass(historyStudent.class_id)?.class_name} – {getSection(historyStudent.section_id)?.section_name}</div>
                <div><strong>Monthly Fee:</strong> Rs. {Number(historyStudent.monthly_fee||0).toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{parent?.father_name || '-'}</div>
                <div><strong>Contact:</strong> {parent?.father_contact || '-'}</div>
                <div><strong>Address:</strong> {historyStudent?.address || '-'}</div>
                <div style={{ marginTop: 8 }}><strong>Printed:</strong> {format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, border: '1px solid #000', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#000', fontWeight: 700, textTransform: 'uppercase' }}>Total Charged</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>Rs. {hDue.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, border: '1px solid #000', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#000', fontWeight: 700, textTransform: 'uppercase' }}>Total Paid</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>Rs. {hPaid.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, border: '1px solid #000', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#000', fontWeight: 700, textTransform: 'uppercase' }}>Balance Due</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>Rs. {hPending.toLocaleString()}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Date</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Description (Mad)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Total Due</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Amount Paid</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Arrears</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, border: '1px solid #000', color: '#000', fontWeight: 'bold' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#000', border: '1px solid #000' }}>No transactions found in this period.</td></tr>
                ) : historyRecords.map((f, idx) => {
                  const totalDue = f.isCustom ? Number(f.amount || 0) : (Number(historyStudent.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0));
                  const paid = Number(f.amount_paid || 0);
                  const arrear = Math.max(0, totalDue - paid);
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #000', whiteSpace: 'nowrap', color: '#000' }}>{f.paid_date || '-'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, border: '1px solid #000', color: '#000' }}>{f.isCustom ? `Custom Charge: ${f.title}` : `Monthly Fee: ${fmtM(f.month)}`}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontWeight: 700, border: '1px solid #000', color: '#000' }}>{totalDue.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontWeight: 600, border: '1px solid #000', color: '#000' }}>{paid.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontWeight: 600, border: '1px solid #000', color: '#000' }}>{arrear.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'center', border: '1px solid #000', color: '#000' }}>
                        {arrear === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
