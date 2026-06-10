import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections, apiFees } from '../services/db';
import { format, subMonths } from 'date-fns';
import { Users, UserMinus, UserCheck, GraduationCap, Filter, Wallet, AlertCircle, TrendingUp, Clock } from 'lucide-react';

const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [fees, setFees] = useState([]);

  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const curMonth = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    const load = async () => {
      const [sData, cData, secData, fData] = await Promise.all([
        apiStudents.getAll(), apiClasses.getAll(), apiSections.getAll(), apiFees.getAll()
      ]);
      setStudents(sData);
      setClasses(cData);
      setSections(secData);
      setFees(fData);
    };
    load();
  }, []);

  const filteredStudents = students.filter(s => {
    if (filterClass && s.class_id !== filterClass) return false;
    if (filterSection && s.section_id !== filterSection) return false;
    return true;
  });

  const activeStudents = filteredStudents.filter(s => s.status === 'Active');
  const leftStudents = filteredStudents.filter(s => s.status === 'Left');
  const maleCount = activeStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = activeStudents.filter(s => s.gender === 'Female').length;

  // ── Fee stats (current month, respects class/section filter) ──
  const activeIds = new Set(activeStudents.map(s => s.id));
  const getFeeRec = (sid, month) => fees.find(f => f.student_id === sid && f.month === month);

  const monthCollected = fees
    .filter(f => f.month === curMonth && activeIds.has(f.student_id))
    .reduce((sum, f) => sum + Number(f.amount_paid || 0), 0);

  const monthPending = activeStudents.reduce((sum, s) => {
    if (s.fee_start_month && curMonth < s.fee_start_month) return sum;
    const rec = getFeeRec(s.id, curMonth);
    const due = Number(rec?.monthly_fee ?? s.monthly_fee ?? 0) + Number(rec?.fine || 0) + Number(rec?.paper_fund || 0) + Number(rec?.other_charges || 0);
    return sum + Math.max(0, due - Number(rec?.amount_paid || 0));
  }, 0);

  const defaulterCount = activeStudents.filter(s => {
    if (s.fee_start_month && curMonth < s.fee_start_month) return false;
    const rec = getFeeRec(s.id, curMonth);
    const due = Number(rec?.monthly_fee ?? s.monthly_fee ?? 0);
    return due > 0 && Number(rec?.amount_paid || 0) < due;
  }).length;

  // ── 6-month collection trend (all students) ──
  const trendMonths = Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), 5 - i), 'yyyy-MM'));
  const trend = trendMonths.map(m => ({
    month: m,
    label: format(subMonths(new Date(), 5 - trendMonths.indexOf(m)), 'MMM'),
    total: fees.filter(f => f.month === m).reduce((s, f) => s + Number(f.amount_paid || 0), 0),
  }));
  const trendMax = Math.max(1, ...trend.map(t => t.total));

  // ── Recent admissions (last 5) ──
  const recentAdmissions = [...students]
    .filter(s => s.admission_date)
    .sort((a, b) => (a.admission_date < b.admission_date ? 1 : -1))
    .slice(0, 5);

  // ── Gender donut geometry ──
  const totalGender = maleCount + femaleCount;
  const malePct = totalGender > 0 ? maleCount / totalGender : 0;
  const R = 42, CIRC = 2 * Math.PI * R;

  const filterSections = sections.filter(s => s.class_id === filterClass);
  const getClassName = (id) => classes.find(c => c.id === id)?.class_name || '-';

  const cards = [
    { label: 'Active Students', value: activeStudents.length.toLocaleString(), sub: `${leftStudents.length} left`, icon: UserCheck, color: '#10b981', bg: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '#a7f3d0' },
    { label: 'Collected (This Month)', value: fmtRs(monthCollected), sub: format(new Date(), 'MMMM yyyy'), icon: Wallet, color: '#4318FF', bg: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', border: '#c7d2fe' },
    { label: 'Pending (This Month)', value: fmtRs(monthPending), sub: 'Across filtered students', icon: AlertCircle, color: '#ef4444', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca' },
    { label: 'Fee Defaulters', value: defaulterCount.toLocaleString(), sub: 'Unpaid this month', icon: UserMinus, color: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a' },
  ];

  const panel = { background: 'var(--bg-primary)', borderRadius: 16, padding: 20, border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' };
  const panelTitle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Students, fees and admissions at a glance</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <Filter size={16} color="var(--text-secondary)" />
          <select className="form-select" style={{ width: 140, border: 'none', background: 'transparent', padding: 6, fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>
          <div style={{ width: 1, height: 20, background: 'var(--border-color)' }}></div>
          <select className="form-select" style={{ width: 140, border: 'none', background: 'transparent', padding: 6, fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            value={filterSection} onChange={e => setFilterSection(e.target.value)} disabled={!filterClass}>
            <option value="">All Sections</option>
            {filterSections.map(s => <option key={s.id} value={s.id}>Sec {s.section_name}</option>)}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 16, padding: '18px 20px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 16, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <c.icon size={22} color={c.color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.15, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>

        {/* Collection Trend */}
        <div style={panel}>
          <div style={panelTitle}><TrendingUp size={17} color="var(--primary)" /> Fee Collection — Last 6 Months</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, padding: '0 4px' }}>
            {trend.map(t => {
              const h = Math.round((t.total / trendMax) * 120);
              const isCur = t.month === curMonth;
              return (
                <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={`${t.label}: ${fmtRs(t.total)}`}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {t.total > 0 ? (t.total >= 1000 ? `${Math.round(t.total / 1000)}k` : t.total) : ''}
                  </div>
                  <div style={{
                    width: '100%', maxWidth: 42, height: Math.max(4, h), borderRadius: '6px 6px 2px 2px',
                    background: isCur ? 'linear-gradient(180deg,#4318FF,#3311DB)' : 'linear-gradient(180deg,#c7d2fe,#a5b4fc)',
                    transition: 'height 0.4s ease',
                  }} />
                  <div style={{ fontSize: '0.7rem', fontWeight: isCur ? 800 : 600, color: isCur ? 'var(--primary)' : 'var(--text-secondary)' }}>{t.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gender Donut */}
        <div style={panel}>
          <div style={panelTitle}><Users size={17} color="var(--primary)" /> Gender Ratio (Active)</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, height: 160 }}>
            <svg width="130" height="130" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={R} fill="none" stroke="#fbcfe8" strokeWidth="14" />
              <circle cx="55" cy="55" r={R} fill="none" stroke="#3b82f6" strokeWidth="14"
                strokeDasharray={`${malePct * CIRC} ${CIRC}`} strokeLinecap={totalGender > 0 && malePct > 0 && malePct < 1 ? 'round' : 'butt'}
                transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              <text x="55" y="51" textAnchor="middle" style={{ fontSize: 19, fontWeight: 800, fill: 'var(--text-primary)' }}>{totalGender}</text>
              <text x="55" y="67" textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#3b82f6' }}></span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Boys</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#3b82f6' }}>{maleCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#ec4899' }}></span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Girls</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ec4899' }}>{femaleCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>

        {/* Class-wise distribution — click a bar to filter */}
        <div style={panel}>
          <div style={panelTitle}>
            <GraduationCap size={17} color="var(--primary)" />
            {!filterClass ? 'Class-wise Active Students' : `Section-wise (${getClassName(filterClass)})`}
            {filterClass && (
              <button onClick={() => { setFilterClass(''); setFilterSection(''); }} style={{ marginLeft: 'auto', background: '#eef2ff', color: 'var(--primary)', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                ← All Classes
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {(() => {
              const rows = !filterClass
                ? classes.map(c => ({ id: c.id, name: c.class_name, count: students.filter(s => s.status === 'Active' && s.class_id === c.id).length, clickable: true }))
                : filterSections.map(sec => ({ id: sec.id, name: `Section ${sec.section_name}`, count: activeStudents.filter(s => s.section_id === sec.id).length, clickable: false }));
              const visible = rows.filter(r => r.count > 0);
              if (visible.length === 0) return <div className="text-xs text-secondary-color" style={{ padding: 12 }}>No students found.</div>;
              const max = Math.max(...visible.map(r => r.count));
              return visible.map(r => (
                <div key={r.id} onClick={() => r.clickable && setFilterClass(r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: r.clickable ? 'pointer' : 'default', padding: '4px 6px', borderRadius: 8, transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (r.clickable) e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  title={r.clickable ? 'Click to view sections' : undefined}>
                  <span style={{ width: 90, fontSize: '0.78rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{r.name}</span>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 99, height: 14, overflow: 'hidden' }}>
                    <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#818cf8,#4318FF)', transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ width: 32, textAlign: 'right', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>{r.count}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Recent Admissions */}
        <div style={panel}>
          <div style={panelTitle}><Clock size={17} color="var(--primary)" /> Recent Admissions</div>
          {recentAdmissions.length === 0 ? (
            <div className="text-xs text-secondary-color" style={{ padding: 12 }}>No admissions recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentAdmissions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.picture
                      ? <img src={s.picture} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>{s.name?.charAt(0) || '?'}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{getClassName(s.class_id)} · ID {s.id}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.admission_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
