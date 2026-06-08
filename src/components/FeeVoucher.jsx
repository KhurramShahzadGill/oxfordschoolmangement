import React from 'react';
import { format, parseISO } from 'date-fns';

const fmtM = (m) => { try { return format(parseISO(m + '-01'), 'MMM yyyy'); } catch { return m; } };

/* ── School details — edit here to change header info ───────────────── */
const SCHOOL = {
  name: 'OXFORD GRAMMAR SCHOOL',
  tagline: 'Excellence in Education',
  address: 'Chak No. 202/RB, Gatti Faisalabad',
  phone: '0321-6088202',
};

/* Convert a number to words using the South-Asian (Lakh / Crore) system */
function numberToWords(value) {
  let num = Math.round(Number(value) || 0);
  if (num === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const seg = (n) => {
    let s = '';
    if (n > 99) { s += a[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n > 19) { s += b[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) s += a[n] + ' ';
    return s;
  };
  let res = '';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) res += seg(crore) + 'Crore ';
  if (lakh) res += seg(lakh) + 'Lakh ';
  if (thousand) res += seg(thousand) + 'Thousand ';
  if (num) res += seg(num);
  return res.trim();
}

const C = {
  border: '1px solid #0f172a',
  ink: '#0f172a',
  muted: '#475569',
  light: '#f1f5f9',
};

function VoucherTemplate({ student, fee, arrears, parent, className, sectionName, breakdown, copyLabel }) {
  const receivedTotal = Number(fee?.amount_paid || 0);

  const currentItems = breakdown || [];
  const currentTotal = currentItems.reduce((s, i) => s + Number(i.paying || 0), 0);

  const arrearItems = arrears || [];
  const arrearAmount = arrearItems.reduce((s, m) => s + (Number(m.balance) || Number(student.monthly_fee || 0)), 0);

  const grandTotalPayable = currentTotal + arrearAmount;
  const balance = grandTotalPayable - receivedTotal;

  const issueDate = fee?.paid_date ? format(parseISO(fee.paid_date), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy');
  const challanNo = `OGS/${student.id || '—'}/${format(new Date(), 'yyMMdd')}`;
  const period = fee?.month ? fmtM(fee.month) : '—';

  const cell = { border: C.border, padding: '3px 7px', fontSize: '10px', verticalAlign: 'middle' };
  const labelTxt = { fontSize: '8px', color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' };
  const valTxt = { fontSize: '11px', fontWeight: 800, color: C.ink };

  const InfoCell = ({ label, value }) => (
    <td style={cell}>
      <div style={labelTxt}>{label}</div>
      <div style={valTxt}>{value || '—'}</div>
    </td>
  );

  return (
    <div style={{
      border: '1.5px solid ' + C.ink,
      borderRadius: '4px',
      padding: '8px 10px',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Outfit", "Inter", sans-serif',
      color: C.ink,
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid ' + C.ink, paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 900, letterSpacing: '-0.02em', color: C.ink }}>{SCHOOL.name}</h1>
            <p style={{ margin: 0, fontSize: '8px', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{SCHOOL.tagline}</p>
            <p style={{ margin: '1px 0 0', fontSize: '8px', color: C.muted }}>{SCHOOL.address} &nbsp;•&nbsp; Ph: {SCHOOL.phone}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', border: '1px solid ' + C.ink, borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{copyLabel}</div>
          <div style={{ marginTop: '3px', fontSize: '11px', fontWeight: 800 }}>FEE VOUCHER</div>
        </div>
      </div>

      {/* Challan meta row */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <InfoCell label="Voucher No." value={challanNo} />
            <InfoCell label="Issue Date" value={issueDate} />
            <InfoCell label="Fee Period" value={period} />
          </tr>
        </tbody>
      </table>

      {/* Student info */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <InfoCell label="Student Name" value={student.name} />
            <InfoCell label="Father's Name" value={parent?.father_name} />
          </tr>
          <tr>
            <InfoCell label="ID / Admission No" value={`${student.id || '—'} / ${student.roll_no || '—'}`} />
            <InfoCell label="Class & Section" value={(className || '—') + (sectionName ? ` (${sectionName})` : '')} />
          </tr>
        </tbody>
      </table>

      {/* Particulars table — current charges being paid now */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', tableLayout: 'fixed', flexShrink: 0 }}>
        <thead>
          <tr style={{ background: C.light }}>
            <th style={{ ...cell, width: '26px', textAlign: 'center', fontSize: '8px', textTransform: 'uppercase', color: C.muted }}>#</th>
            <th style={{ ...cell, textAlign: 'left', fontSize: '8px', textTransform: 'uppercase', color: C.muted }}>Particulars (Head &amp; Period)</th>
            <th style={{ ...cell, width: '95px', textAlign: 'right', fontSize: '8px', textTransform: 'uppercase', color: C.muted }}>Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.length === 0 && (
            <tr><td style={{ ...cell, textAlign: 'center', color: C.muted }} colSpan={3}>No current payment</td></tr>
          )}
          {currentItems.map((item, idx) => (
            <tr key={'cur-' + idx}>
              <td style={{ ...cell, textAlign: 'center' }}>{idx + 1}</td>
              <td style={cell}>
                <span style={{ fontWeight: 800 }}>{item.type}</span>
                <span style={{ color: C.muted, fontSize: '9px' }}> — {item.isCustom ? 'Current Charge' : fmtM(item.month)}</span>
              </td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 800 }}>{Number(item.paying || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Arrears — compact head-wise grid to save space */}
      {arrearItems.length > 0 && (
        <div style={{ marginTop: '5px', border: '1px solid #fca5a5', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ background: '#fef2f2', padding: '2px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b', letterSpacing: '0.03em' }}>Arrears / Previous Outstanding Dues</span>
            <span style={{ fontSize: '9px', fontWeight: 900, color: '#991b1b' }}>Total: Rs. {arrearAmount.toLocaleString()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {arrearItems.map((m, idx) => (
              <div key={'arr-' + idx} style={{
                display: 'flex', justifyContent: 'space-between', gap: '5px', padding: '2px 8px',
                fontSize: '9px', borderTop: '1px solid #fee2e2',
                borderRight: (idx % 3 !== 2) ? '1px solid #fee2e2' : 'none',
              }}>
                <span style={{ color: '#7f1d1d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.isCustom ? m.month : fmtM(m.month || m)}
                </span>
                <span style={{ fontWeight: 800, color: '#991b1b', flexShrink: 0 }}>
                  {Number(m.balance || student.monthly_fee || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary + Amount in words */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginTop: '6px', flexShrink: 0 }}>
        <div style={{ flex: 1, fontSize: '9px', border: '1px dashed ' + C.muted, borderRadius: '4px', padding: '4px 8px', alignSelf: 'stretch' }}>
          <span style={{ color: C.muted, fontWeight: 700 }}>Received in words: </span>
          <span style={{ fontWeight: 800 }}>Rupees {numberToWords(receivedTotal)} Only</span>
        </div>
        <table style={{ width: '230px', borderCollapse: 'collapse', flexShrink: 0 }}>
          <tbody>
            <tr>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Total Payable</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 800, width: '95px' }}>{grandTotalPayable.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: '#059669' }}>Amount Received</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 800, color: '#059669' }}>{receivedTotal.toLocaleString()}</td>
            </tr>
            <tr style={{ background: C.ink }}>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 900, color: '#fff', fontSize: '11px' }}>BALANCE DUE</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 900, color: '#fff', fontSize: '12px' }}>{balance.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px' }}>
        <div style={{ fontSize: '8px', color: C.muted, maxWidth: '250px', lineHeight: 1.4 }}>
          <strong>Note:</strong> Computer-generated voucher. Please keep for your records and report any discrepancy within 3 days.
        </div>
        <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
          <div style={{ minWidth: '90px', borderTop: '1px solid ' + C.muted, paddingTop: '3px', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase' }}>Cashier Sign</div>
          <div style={{ minWidth: '90px', borderTop: '1px solid ' + C.muted, paddingTop: '3px', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase' }}>School Stamp</div>
        </div>
      </div>
    </div>
  );
}

export default function FeeVoucher(props) {
  return (
    <div className="print-only voucher-print" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '49%' }}>
        <VoucherTemplate {...props} copyLabel="SCHOOL COPY" />
      </div>
      <div style={{ height: '2%', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '100%', borderTop: '1.5px dashed #94a3b8' }}></div>
        <div style={{ position: 'absolute', background: 'white', padding: '0 8px', fontSize: '9px', color: '#94a3b8', letterSpacing: '2px', left: '20px' }}>✂ CUT HERE</div>
      </div>
      <div style={{ height: '49%' }}>
        <VoucherTemplate {...props} copyLabel="PARENT COPY" />
      </div>
    </div>
  );
}
