import React from 'react';
import { format, parseISO } from 'date-fns';

const fmtM = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };

export default function FeeVoucher({ student, fee, arrears, parent, className, sectionName, breakdown }) {
  const receivedTotal = Number(fee?.amount_paid || 0);
  
  // Total payable logic
  let grandTotalPayable = receivedTotal;
  const remainingArrearMonths = arrears || [];
  const arrearAmount = remainingArrearMonths.length * Number(student.monthly_fee || 0);
  grandTotalPayable += arrearAmount;

  const balance = grandTotalPayable - receivedTotal;

  return (
    <div className="print-only voucher-print" style={{ 
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#1e293b',
      background: '#fff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }}>
      {/* Professional Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0f172a', paddingBottom: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '50px', height: '50px', background: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '24px' }}>O</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.025em', color: '#0f172a' }}>OXFORD GRAMMAR SCHOOL</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excellence in Education</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Receipt Type:</span>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginLeft: '6px' }}>OFFICIAL FEE VOUCHER</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            Date: {format(new Date(), 'dd MMM, yyyy')}
          </div>
        </div>
      </div>

      {/* Student & Parent Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', marginBottom: '30px' }}>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Full Name</label>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{student.name}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Father's Name</label>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{parent?.father_name || '-'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Student ID / Roll No</label>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>{student.id} / {student.roll_no}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Class & Section</label>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>{className} ({sectionName})</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          {student.picture && (
            <div style={{ width: '100px', height: '100px', border: '4px solid #f8fafc', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', margin: '0 auto' }}>
              <img src={student.picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '-20px', right: '0', opacity: '0.05', fontSize: '60px', fontWeight: '900', color: '#0f172a', pointerEvents: 'none' }}>PAID</div>
        </div>
      </div>

      {/* Transaction Details Table */}
      <div style={{ marginBottom: '30px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>Description & Period</th>
              <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {breakdown?.map((item, idx) => (
              <tr key={idx} style={{ background: '#fff', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
                <td style={{ padding: '15px 20px', borderRadius: '12px 0 0 12px', border: '1px solid #f1f5f9', borderRight: 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{item.type}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Period: {fmtM(item.month)}</div>
                </td>
                <td style={{ padding: '15px 20px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Received</span>
                </td>
                <td style={{ padding: '15px 20px', textAlign: 'right', borderRadius: '0 12px 12px 0', border: '1px solid #f1f5f9', borderLeft: 'none', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  {Number(item.paying).toLocaleString()}
                </td>
              </tr>
            ))}

            {/* Arrears / Unpaid Items */}
            {remainingArrearMonths.map((m, idx) => (
              <tr key={'arr-'+idx} style={{ background: '#fffefc' }}>
                <td style={{ padding: '15px 20px', borderRadius: '12px 0 0 12px', border: '1px solid #fee2e2', borderRight: 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>Pending Monthly Fee</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c' }}>Period: {fmtM(m)}</div>
                </td>
                <td style={{ padding: '15px 20px', textAlign: 'center', borderTop: '1px solid #fee2e2', borderBottom: '1px solid #fee2e2' }}>
                  <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Unpaid</span>
                </td>
                <td style={{ padding: '15px 20px', textAlign: 'right', borderRadius: '0 12px 12px 0', border: '1px solid #fee2e2', borderLeft: 'none', fontSize: '14px', fontWeight: '700', color: '#991b1b' }}>
                  {Number(student.monthly_fee).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ width: '100%', maxWidth: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#64748b' }}>
            <span>Total Payable Amount:</span>
            <span style={{ fontWeight: '600' }}>Rs. {grandTotalPayable.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#059669' }}>
            <span>Total Amount Received:</span>
            <span style={{ fontWeight: '700' }}>Rs. {receivedTotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', marginTop: '10px', borderTop: '2px solid #0f172a', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
            <span>REMAINING BALANCE:</span>
            <span>Rs. {balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer / Instructions */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '10px', color: '#94a3b8', maxWidth: '300px', lineHeight: '1.5' }}>
          <p style={{ margin: 0 }}><strong>Note:</strong> This is a computer-generated official receipt. Please keep it for your records. If you notice any discrepancy, contact the school office within 3 working days.</p>
        </div>
        <div style={{ display: 'flex', gap: '40px', textAlign: 'center' }}>
          <div style={{ minWidth: '120px' }}>
            <div style={{ height: '40px' }}></div>
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '5px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#475569' }}>Officer Signature</div>
          </div>
          <div style={{ minWidth: '120px' }}>
            <div style={{ height: '40px' }}></div>
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '5px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#475569' }}>School Stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
}
