import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections } from '../services/db';
import { Users, UserMinus, UserCheck, GraduationCap, Filter } from 'lucide-react';

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  useEffect(() => {
    const load = async () => {
      const [sData, cData, secData] = await Promise.all([
        apiStudents.getAll(), apiClasses.getAll(), apiSections.getAll()
      ]);
      setStudents(sData);
      setClasses(cData);
      setSections(secData);
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

  const cards = [
    { label: 'Active Students', value: activeStudents.length, icon: UserCheck, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
    { label: 'Left Students', value: leftStudents.length, icon: UserMinus, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    { label: 'Boys (Active)', value: maleCount, icon: Users, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Girls (Active)', value: femaleCount, icon: Users, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
  ];

  const filterSections = sections.filter(s => s.class_id === filterClass);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Smart Student Analytics</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <Filter size={16} color="var(--text-secondary)" />
          <select 
            className="form-select" 
            style={{ width: 140, border: 'none', background: 'transparent', padding: '6px', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }} 
            value={filterClass} 
            onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>

          <select 
            className="form-select" 
            style={{ width: 140, border: 'none', background: 'transparent', padding: '6px', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }} 
            value={filterSection} 
            onChange={e => setFilterSection(e.target.value)} 
            disabled={!filterClass}
          >
            <option value="">All Sections</option>
            {filterSections.map(s => <option key={s.id} value={s.id}>Sec {s.section_name}</option>)}
          </select>
        </div>
      </div>

      {/* Metric Cards - Compact SaaS Style */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {cards.map((c, i) => (
          <div key={i} style={{ 
            background: 'var(--bg-primary)', 
            borderRadius: '12px', 
            padding: '16px', 
            border: `1px solid ${c.border}`, 
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            transition: 'transform 0.2s',
          }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            
            <div style={{ width: 44, height: 44, borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <c.icon size={22} color={c.color} />
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: '4px' }}>{c.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution Grid - Compact & Modern */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '20px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <GraduationCap size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {!filterClass ? 'Class-wise Active Students' : `Section-wise Active Students (${classes.find(c => c.id === filterClass)?.class_name})`}
          </h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {!filterClass ? (
            // Render Class-wise
            classes.length === 0 ? <div className="text-xs text-secondary-color">No classes found.</div> :
            classes.map(c => {
              const count = activeStudents.filter(s => s.class_id === c.id).length;
              if(count === 0) return null;
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>{c.class_name}</span>
                  <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>{count}</span>
                </div>
              );
            })
          ) : (
            // Render Section-wise
            filterSections.length === 0 ? <div className="text-xs text-secondary-color">No sections found.</div> :
            filterSections.map(sec => {
              const count = activeStudents.filter(s => s.section_id === sec.id).length;
              return (
                <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>Sec {sec.section_name}</span>
                  <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
