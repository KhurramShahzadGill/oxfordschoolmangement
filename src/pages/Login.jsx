import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../services/db';

export default function Login() {
  const navigate = useNavigate();
  const settings = getSettings();

  const handleLogin = (e) => {
    e.preventDefault();
    localStorage.setItem('auth', 'true');
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
            <label className="form-label">Email / Username</label>
            <input type="text" className="form-input" placeholder="admin@oxford.edu" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
