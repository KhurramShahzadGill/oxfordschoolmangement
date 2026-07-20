import React, { useState, useMemo } from 'react';
import { X, ArrowRight, AlertTriangle, GraduationCap } from 'lucide-react';
import { apiStudents, newMonthlyFee } from '../services/db';

/*
 * Promote a whole class in one step.
 *
 * Promotion is hard to undo, so the screen is built around review rather than
 * speed: staff pick where students are moving from and to, see every student
 * with their current and new fee, untick anyone who should stay behind, and get
 * a plain-language summary (plus a warning for anyone with dues) before the
 * final confirm.
 */
export default function PromoteClassModal({ isOpen, onClose, students, classes, sections, outstandingOf, onDone }) {
  const [fromClass, setFromClass] = useState('');
  const [fromSection, setFromSection] = useState('');
  const [toClass, setToClass] = useState('');
  const [toSection, setToSection] = useState('');
  const [feeMode, setFeeMode] = useState('none');   // 'none' | 'percent' | 'amount'
  const [feeValue, setFeeValue] = useState('');
  const [excluded, setExcluded] = useState({});      // studentId -> true (stays behind)
  const [saving, setSaving] = useState(false);

  const className = (id) => classes.find(c => c.id === id)?.class_name || '';
  const sectionName = (id) => sections.find(s => s.id === id)?.section_name || '';

  // Students currently sitting in the chosen class (and section, if picked).
  const candidates = useMemo(() => students.filter(s =>
    s.status === 'Active' &&
    s.class_id === fromClass &&
    (!fromSection || s.section_id === fromSection)
  ), [students, fromClass, fromSection]);

  const selected = candidates.filter(s => !excluded[s.id]);
  const sameTarget = fromClass && toClass && fromClass === toClass && (fromSection || '') === (toSection || '');
  const withDues = selected.filter(s => (outstandingOf?.(s) || 0) > 0);
  const canPromote = fromClass && toClass && toSection && selected.length > 0 && !sameTarget && !saving;

  const reset = () => {
    setFromClass(''); setFromSection(''); setToClass(''); setToSection('');
    setFeeMode('none'); setFeeValue(''); setExcluded({}); setSaving(false);
  };

  const close = () => { reset(); onClose(); };

  const handleConfirm = async () => {
    const feeLine = feeMode === 'none' ? 'Fees stay unchanged.'
      : feeMode === 'percent' ? `Fees increase by ${Number(feeValue) || 0}%.`
      : `Fees increase by Rs. ${Number(feeValue) || 0}.`;
    const duesLine = withDues.length ? `\n\n⚠ ${withDues.length} of them still have unpaid dues.` : '';

    const ok = window.confirm(
      `Promote ${selected.length} student${selected.length !== 1 ? 's' : ''}?\n\n` +
      `From: ${className(fromClass)}${fromSection ? ` (${sectionName(fromSection)})` : ' — all sections'}\n` +
      `To:   ${className(toClass)} (${sectionName(toSection)})\n\n` +
      `${feeLine}${duesLine}\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setSaving(true);
    try {
      await apiStudents.bulkPromote({
        studentIds: selected.map(s => s.id),
        toClassId: toClass,
        toSectionId: toSection,
        feeMode,
        feeValue: Number(feeValue) || 0,
      });
      alert(`${selected.length} student${selected.length !== 1 ? 's' : ''} promoted to ${className(toClass)} (${sectionName(toSection)}).`);
      reset();
      onClose();
      onDone && onDone();
    } catch (err) {
      setSaving(false);
      alert('Could not complete the promotion:\n\n' + err.message);
    }
  };

  if (!isOpen) return null;

  const selStyle = { padding: '9px 12px', fontSize: '0.875rem', width: '100%' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#4318FF 0%,#3311DB 100%)', padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={19} /> Promote Class
            </div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              Move a whole class up — untick anyone who should stay behind
            </div>
          </div>
          <button onClick={close} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 7, cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>

          {/* From -> To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 1fr 1fr', gap: 12, alignItems: 'end', marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>From Class</label>
              <select className="form-select" style={selStyle} value={fromClass}
                onChange={e => { setFromClass(e.target.value); setFromSection(''); setExcluded({}); }}>
                <option value="">Select</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>From Section</label>
              <select className="form-select" style={selStyle} value={fromSection} disabled={!fromClass}
                onChange={e => { setFromSection(e.target.value); setExcluded({}); }}>
                <option value="">All sections</option>
                {sections.filter(s => s.class_id === fromClass).map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
            </div>
            <div style={{ paddingBottom: 10, color: 'var(--primary)' }}><ArrowRight size={20} /></div>
            <div>
              <label style={labelStyle}>To Class</label>
              <select className="form-select" style={selStyle} value={toClass}
                onChange={e => { setToClass(e.target.value); setToSection(''); }}>
                <option value="">Select</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>To Section</label>
              <select className="form-select" style={selStyle} value={toSection} disabled={!toClass}
                onChange={e => setToSection(e.target.value)}>
                <option value="">Select</option>
                {sections.filter(s => s.class_id === toClass).map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
            </div>
          </div>

          {sameTarget && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} /> The students are already in this class and section — choose a different destination.
            </div>
          )}

          {/* Fee rule */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
            <label style={labelStyle}>New Monthly Fee</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { key: 'none', label: 'Keep the same' },
                { key: 'percent', label: 'Increase by %' },
                { key: 'amount', label: 'Increase by Rs.' },
              ].map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="feeMode" checked={feeMode === opt.key}
                    onChange={() => { setFeeMode(opt.key); setFeeValue(''); }} />
                  {opt.label}
                </label>
              ))}
              {feeMode !== 'none' && (
                <input type="number" className="form-input" placeholder={feeMode === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                  style={{ width: 130, padding: '7px 10px', fontSize: '0.85rem' }}
                  value={feeValue} onChange={e => setFeeValue(e.target.value)} />
              )}
            </div>
            <div className="text-xs text-secondary-color" style={{ marginTop: 8 }}>
              Applies to everyone being promoted. Individual students can still be edited afterwards.
            </div>
          </div>

          {/* Student list */}
          {!fromClass ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Choose a class above to see its students.
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No active students found in this class.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selected.length} of {candidates.length} selected
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setExcluded({})} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontSize: '0.76rem', fontWeight: 600 }}>Select all</button>
                  <button onClick={() => setExcluded(Object.fromEntries(candidates.map(s => [s.id, true])))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.76rem', fontWeight: 600 }}>Clear all</button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                {candidates.map((s, idx) => {
                  const on = !excluded[s.id];
                  const due = outstandingOf?.(s) || 0;
                  const oldFee = Math.round(Number(s.monthly_fee) || 0);
                  const newFee = newMonthlyFee(oldFee, feeMode, feeValue);
                  return (
                    <label key={s.id}
                      onClick={() => setExcluded(prev => ({ ...prev, [s.id]: on }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', cursor: 'pointer', borderTop: idx ? '1px solid var(--border-color)' : 'none', background: on ? 'white' : '#f8fafc', opacity: on ? 1 : 0.6 }}>
                      <input type="checkbox" checked={on} readOnly style={{ cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.name || '—'}
                          {due > 0 && (
                            <span title={`Unpaid dues: Rs. ${due.toLocaleString()}`} style={{ marginLeft: 8, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 99, padding: '1px 8px', fontSize: '0.66rem', fontWeight: 700 }}>
                              Dues Rs. {due.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          ID {s.id} · Adm {s.roll_no || '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        Rs. {oldFee.toLocaleString()}
                        {newFee !== oldFee && (
                          <> <span style={{ color: 'var(--text-secondary)' }}>→</span> <strong style={{ color: 'var(--success)' }}>Rs. {newFee.toLocaleString()}</strong></>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer summary + confirm */}
        <div style={{ padding: '14px 26px', borderTop: '1px solid var(--border-color)', background: '#f8fafc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {selected.length > 0 && toClass && toSection && !sameTarget ? (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>{selected.length} student{selected.length !== 1 ? 's' : ''}</strong>
                {' '}→ {className(toClass)} ({sectionName(toSection)})
                {withDues.length > 0 && (
                  <span style={{ color: '#b91c1c', marginLeft: 8 }}>· {withDues.length} with unpaid dues</span>
                )}
              </>
            ) : 'Select a class, a destination and at least one student.'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={close} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
            <button onClick={handleConfirm} disabled={!canPromote}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7,
                background: canPromote ? 'linear-gradient(135deg,#4318FF,#3311DB)' : '#cbd5e1',
                color: 'white', cursor: canPromote ? 'pointer' : 'not-allowed' }}>
              <GraduationCap size={15} /> {saving ? 'Promoting…' : 'Review & Promote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
