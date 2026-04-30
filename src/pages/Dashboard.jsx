import React, { useState, useEffect } from 'react';
import { apiStudents, apiClasses, apiSections, apiFees, apiParents } from '../services/db';
import { Users, BookOpen, Receipt, UserSquare2 } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ students: 0, classes: 0, parents: 0, paidFees: 0, unpaidFees: 0 });

  useEffect(() => {
    const load = async () => {
      const [students, classes, parents, fees] = await Promise.all([
        apiStudents.getAll(), apiClasses.getAll(), apiParents.getAll(), apiFees.getAll()
      ]);
      const active = students.filter(s => s.status === 'Active').length;
      const paid = fees.filter(f => f.status === 'Paid');
      const unpaid = fees.filter(f => f.status === 'Unpaid');
      const paidTotal = paid.reduce((sum, f) => {
        const s = students.find(st => st.id === f.student_id);
        return sum + Number(s?.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0);
      }, 0);
      const unpaidTotal = unpaid.reduce((sum, f) => {
        const s = students.find(st => st.id === f.student_id);
        return sum + Number(s?.monthly_fee || 0) + Number(f.fine || 0) + Number(f.paper_fund || 0) + Number(f.other_charges || 0);
      }, 0);
      setStats({ students: active, classes: classes.length, parents: parents.length, paidFees: paidTotal, unpaidFees: unpaidTotal });
    };
    load();
  }, []);

  const cards = [
    { label: 'Active Students', value: stats.students, icon: Users, color: '#4318FF' },
    { label: 'Total Classes', value: stats.classes, icon: BookOpen, color: '#00B5D8' },
    { label: 'Parent Records', value: stats.parents, icon: UserSquare2, color: '#7928CA' },
    { label: 'Fee Collected', value: `Rs. ${stats.paidFees.toLocaleString()}`, icon: Receipt, color: '#05CD99' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-6 mb-6">
        {cards.map((c, i) => (
          <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, right: -10, width: 70, height: 70, borderRadius: '50%', backgroundColor: c.color, opacity: 0.1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={24} color={c.color} />
              </div>
              <div>
                <div className="text-sm text-secondary-color font-medium">{c.label}</div>
                <div className="text-xl font-bold mt-1">{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.unpaidFees > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="font-semibold" style={{ color: 'var(--danger)' }}>Pending Dues</div>
              <div className="text-2xl font-bold mt-1">Rs. {stats.unpaidFees.toLocaleString()}</div>
            </div>
            <span className="badge badge-danger">Action Required</span>
          </div>
        </div>
      )}
    </div>
  );
}
