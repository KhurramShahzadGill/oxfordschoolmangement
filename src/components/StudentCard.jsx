import React from 'react';
import { Phone, MapPin, User, CalendarDays, GraduationCap } from 'lucide-react';
import { getSettings } from '../services/db';

/* ── Fitting the student's name ──────────────────────────────────────────────
   The card is a fixed 400x260 box, so a long name used to run past the photo
   and get cut off with an ellipsis ("SYED MUHAMMAD MOHSIN R..."). Instead of
   clipping, the name is now measured and the font size is shrunk until it fits
   the space beside the photo; a name too long even at the smallest size wraps
   onto a second line. Measuring happens on an offscreen canvas rather than in
   the DOM, because the bulk-print cards are display:none until the browser
   prints them and so have no measurable layout. */
const NAME_BOX = 270;   // px available for the name, left of the photo
const NAME_MAX = 16.5;  // normal size
const NAME_MIN = 12.5;  // smallest size still worth reading on one line
const NAME_FONT = '900 100px "Outfit", "Inter", Arial, sans-serif';

let measureCtx;
function nameWidthPerPx(text) {
  try {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = NAME_FONT;
    return measureCtx.measureText(text).width / 100;
  } catch {
    return text.length * 0.62; // rough average for uppercase bold text
  }
}

function fitName(name) {
  const perPx = nameWidthPerPx(name);
  if (!perPx) return { fontSize: NAME_MAX, lines: 1 };
  const oneLine = NAME_BOX / perPx;
  if (oneLine >= NAME_MIN) return { fontSize: Math.min(NAME_MAX, oneLine), lines: 1 };
  // Two lines: allow ~1.8 boxes of text, since words rarely break evenly.
  return { fontSize: Math.max(10, Math.min(NAME_MAX, (NAME_BOX * 1.8) / perPx)), lines: 2 };
}

export default function StudentCard({ student, parent, className, sectionName }) {
  if (!student) return null;
  const school = getSettings();

  // YYYY-MM-DD → DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
  };

  const GRAD = 'linear-gradient(120deg, #4318FF 0%, #7c3aed 45%, #ec4899 100%)';

  const studentName = (student.name || '').toUpperCase();
  const nameFit = fitName(studentName);

  const Field = ({ icon: Icon, iconColor, iconBg, label, value, wide }) => (
    <div style={{ width: wide ? '100%' : '48.5%', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} color={iconColor} strokeWidth={2.5} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 7, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{value || '-'}</div>
      </div>
    </div>
  );

  return (
    <div className="id-card-component" style={{
      width: 400, height: 260, background: '#ffffff', borderRadius: 16,
      boxShadow: '0 8px 24px rgba(67,24,255,0.25)', overflow: 'hidden', position: 'relative',
      fontFamily: '"Outfit", "Inter", Arial, sans-serif', display: 'flex', flexDirection: 'column',
      border: '1px solid #e0e7ff',
    }}>
      {/* ── Colorful Header ── */}
      <div style={{ background: GRAD, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}>
        {/* Decorative bubbles */}
        <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', top: -45, right: 30 }} />
        <div style={{ position: 'absolute', width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', bottom: -28, right: 110 }} />
        <div style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', top: -10, left: 150 }} />

        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 3px rgba(255,255,255,0.35)', zIndex: 1 }}>
          <img src={school.logo || '/logo.png'} alt="Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
            {school.school_name}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2, fontWeight: 600 }}>
            {school.tagline}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '4px 9px', textAlign: 'center', zIndex: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}>
          <div style={{ fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.25 }}>
            Student<br />ID Card
          </div>
        </div>
      </div>

      {/* Rainbow accent line */}
      <div style={{ height: 3.5, background: 'linear-gradient(90deg,#f59e0b,#ec4899,#7c3aed,#4318FF,#06b6d4,#10b981)' }} />

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', padding: '9px 14px 4px', gap: 12, position: 'relative' }}>
        {/* Soft background tint */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #ffffff 55%, #f5f3ff 100%)', pointerEvents: 'none' }} />

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <div style={{
            fontSize: nameFit.fontSize, fontWeight: 900, color: '#1e1b4b', textTransform: 'uppercase',
            lineHeight: 1.15, overflow: 'hidden',
            ...(nameFit.lines === 1
              ? { whiteSpace: 'nowrap' }
              : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflowWrap: 'anywhere' }),
          }}>
            {student.name}
          </div>
          <div style={{ width: 46, height: 3, background: GRAD, borderRadius: 99, margin: '3px 0 7px' }} />

          {/* ID chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ background: '#4318FF', color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2.5px 9px', boxShadow: '0 2px 5px rgba(67,24,255,0.3)' }}>
              ID: {student.id}
            </span>
            <span style={{ background: '#ec4899', color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2.5px 9px', boxShadow: '0 2px 5px rgba(236,72,153,0.3)' }}>
              Adm No: {student.roll_no || '-'}
            </span>
            <span style={{ background: '#06b6d4', color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2.5px 9px', boxShadow: '0 2px 5px rgba(6,182,212,0.3)' }}>
              <GraduationCap size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
              {className || '-'}{sectionName ? ` (${sectionName})` : ''}
            </span>
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Field icon={User} iconColor="#7c3aed" iconBg="#f3e8ff" label="Father's Name" value={parent?.father_name} wide />
            <Field icon={Phone} iconColor="#059669" iconBg="#d1fae5" label="Father's Contact" value={parent?.father_contact} />
            <Field icon={CalendarDays} iconColor="#d97706" iconBg="#fef3c7" label="Date of Birth" value={formatDate(student.dob)} />
          </div>
        </div>

        {/* Photo + sign */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, zIndex: 1 }}>
          <div style={{ padding: 3, borderRadius: 12, background: GRAD, boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }}>
            <div style={{ width: 78, height: 92, borderRadius: 9, overflow: 'hidden', background: '#f1f5f9', border: '2px solid white' }}>
              {student.picture ? (
                <img src={student.picture} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 9, fontWeight: 700 }}>
                  No Photo
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 'auto', textAlign: 'center', width: 88, paddingBottom: 2 }}>
            <div style={{ borderTop: '1.5px solid #c4b5fd', paddingTop: 2, fontSize: 7, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Principal Signature
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer: school contact & address ── */}
      <div style={{ background: 'linear-gradient(120deg, #1e1b4b 0%, #312e81 100%)', color: 'white', padding: '5.5px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <MapPin size={10} color="#f9a8d4" strokeWidth={2.5} /> {school.address}
        </span>
        <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <Phone size={10} color="#86efac" strokeWidth={2.5} /> {school.phone}
        </span>
      </div>
    </div>
  );
}
