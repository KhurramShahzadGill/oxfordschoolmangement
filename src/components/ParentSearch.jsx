import React, { useState, useRef, useEffect } from 'react';
import { Search as SearchIcon, X, Users } from 'lucide-react';

/*
 * Reusable parent finder with autocomplete.
 * Type a parent's Name / CNIC / Contact / ID — matching parents appear as
 * suggestions WITH their CNIC + contact so same-name parents can be told apart.
 * Picking one calls onSelect(parent); the chosen parent shows as a chip.
 */
export default function ParentSearch({ parents = [], students = [], selected, onSelect, onClear, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const childCount = (pid) => students.filter(s => s.parent_id === pid).length;

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const matches = !q ? [] : parents.map(p => {
    const kids = students.filter(s => s.parent_id === p.id);
    const byName = (p.father_name || '').toLowerCase().includes(q) || (p.mother_name || '').toLowerCase().includes(q);
    const byId = (p.id || '').toLowerCase().includes(q);
    const byCnic = qDigits && ((p.father_cnic || '').replace(/\D/g, '').includes(qDigits) || (p.mother_cnic || '').replace(/\D/g, '').includes(qDigits));
    const byContact = qDigits && ((p.father_contact || '').replace(/\D/g, '').includes(qDigits) || (p.mother_contact || '').replace(/\D/g, '').includes(qDigits));
    // Also match by any child's name so "type any child" surfaces the whole family
    const matchedChild = kids.find(k => (k.name || '').toLowerCase().includes(q));
    return (byName || byId || byCnic || byContact || matchedChild) ? { p, matchedChild } : null;
  }).filter(Boolean).slice(0, 8);

  const pick = (p) => { onSelect && onSelect(p); setQuery(''); setOpen(false); };
  const clear = () => { setQuery(''); setOpen(false); onClear && onClear(); };

  // Selected state → show a chip instead of the input
  if (selected) {
    const count = childCount(selected.id);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '8px 12px' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3730a3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected.father_name || selected.mother_name || 'Parent'}
            <span style={{ fontWeight: 600, color: '#6366f1' }}> · {count} child{count !== 1 ? 'ren' : ''}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6366f1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected.father_cnic && `CNIC ${selected.father_cnic}`}
            {selected.father_contact && `  ·  ${selected.father_contact}`}
          </div>
        </div>
        <button onClick={clear} title="Clear parent filter" style={{ background: 'white', border: '1px solid #c7d2fe', borderRadius: 8, cursor: 'pointer', color: '#4f46e5', display: 'flex', padding: 6 }}>
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
      <input
        className="form-input"
        style={{ paddingLeft: 42, width: '100%', padding: '10px 14px 10px 42px' }}
        placeholder={placeholder || 'Search parent by Name, CNIC, Contact or ID...'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && q && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: 300, overflowY: 'auto' }}>
          {matches.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              No matching parent found
            </div>
          ) : matches.map(({ p, matchedChild }) => {
            const count = childCount(p.id);
            return (
              <div key={p.id} onClick={() => pick(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                  {(p.father_name || p.mother_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.father_name || '—'}
                    {p.mother_name && <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> / {p.mother_name}</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {p.father_cnic && <span>CNIC: {p.father_cnic}</span>}
                    {p.father_contact && <span>📞 {p.father_contact}</span>}
                    <span>ID: {p.id?.slice(0, 8)}</span>
                  </div>
                  {matchedChild && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>
                      ↳ matched child: {matchedChild.name}
                    </div>
                  )}
                </div>
                <span style={{ background: count > 0 ? '#dcfce7' : '#f1f5f9', color: count > 0 ? '#166534' : '#64748b', fontSize: '0.68rem', fontWeight: 800, borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {count} child{count !== 1 ? 'ren' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
