import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, loadSchoolContext, getSchool } from '../services/db';
import { supabase } from '../services/supabase';

// When the request never reaches the auth server — no internet, or a database
// that has been paused for inactivity — Supabase hands back the browser's own
// "Failed to fetch". Staff read that as a rejected password and keep retrying,
// so these two cases get a plain message of their own instead.
const NO_INTERNET_MESSAGE = 'No internet connection. Please check your connection and try again.';
const NO_SERVER_MESSAGE = 'Cannot reach the server right now. This is not a password problem — please try again in a few minutes, or contact support.';

function isConnectionFailure(error) {
  if (error?.name === 'AuthRetryableFetchError') return true;
  if (error?.status === 0) return true;
  return /failed to fetch|network\s?error|network request failed|load failed/i.test(error?.message || '');
}

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

    // A thrown error means the same thing here as a returned one: the sign-in
    // did not happen. Either way it has to reach the message check below.
    let signInError;
    try {
      ({ error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }));
    } catch (thrown) {
      signInError = thrown;
    }
    setLoading(false);

    if (signInError) {
      if (isConnectionFailure(signInError)) {
        setError(navigator.onLine ? NO_SERVER_MESSAGE : NO_INTERNET_MESSAGE);
        return;
      }
      // Show Supabase's actual message during setup/testing so mismatches
      // (unconfirmed email, wrong password, etc.) are easy to diagnose.
      setError(`Login failed: ${signInError.message}`);
      return;
    }
    // Suspended schools are signed straight back out, so a valid password alone
    // is not enough to get in while the account is switched off.
    try {
      await loadSchoolContext();
      if (getSchool()?.is_active === false) {
        await supabase.auth.signOut();
        setError('Account Suspended');
        return;
      }
    } catch { /* leave the normal flow alone if the lookup fails */ }

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
