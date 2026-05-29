import React from 'react';
import { format, parseISO } from 'date-fns';

const fmtM = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };

function VoucherTemplate({ student, fee, arrears, parent, className, sectionName, breakdown, copyLabel }) {
  const receivedTotal = Number(fee?.amount_paid || 0);
  
  const breakdownPayable = breakdown?.reduce((sum, item) => sum + Number(item.payable || 0), 0) || 0;
  const remainingArrearMonths = arrears || [];
  const arrearAmount = remainingArrearMonths.reduce((sum, m) => sum + (Number(m.balance) || Number(student.monthly_fee || 0)), 0);
  
  const grandTotalPayable = breakdownPayable + arrearAmount;
  const balance = grandTotalPayable - receivedTotal;

  return (
    <div style={{ 
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#1e293b',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Professional Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '15px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="Oxford Logo" style={{ height: '45px', objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '-0.025em', color: '#000000' }}>GRAMMAR SCHOOL</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excellence in Education</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Receipt Type:</span>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#000000', marginLeft: '6px' }}>{copyLabel}</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
            Date: {format(new Date(), 'dd MMM, yyyy')}
          </div>
        </div>
      </div>

      {/* Student & Parent Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '15px', flexShrink: 0 }}>
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Full Name</label>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#000000' }}>{student.name}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Father's Name</label>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#000000' }}>{parent?.father_name || '-'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Student ID / Roll No</label>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{student.id} / {student.roll_no}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Class & Section</label>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{className} ({sectionName})</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          {student.picture && (
            <div style={{ width: '70px', height: '70px', border: '3px solid #f8fafc', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <img src={student.picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '-10px', right: '0', opacity: '0.05', fontSize: '40px', fontWeight: '900', color: '#000000', pointerEvents: 'none' }}>PAID</div>
        </div>
      </div>

      {/* Transaction Details Table - Flexible to take remaining space */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '9px', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', borderBottom: '1px solid #e2e8f0' }}>Description & Period</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '9px', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '9px', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', borderBottom: '1px solid #e2e8f0' }}>Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {breakdown?.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#000000' }}>{item.type}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{item.isCustom ? 'Custom Charge' : `Period: ${fmtM(item.month)}`}</div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ color: '#059669', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>Received</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '800', color: '#000000' }}>
                  {Number(item.paying).toLocaleString()}
                </td>
              </tr>
            ))}

            {/* Arrears / Unpaid Items */}
            {remainingArrearMonths.map((m, idx) => (
              <tr key={'arr-'+idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#991b1b' }}>{m.isCustom ? m.month : 'Pending Monthly Fee'}</div>
                  <div style={{ fontSize: '10px', color: '#b91c1c' }}>{m.isCustom ? 'Custom Charge' : `Period: ${fmtM(m.month || m)}`}</div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>Unpaid</span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '800', color: '#991b1b' }}>
                  {Number(m.balance || student.monthly_fee).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '2px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ width: '100%', maxWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
            <span>Total Payable Amount:</span>
            <span>Rs. {grandTotalPayable.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', color: '#059669', fontWeight: '800' }}>
            <span>Total Amount Received:</span>
            <span>Rs. {receivedTotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '6px', borderTop: '2px solid #000000', fontSize: '14px', fontWeight: '900', color: '#000000' }}>
            <span>REMAINING BALANCE:</span>
            <span>Rs. {balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer / Instructions */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '15px', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', color: '#64748b', maxWidth: '300px', lineHeight: '1.4' }}>
          <p style={{ margin: 0 }}><strong>Note:</strong> Computer-generated official receipt. Keep for records. Report discrepancies within 3 days.</p>
        </div>
        <div style={{ display: 'flex', gap: '30px', textAlign: 'center' }}>
          <div style={{ minWidth: '100px' }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: '#000000' }}>Officer Signature</div>
          </div>
          <div style={{ minWidth: '100px' }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: '#000000' }}>School Stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeeVoucher(props) {
  return (
    <div className="print-only voucher-print" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ height: '48%', overflow: 'hidden' }}>
        <VoucherTemplate {...props} copyLabel="SCHOOL COPY" />
      </div>
      <div style={{ height: '4%', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '100%', borderTop: '2px dashed #94a3b8' }}></div>
        <div style={{ position: 'absolute', background: 'white', padding: '0 10px', fontSize: '10px', color: '#94a3b8', letterSpacing: '2px', left: '20px' }}>✂ CUT HERE</div>
      </div>
      <div style={{ height: '48%', overflow: 'hidden' }}>
        <VoucherTemplate {...props} copyLabel="PARENT COPY" />
      </div>
    </div>
  );
}
