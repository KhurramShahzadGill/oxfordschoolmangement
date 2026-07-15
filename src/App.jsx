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

// Auth guard — allows access only when a Supabase session exists.
const RequireAuth = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'in' | 'out'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'in' : 'out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'in' : 'out');
    });
    return () => sub.subscription.unsubscribe();
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
