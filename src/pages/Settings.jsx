import React, { useState } from 'react';
import { getSettings, saveSettings, defaultSettings } from '../services/db';
import { compressImage } from '../utils/image';
import { ADMISSION_FIELD_GROUPS, DEFAULT_IMPORTANT_KEYS } from '../utils/completeness';
import { Save, RotateCcw, Building2, Star } from 'lucide-react';

export default function Settings() {
  const [form, setForm] = useState(getSettings());
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, { maxDim: 256, targetKB: 80, startQuality: 0.9 });
      set('logo', dataUrl);
    } catch {
      alert('Could not read the image file. Please try another image.');
    }
  };

  const handleSave = () => {
    if (!form.school_name.trim()) { alert('School name is required.'); return; }
    saveSettings(form);
    setSaved(true);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all settings to default values?')) return;
    saveSettings(defaultSettings);
    setForm(getSettings());
    setSaved(true);
  };

  // ── Important-fields config (applies to every student) ──
  const impSet = new Set(form.important_fields || DEFAULT_IMPORTANT_KEYS);
  const setImportant = (keys) => set('important_fields', keys);
  const toggleImp = (key) => { const s = new Set(impSet); s.has(key) ? s.delete(key) : s.add(key); setImportant([...s]); };
  const setGroupImp = (group, on) => { const s = new Set(impSet); group.fields.forEach(f => on ? s.add(f.key) : s.delete(f.key)); setImportant([...s]); };

  const inputStyle = { padding: '10px 14px', fontSize: '0.9rem' };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="text-2xl font-bold">School Settings</h1>
          <p className="text-sm text-secondary-color mt-1">This information appears on fee receipts, ID cards, reports and the login screen.</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} /> School Information
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">School Name *</label>
            <input className="form-input" style={inputStyle} value={form.school_name} onChange={e => set('school_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tagline / Motto</label>
            <input className="form-input" style={inputStyle} value={form.tagline} onChange={e => set('tagline', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">School Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                <img src={form.logo || '/logo.png'} alt="Logo preview" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handleLogo} style={{ fontSize: '0.85rem' }} />
                <p className="text-xs text-secondary-color mt-1">Uploaded logo is auto-compressed. Leave empty to use the default logo file.</p>
                {form.logo && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: 6 }} onClick={() => set('logo', '')}>
                    Remove uploaded logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={15} /> Reset to Defaults
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saved && <span className="text-sm" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Settings saved</span>}
            <button type="button" className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSave}>
              <Save size={16} /> Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Important admission fields (applies to every student) */}
      <div className="card" style={{ marginTop: 24 }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={16} /> Admission Form — Important Fields
        </h2>
        <p className="text-xs text-secondary-color mb-4">
          Fields marked <span style={{ color: '#f59e0b' }}>★</span> are treated as important for <strong>every</strong> student and are checked for missing data.
          While filling a student's admission form you can still override any field for that single student.
        </p>

        {ADMISSION_FIELD_GROUPS.map(group => {
          const allOn = group.fields.every(f => impSet.has(f.key));
          return (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</span>
                <button type="button" onClick={() => setGroupImp(group, !allOn)}
                  style={{ background: allOn ? '#fef3c7' : '#f1f5f9', color: allOn ? '#b45309' : '#475569', border: 'none', borderRadius: 5, padding: '2px 10px', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>
                  {allOn ? 'Clear all' : 'Mark all ★'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {group.fields.map(f => {
                  const on = impSet.has(f.key);
                  return (
                    <label key={f.key} onClick={() => toggleImp(f.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', border: `1px solid ${on ? '#fde68a' : 'var(--border-color)'}`, background: on ? '#fffbeb' : 'white', borderRadius: 8, userSelect: 'none' }}>
                      <span style={{ fontSize: '0.95rem', lineHeight: 1, color: on ? '#f59e0b' : '#cbd5e1' }}>{on ? '★' : '☆'}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <span className="text-xs text-secondary-color">{impSet.size} field{impSet.size !== 1 ? 's' : ''} marked important</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saved && <span className="text-sm" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Settings saved</span>}
            <button type="button" className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSave}>
              <Save size={16} /> Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
