import React, { useState } from 'react';
import { getSettings, saveSettings, defaultSettings } from '../services/db';
import { compressImage } from '../utils/image';
import { Save, RotateCcw, Building2 } from 'lucide-react';

export default function Settings() {
  const [form, setForm] = useState(getSettings());
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, { maxDim: 256, quality: 0.85 });
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

  const inputStyle = { padding: '10px 14px', fontSize: '0.9rem' };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="text-2xl font-bold">School Settings</h1>
          <p className="text-sm text-secondary-color mt-1">This information appears on fee vouchers, ID cards, reports and the login screen.</p>
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
    </div>
  );
}
