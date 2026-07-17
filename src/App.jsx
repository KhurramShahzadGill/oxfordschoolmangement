import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Parents from './pages/Parents';
import Classes from './pages/Classes';
import Fees from './pages/Fees';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { supabase } from './services/supabase';
import { loadSchoolContext } from './services/db';

// Auth guard — allows access only when a Supabase session exists, and loads
// the user's school (branding + settings) before showing the app.
const RequireAuth = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'in' | 'out'

  useEffect(() => {
    let active = true;
    const resolve = async (session) => {
      if (!session) { if (active) setStatus('out'); return; }
      try { await loadSchoolContext(); } catch { /* fall back to defaults */ }
      if (active) setStatus('in');
    };
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (status === 'loading') {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading…</div>;
  }
  if (status === 'out') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="parents" element={<Parents />} />
          <Route path="classes" element={<Classes />} />
          <Route path="fees" element={<Fees />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
