import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../services/db';
import { supabase } from '../services/supabase';

export default function Login() {
  const navigate = useNavigate();
  const settings = getSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError('Email or password is wrong. Please try again.');
      return;
    }
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
            <img src={settings.logo || '/logo.png'} alt="Logo" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
          </div>
          <h1 className="text-xl font-bold">{settings.school_name}</h1>
          <p className="text-sm text-secondary-color mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="admin@school.com" required
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="••••••••" required
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
