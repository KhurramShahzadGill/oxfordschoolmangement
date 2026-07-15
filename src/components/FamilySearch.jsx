import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search as SearchIcon, X, Users } from 'lucide-react';

/*
 * FamilySearch — one advanced search box shared by every section.
 *
 * Type ANY of: Student ID, Admission No, Student Name, Father/Mother Name,
 * Father/Mother CNIC, or Father/Mother Contact. Matching families show as
 * compact cards:
 *   Line 1 → Father: name · CNIC · contact    |    Mother: name · CNIC · contact
 *   Line 2 → one tight row per child: ID · Adm · Name · Class
 *
 * onSelect(parent, student) fires when a card (or a child row) is picked:
 *   - Admission form / Parents / Fees use the parent.
 *   - Students uses the student (opens that profile).
 *
 * Two display modes, chosen by props:
 *   - Chip mode:   pass `selected` (a parent) + `onClear` → shows a chip.
 *   - Filter mode: pass `query` + `onQueryChange` → live-controlled input
 *                  (lets the host keep filtering its own table/export).
 * If neither is passed the box keeps its own internal query state.
 */

const onlyDigits = (v) => (v || '').replace(/\D/g, '');

export default function FamilySearch({
  students = [],
  parents = [],
  classes = [],
  sections = [],
  selected,          // parent object → renders a chip instead of the input
  onSelect,          // (parent, student|null) => void
  onClear,           // () => void  (chip clear button)
  query,             // controlled query string (filter mode)
  onQueryChange,     // (value) => void
  placeholder,
  limit = 12,        // max families shown
}) {
  const controlled = typeof query === 'string' && typeof onQueryChange === 'function';
  const [innerQuery, setInnerQuery] = useState('');
  const q = controlled ? query : innerQuery;
  const setQuery = (v) => { controlled ? onQueryChange(v) : setInnerQuery(v); };

  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const className = (id) => classes.find(c => c.id === id)?.class_name || '';
  const sectionName = (id) => sections.find(s => s.id === id)?.section_name || '';

  // ---- Matching: build families, then filter by the query ----
  const families = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const digits = onlyDigits(term);

    const parentsById = new Map(parents.map(p => [p.id, p]));

    // Group every student under its parent (orphans get their own bucket).
    const map = new Map();
    students.forEach(s => {
      const key = s.parent_id || `orphan:${s.id}`;
      if (!map.has(key)) map.set(key, { parent: parentsById.get(s.parent_id) || null, children: [] });
      map.get(key).children.push(s);
    });
    // Include parents that currently have no enrolled child.
    parents.forEach(p => { if (!map.has(p.id)) map.set(p.id, { parent: p, children: [] }); });

    const parentMatches = (p) => {
      if (!p) return false;
      const nameHit = (p.father_name || '').toLowerCase().includes(term) ||
                      (p.mother_name || '').toLowerCase().includes(term);
      const cnicHit = digits && (onlyDigits(p.father_cnic).includes(digits) || onlyDigits(p.mother_cnic).includes(digits));
      const phoneHit = digits && (onlyDigits(p.father_contact).includes(digits) || onlyDigits(p.mother_contact).includes(digits));
      return nameHit || cnicHit || phoneHit;
    };
    const childMatches = (s) =>
      (s.id || '').toLowerCase().includes(term) ||
      (s.roll_no || '').toLowerCase().includes(term) ||
      (s.name || '').toLowerCase().includes(term);

    const out = [];
    for (const fam of map.values()) {
      const pHit = parentMatches(fam.parent);
      const matchedKids = fam.children.filter(childMatches);
      if (pHit) {
        // Parent matched → show the whole family.
        out.push({ parent: fam.parent, children: fam.children });
      } else if (matchedKids.length) {
        // Only specific child(ren) matched → show just those.
        out.push({ parent: fam.parent, children: matchedKids });
      }
      if (out.length >= limit) break;
    }
    return out;
  }, [q, students, parents, limit]);

  const pick = (parent, student) => {
    onSelect && onSelect(parent, student);
    setOpen(false);
  };

  // ---- Chip mode (a family is already selected) ----
  if (selected) {
    const count = students.filter(s => s.parent_id === selected.id).length;
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
        <button onClick={() => onClear && onClear()} title="Clear" style={{ background: 'white', border: '1px solid #c7d2fe', borderRadius: 8, cursor: 'pointer', color: '#4f46e5', display: 'flex', padding: 6 }}>
          <X size={15} />
        </button>
      </div>
    );
  }

  // ---- Input + dropdown ----
  const seg = (label, value) => value ? <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}:</span> {value}</span> : null;

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
      <input
        className="form-input"
        style={{ width: '100%', padding: '10px 14px 10px 42px' }}
        placeholder={placeholder || 'Search by Student ID, Admission No, Name, Parent CNIC, Phone or Father/Mother Name...'}
        value={q}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: 360, overflowY: 'auto' }}>
          {families.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              No matching family found
            </div>
          ) : families.map(({ parent, children }, idx) => {
            const key = parent?.id || `orphan-${idx}`;
            const initial = (parent?.father_name || parent?.mother_name || children[0]?.name || '?').charAt(0).toUpperCase();
            return (
              <div key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {/* Line 1 — parents (whole header selects the family) */}
                <div
                  onClick={() => pick(parent, null)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', cursor: parent ? 'pointer' : 'default', background: '#faf9ff' }}
                  onMouseEnter={e => { if (parent) e.currentTarget.style.background = '#f0edff'; }}
                  onMouseLeave={e => e.currentTarget.style.background = '#faf9ff'}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '0.74rem', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: '2px 12px', lineHeight: 1.5 }}>
                    {parent ? (
                      <>
                        {seg('Father', parent.father_name)}
                        {seg('CNIC', parent.father_cnic)}
                        {seg('☎', parent.father_contact)}
                        {(parent.mother_name || parent.mother_cnic || parent.mother_contact) && (
                          <span style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                            {seg('Mother', parent.mother_name)}
                            {seg('CNIC', parent.mother_cnic)}
                            {seg('☎', parent.mother_contact)}
                          </span>
                        )}
                        {!parent.father_name && !parent.mother_name && <span style={{ color: 'var(--text-secondary)' }}>Parent details not set</span>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>No parent record linked</span>
                    )}
                  </div>
                </div>
                {/* Line 2 — one compact row per child */}
                {children.map(s => (
                  <div
                    key={s.id}
                    onClick={() => pick(parent, s)}
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 12px', padding: '7px 12px 7px 52px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    {seg('ID', s.id)}
                    {seg('Adm', s.roll_no)}
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name || '—'}</span>
                    {className(s.class_id) && (
                      <span>{className(s.class_id)}{sectionName(s.section_id) ? ` (${sectionName(s.section_id)})` : ''}</span>
                    )}
                    {s.status && s.status !== 'Active' && (
                      <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{s.status}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
