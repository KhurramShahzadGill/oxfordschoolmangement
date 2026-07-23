import React, { useState, useEffect, useMemo } from 'react';
import {
  apiStudents, apiClasses, apiSections, apiParents, apiFees, apiCustomCharges,
  apiStudentHistory, newMonthlyFee, getSettings,
} from '../services/db';
import {
  GraduationCap, ArrowRight, Search, AlertTriangle, CheckCircle2, X, RefreshCw, Printer,
} from 'lucide-react';
import { format } from 'date-fns';

/*
 * Class Promotion — a module of its own.
 *
 * Moving students to the next class is one of the biggest jobs of the school
 * year, so it gets a full screen instead of a button on the Students page.
 *
 * The screen reads top to bottom: where the students are coming from and going
 * to, what happens to their fee, who exactly is moving, and then one action.
 * Nothing is listed until a class AND a section are chosen, so staff never see
 * a wall of unrelated students.
 *
 *   whole class          -> pick the class, section "All sections"
 *   one section          -> pick the class and that section
 *   individual students  -> pick the class and section, then tick only those
 *
 * Promotion cannot be undone, so a full review step comes before it is saved,
 * and the same summary can be printed (or saved as PDF) as a school record.
 */

const ALL_SECTIONS = 'ALL';

const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString()}`;

// Unpaid dues per student: every month from the fee start date that is still
// short, plus any unpaid one-time charge. Same rule as the Fees page.
const computeDues = (students, fees, charges) => {
  const thisMonth = format(new Date(), 'yyyy-MM');
  const dues = {};
  students.forEach(s => {
    let owed = 0;
    let m = s.fee_start_month;
    let guard = 0;
    while (m && m <= thisMonth && guard < 600) {
      const rec = fees.find(f => f.student_id === s.id && f.month === m);
      const due = Number(rec?.monthly_fee ?? s.monthly_fee ?? 0)
        + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
      const balance = due - Number(rec?.amount_paid || 0);
      if (balance > 0) owed += balance;
      const [y, mo] = m.split('-').map(Number);
      m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      guard++;
    }
    charges.filter(c => c.student_id === s.id).forEach(c => {
      const balance = Number(c.amount || 0) - Number(c.amount_paid || 0);
      if (balance > 0) owed += balance;
    });
    dues[s.id] = owed;
  });
  return dues;
};

export default function Promotion() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [parents, setParents] = useState([]);
  const [dues, setDues] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Where from
  const [fromClass, setFromClass] = useState('');
  const [fromSection, setFromSection] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState({});   // studentId -> true

  // Where to, and the new fee
  const [toClass, setToClass] = useState('');
  const [toSection, setToSection] = useState('');
  const [feeMode, setFeeMode] = useState('none');   // 'none' | 'percent' | 'amount'
  const [feeValue, setFeeValue] = useState('');

  // Review / confirm / print
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [result, setResult] = useState(null);
  const [printData, setPrintData] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [st, cl, sec, par] = await Promise.all([
        apiStudents.getAll(), apiClasses.getAll(), apiSections.getAll(), apiParents.getAll(),
      ]);
      setStudents(st);
      setClasses(cl);
      setSections(sec);
      setParents(par);
      // Dues and the activity log are helpful extras — never block the screen
      // (or a promotion) if either one fails to load.
      try {
        const [fees, charges] = await Promise.all([apiFees.getAll(), apiCustomCharges.getAll()]);
        setDues(computeDues(st, fees, charges));
      } catch { setDues({}); }
      try { setHistory(await apiStudentHistory.getRecent(15)); } catch { setHistory([]); }
    } catch (err) {
      setLoadError(err.message || 'Could not load the school data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const className = (id) => classes.find(c => c.id === id)?.class_name || '—';
  const sectionName = (id) => sections.find(s => s.id === id)?.section_name || '—';
  const studentName = (id) => students.find(s => s.id === id)?.name || 'Student';
  const parentOf = (s) => parents.find(p => p.id === s.parent_id);

  const ready = Boolean(fromClass && fromSection);

  // Nothing is listed until both the class and the section are chosen.
  const candidates = useMemo(() => {
    if (!fromClass || !fromSection) return [];
    return students.filter(s =>
      s.status === 'Active' &&
      s.class_id === fromClass &&
      (fromSection === ALL_SECTIONS || s.section_id === fromSection)
    );
  }, [students, fromClass, fromSection]);

  // Choosing a class and section means "everyone in it", which is what a school
  // does most of the time; single students are then unticked (or ticked alone).
  const pickAllIn = (classId, sectionId) => {
    if (!classId || !sectionId) return {};
    const ids = students
      .filter(s => s.status === 'Active' && s.class_id === classId &&
        (sectionId === ALL_SECTIONS || s.section_id === sectionId))
      .map(s => s.id);
    return Object.fromEntries(ids.map(id => [id, true]));
  };

  // Someone already sitting in the destination cannot be "promoted" into it.
  const isAlreadyThere = (s) => Boolean(toClass && toSection && s.class_id === toClass && s.section_id === toSection);

  // Same search as the Students page: the student's own details or either
  // parent's name, CNIC or phone number.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    const has = (v) => String(v || '').toLowerCase().includes(q);
    return candidates.filter(s => {
      const p = parents.find(pr => pr.id === s.parent_id);
      return has(s.name) || has(s.id) || has(s.roll_no) ||
        has(p?.father_name) || has(p?.mother_name) ||
        has(p?.father_cnic) || has(p?.mother_cnic) ||
        has(p?.father_contact) || has(p?.mother_contact);
    });
  }, [candidates, parents, search]);

  const selected = candidates.filter(s => picked[s.id] && !isAlreadyThere(s));
  const hiddenSelected = selected.length - visible.filter(s => picked[s.id] && !isAlreadyThere(s)).length;

  const withDues = selected.filter(s => (dues[s.id] || 0) > 0);
  const duesTotal = withDues.reduce((sum, s) => sum + (dues[s.id] || 0), 0);
  const feeNow = selected.reduce((sum, s) => sum + Math.round(Number(s.monthly_fee) || 0), 0);
  const feeNext = selected.reduce((sum, s) => sum + newMonthlyFee(s.monthly_fee, feeMode, feeValue), 0);

  const fromSections = sections.filter(s => s.class_id === fromClass);
  const toSections = sections.filter(s => s.class_id === toClass);
  const noSectionsForTarget = Boolean(toClass) && toSections.length === 0;
  const canPromote = Boolean(toClass && toSection) && selected.length > 0 && !saving;

  const sourceLabel = fromClass && fromSection
    ? `${className(fromClass)}${fromSection === ALL_SECTIONS ? ' — all sections' : ` (${sectionName(fromSection)})`}`
    : '';
  const targetLabel = toClass && toSection ? `${className(toClass)} (${sectionName(toSection)})` : '';

  const feeLine = feeMode === 'none'
    ? 'Fees stay the same'
    : feeMode === 'percent'
      ? `Fees +${Number(feeValue) || 0}%`
      : `Fees +${rs(feeValue)}`;

  const resetAll = () => {
    setFromClass(''); setFromSection(''); setSearch(''); setPicked({});
    setToClass(''); setToSection(''); setFeeMode('none'); setFeeValue('');
    setSaveError('');
  };

  // One row per student for both the on-screen review and the printed summary.
  const summaryRows = (list) => list.map((s, i) => {
    const p = parentOf(s);
    return {
      no: i + 1,
      id: s.id,
      roll_no: s.roll_no || '—',
      name: s.name || '—',
      father: p?.father_name || '—',
      mother: p?.mother_name || '—',
      from: `${className(s.class_id)} (${sectionName(s.section_id)})`,
      oldFee: Math.round(Number(s.monthly_fee) || 0),
      newFee: newMonthlyFee(s.monthly_fee, feeMode, feeValue),
      due: dues[s.id] || 0,
    };
  });

  // Print (or save as PDF) the summary. `status` marks whether the promotion has
  // already been saved, so the printed sheet can never be mistaken for the other.
  const handlePrint = (status) => {
    setPrintData({
      status,
      from: sourceLabel,
      to: targetLabel,
      feeLine,
      rows: summaryRows(selected),
      feeNow, feeNext,
      duesCount: withDues.length,
      duesTotal,
    });
    document.body.classList.add('print-mode');
    setTimeout(() => window.print(), 250);
    setTimeout(() => {
      setPrintData(null);
      document.body.classList.remove('print-mode');
    }, 1200);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setSaveError('');
    // Snapshot before the reload, so the success screen can show what happened.
    const rows = summaryRows(selected);
    try {
      await apiStudents.bulkPromote({
        studentIds: selected.map(s => s.id),
        toClassId: toClass,
        toSectionId: toSection,
        feeMode,
        feeValue: Number(feeValue) || 0,
      });
      setResult({
        rows, from: sourceLabel, to: targetLabel, feeLine,
        feeNow, feeNext, duesCount: withDues.length, duesTotal,
      });
      setReviewing(false);
      setSaving(false);
      resetAll();
      load();
    } catch (err) {
      setSaving(false);
      setSaveError(err.message || 'The promotion could not be completed.');
    }
  };

  // Reprint from the success screen, where the selection has already been reset.
  const printResult = () => {
    if (!result) return;
    setPrintData({ status: 'done', ...result });
    document.body.classList.add('print-mode');
    setTimeout(() => window.print(), 250);
    setTimeout(() => {
      setPrintData(null);
      document.body.classList.remove('print-mode');
    }, 1200);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-secondary)' }}>
        Loading students…
      </div>
    );
  }

  const feeOptions = [
    { key: 'none', label: 'Keep the same' },
    { key: 'percent', label: 'Increase by percentage' },
    { key: 'amount', label: 'Increase by fixed amount' },
  ];

  return (
    <div>
      <div className="no-print">
        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-6" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="text-2xl font-bold">Class Promotion</h1>
            <p className="text-sm text-secondary-color" style={{ marginTop: 3 }}>
              Move a class, a section, or selected students to their next class.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={load} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loadError && (
          <div className="promo-note promo-note-error mb-4">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{loadError}</span>
          </div>
        )}

        {/* ── From → To ── */}
        <div className="promo-card">
          <div className="promo-pad">
            <div className="promo-route">
              <div>
                <label className="promo-label">From Class</label>
                <select className="form-select promo-field" value={fromClass}
                  onChange={e => {
                    setFromClass(e.target.value);
                    setFromSection('');
                    setPicked({});
                    setSearch('');
                  }}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="promo-label">From Section</label>
                <select className="form-select promo-field" value={fromSection} disabled={!fromClass}
                  onChange={e => {
                    setFromSection(e.target.value);
                    setPicked(pickAllIn(fromClass, e.target.value));
                  }}>
                  <option value="">Select section</option>
                  <option value={ALL_SECTIONS}>All sections</option>
                  {fromSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                </select>
              </div>
              <div className="promo-arrow"><ArrowRight size={18} /></div>
              <div>
                <label className="promo-label">To Class</label>
                <select className="form-select promo-field" value={toClass}
                  onChange={e => { setToClass(e.target.value); setToSection(''); }}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="promo-label">To Section</label>
                <select className="form-select promo-field" value={toSection} disabled={!toClass}
                  onChange={e => setToSection(e.target.value)}>
                  <option value="">Select section</option>
                  {toSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                </select>
              </div>
            </div>

            {noSectionsForTarget && (
              <div className="promo-note promo-note-warn" style={{ marginTop: 16 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This class has no sections yet. Add one on the Classes page first.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── New fee: all choices on one line ── */}
        <div className="promo-card">
          <div className="promo-pad promo-fee">
            <span className="promo-label" style={{ marginBottom: 0 }}>New Monthly Fee</span>
            {feeOptions.map(opt => (
              <label key={opt.key} className="promo-choice">
                <input type="radio" name="feeMode" className="promo-check" checked={feeMode === opt.key}
                  onChange={() => { setFeeMode(opt.key); setFeeValue(''); }} />
                {opt.label}
              </label>
            ))}
            {feeMode !== 'none' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" className="form-input promo-field" style={{ width: 120 }}
                  placeholder={feeMode === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                  value={feeValue} onChange={e => setFeeValue(e.target.value)} />
                <span className="text-sm text-secondary-color">{feeMode === 'percent' ? '%' : 'Rs.'}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Students ── */}
        <div className="promo-card">
          <div className="promo-head" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div className="promo-title">
                Students
                {ready && (
                  <span className="text-secondary-color" style={{ fontWeight: 400 }}>
                    {' '}· {selected.length} of {candidates.length} selected
                    {hiddenSelected > 0 && ` · ${hiddenSelected} not shown by this search`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="promo-link" disabled={!ready}
                  onClick={() => setPicked(prev => {
                    const next = { ...prev };
                    visible.forEach(s => { if (!isAlreadyThere(s)) next[s.id] = true; });
                    return next;
                  })}>
                  Select all
                </button>
                <button className="promo-link" disabled={!ready} style={{ color: ready ? 'var(--text-secondary)' : undefined }}
                  onClick={() => setPicked({})}>
                  Clear
                </button>
              </div>
            </div>
            <div style={{ position: 'relative', marginTop: 12 }}>
              <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="form-input promo-field" style={{ paddingLeft: 38, width: '100%' }}
                placeholder="Search by Student ID, Admission No, Name, Parent CNIC, Phone or Father/Mother Name..."
                disabled={!ready} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {!ready ? (
            <div className="promo-empty">
              Choose the class and section you want to move students from.
            </div>
          ) : visible.length === 0 ? (
            <div className="promo-empty">
              {search ? 'No student matches this search.' : 'No active students in this class and section.'}
            </div>
          ) : visible.map(s => {
            const here = isAlreadyThere(s);
            const on = Boolean(picked[s.id]) && !here;
            const due = dues[s.id] || 0;
            const p = parentOf(s);
            const oldFee = Math.round(Number(s.monthly_fee) || 0);
            const nextFee = newMonthlyFee(oldFee, feeMode, feeValue);
            return (
              <div key={s.id} className={`promo-row ${here ? 'is-blocked' : ''}`}
                onClick={() => { if (!here) setPicked(prev => ({ ...prev, [s.id]: !prev[s.id] })); }}>
                <input type="checkbox" className="promo-check" checked={on} disabled={here} readOnly />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="promo-row-name">{s.name || '—'}</div>
                  <div className="promo-row-meta">
                    ID {s.id} · Adm {s.roll_no || '—'} · {className(s.class_id)} ({sectionName(s.section_id)})
                    {due > 0 && <span className="promo-due"> · Dues {rs(due)}</span>}
                    {here && ' · already in the destination'}
                  </div>
                  {(p?.father_name || p?.mother_name) && (
                    <div className="promo-row-meta">
                      {p?.father_name && <>F/O {p.father_name}</>}
                      {p?.father_name && p?.mother_name && ' · '}
                      {p?.mother_name && <>M/O {p.mother_name}</>}
                    </div>
                  )}
                </div>
                <div className="promo-row-fee">
                  {rs(oldFee)}
                  {on && nextFee !== oldFee && (
                    <> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{rs(nextFee)}</span></>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Action bar ── */}
        <div className="promo-bar">
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            {selected.length > 0 && targetLabel ? (
              <>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {selected.length} student{selected.length !== 1 ? 's' : ''} · {sourceLabel} → {targetLabel}
                </div>
                <div className="text-xs text-secondary-color" style={{ marginTop: 3 }}>
                  {feeLine}
                  {feeNext !== feeNow && ` · monthly total ${rs(feeNow)} → ${rs(feeNext)}`}
                  {withDues.length > 0 && ` · ${withDues.length} with unpaid dues (${rs(duesTotal)})`}
                </div>
              </>
            ) : (
              <div className="text-sm text-secondary-color">
                Choose where the students are moving from and to, then select the students.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button className="btn btn-secondary" disabled={!canPromote} style={{ fontSize: '0.85rem' }}
              onClick={() => handlePrint('draft')}>
              <Printer size={15} /> Print Summary
            </button>
            <button className="promo-cta" disabled={!canPromote} onClick={() => { setSaveError(''); setReviewing(true); }}>
              <GraduationCap size={16} /> Review &amp; Promote
            </button>
          </div>
        </div>

        {/* ── Recent promotions ── */}
        {history.length > 0 && (
          <div className="promo-card" style={{ marginTop: 16 }}>
            <div className="promo-head">
              <div className="promo-title">Recent promotions</div>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 24px', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{studentName(h.student_id)}</span>
                    <span className="text-secondary-color">
                      {' — '}{className(h.from_class_id)} ({sectionName(h.from_section_id)})
                      {' → '}{className(h.to_class_id)} ({sectionName(h.to_section_id)})
                    </span>
                  </span>
                  <span className="text-secondary-color" style={{ whiteSpace: 'nowrap' }}>{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Review ── */}
        {reviewing && (
          <div className="promo-backdrop" onClick={() => !saving && setReviewing(false)}>
            <div className="promo-modal" onClick={e => e.stopPropagation()}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>Confirm promotion</div>
                  <div className="text-xs text-secondary-color" style={{ marginTop: 3 }}>
                    Please check the details — this cannot be undone.
                  </div>
                </div>
                <button onClick={() => !saving && setReviewing(false)}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <div>
                    <div className="promo-label">From</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sourceLabel}</div>
                  </div>
                  <ArrowRight size={17} style={{ color: '#cbd5e1', marginTop: 14 }} />
                  <div>
                    <div className="promo-label">To</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{targetLabel}</div>
                  </div>
                </div>

                <div className="text-sm" style={{ marginBottom: 4 }}>
                  <strong>{selected.length}</strong> student{selected.length !== 1 ? 's' : ''} will be moved.
                </div>
                <div className="text-sm text-secondary-color" style={{ marginBottom: 16 }}>
                  {feeMode === 'none' ? 'Monthly fees stay the same.'
                    : `${feeLine} — monthly total ${rs(feeNow)} → ${rs(feeNext)}.`}
                </div>

                {withDues.length > 0 && (
                  <div className="promo-note promo-note-warn" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      {withDues.length} of them still owe {rs(duesTotal)}. Promoting does not clear those dues — they stay on the student's account.
                    </span>
                  </div>
                )}

                {saveError && (
                  <div className="promo-note promo-note-error" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{saveError}</span>
                  </div>
                )}

                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {summaryRows(selected).map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 500 }}>{r.name}</span>
                        <span className="text-secondary-color"> · {r.from}{r.father !== '—' ? ` · F/O ${r.father}` : ''}</span>
                      </span>
                      <span className="text-secondary-color" style={{ whiteSpace: 'nowrap' }}>
                        {rs(r.oldFee)}
                        {r.newFee !== r.oldFee && <> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{rs(r.newFee)}</span></>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" disabled={saving} onClick={() => handlePrint('draft')}>
                  <Printer size={15} /> Print
                </button>
                <button className="btn btn-secondary" disabled={saving} onClick={() => setReviewing(false)}>Go back</button>
                <button className="promo-cta" disabled={saving} onClick={handleConfirm}>
                  {saving ? 'Promoting…' : `Promote ${selected.length} student${selected.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {result && (
          <div className="promo-backdrop" onClick={() => setResult(null)}>
            <div className="promo-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '26px 24px 16px', textAlign: 'center' }}>
                <CheckCircle2 size={34} color="var(--success)" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {result.rows.length} student{result.rows.length !== 1 ? 's' : ''} promoted
                </div>
                <div className="text-sm text-secondary-color" style={{ marginTop: 4 }}>
                  {result.from} → <strong style={{ color: 'var(--text-primary)' }}>{result.to}</strong> · {result.feeLine}
                </div>
              </div>
              <div style={{ padding: '0 24px', maxHeight: 240, overflowY: 'auto' }}>
                {result.rows.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                    <span className="text-secondary-color" style={{ whiteSpace: 'nowrap' }}>
                      {rs(r.oldFee)}
                      {r.newFee !== r.oldFee && <> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{rs(r.newFee)}</span></>}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button className="btn btn-secondary" onClick={printResult}>
                  <Printer size={15} /> Print Summary
                </button>
                <button className="promo-cta" onClick={() => setResult(null)}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          PRINT-ONLY: Promotion Summary (A4 / PDF)
          ═══════════════════════════════════════════ */}
      {printData && (
        <div className="print-only">
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #4318FF', paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4318FF', letterSpacing: '-0.02em' }}>
              {getSettings().school_name}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
              Class Promotion Summary
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
              {printData.status === 'done'
                ? 'Record of a completed promotion'
                : 'Proposed promotion — not yet applied'}
              {' · '}Printed: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
            </div>
          </div>

          {/* Summary box */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc', width: '18%' }}><strong>From</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', width: '32%' }}>{printData.from}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc', width: '18%' }}><strong>To</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', width: '32%' }}>{printData.to}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc' }}><strong>Students</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>{printData.rows.length}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc' }}><strong>Fee Rule</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>{printData.feeLine}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc' }}><strong>Monthly Total</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>
                  {rs(printData.feeNow)}{printData.feeNext !== printData.feeNow && ` → ${rs(printData.feeNext)}`}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', background: '#f8fafc' }}><strong>Unpaid Dues</strong></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>
                  {printData.duesCount > 0 ? `${rs(printData.duesTotal)} (${printData.duesCount} student${printData.duesCount !== 1 ? 's' : ''})` : 'None'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Student table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#4318FF', color: '#ffffff' }}>
                <th style={printTh}>#</th>
                <th style={printTh}>ID</th>
                <th style={printTh}>Adm No</th>
                <th style={{ ...printTh, textAlign: 'left' }}>Student Name</th>
                <th style={{ ...printTh, textAlign: 'left' }}>Father Name</th>
                <th style={{ ...printTh, textAlign: 'left' }}>Mother Name</th>
                <th style={{ ...printTh, textAlign: 'left' }}>From</th>
                <th style={{ ...printTh, textAlign: 'right' }}>Current Fee</th>
                <th style={{ ...printTh, textAlign: 'right' }}>New Fee</th>
                <th style={{ ...printTh, textAlign: 'right' }}>Dues</th>
              </tr>
            </thead>
            <tbody>
              {printData.rows.map(r => (
                <tr key={r.id} style={{ pageBreakInside: 'avoid' }}>
                  <td style={printTd}>{r.no}</td>
                  <td style={printTd}>{r.id}</td>
                  <td style={printTd}>{r.roll_no}</td>
                  <td style={{ ...printTd, textAlign: 'left', fontWeight: 700 }}>{r.name}</td>
                  <td style={{ ...printTd, textAlign: 'left' }}>{r.father}</td>
                  <td style={{ ...printTd, textAlign: 'left' }}>{r.mother}</td>
                  <td style={{ ...printTd, textAlign: 'left' }}>{r.from}</td>
                  <td style={{ ...printTd, textAlign: 'right' }}>{r.oldFee.toLocaleString()}</td>
                  <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }}>{r.newFee.toLocaleString()}</td>
                  <td style={{ ...printTd, textAlign: 'right' }}>{r.due > 0 ? r.due.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f1f5f9' }}>
                <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }} colSpan={7}>Total</td>
                <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }}>{printData.feeNow.toLocaleString()}</td>
                <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }}>{printData.feeNext.toLocaleString()}</td>
                <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }}>{printData.duesTotal > 0 ? printData.duesTotal.toLocaleString() : '—'}</td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 30, marginTop: 40, fontSize: 10 }}>
            <div style={{ flex: 1, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>Prepared By</div>
            <div style={{ flex: 1, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>Checked By</div>
            <div style={{ flex: 1, borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>Principal</div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
            <span>{printData.rows.length} student{printData.rows.length !== 1 ? 's' : ''} · {printData.from} → {printData.to}</span>
            <span>{getSettings().school_name} — Confidential Record</span>
          </div>
        </div>
      )}
    </div>
  );
}

const printTh = {
  padding: '6px 6px',
  fontSize: 9,
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: '0.03em',
  border: '1px solid #4318FF',
  whiteSpace: 'nowrap',
};

const printTd = {
  padding: '5px 6px',
  fontSize: 9.5,
  textAlign: 'center',
  border: '1px solid #cbd5e1',
  color: '#000000',
  verticalAlign: 'top',
};
