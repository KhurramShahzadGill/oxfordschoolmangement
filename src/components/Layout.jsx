import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserSquare2,
  BookOpen,
  Receipt,
  Settings as SettingsIcon,
  LogOut
} from 'lucide-react';
import { getSettings, clearSchoolContext, resetDemoData } from '../services/db';
import { supabase } from '../services/supabase';
import { IS_DEMO } from '../services/demo';

export default function Layout() {
  const navigate = useNavigate();
  const settings = getSettings();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSchoolContext();
    navigate('/login');
  };

  const handleResetDemo = () => {
    if (!window.confirm('Clear all demo data and start fresh?\n\nThis only affects this browser.')) return;
    resetDemoData();
    window.location.reload();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="sidebar-header" style={{ justifyContent: 'center' }}>
          <img src={settings.logo || '/logo.png'} alt={settings.school_name} style={{ height: '50px', objectFit: 'contain', maxWidth: '100%' }} />
        </div>
        
        <nav className="nav-links">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/students" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            Students
          </NavLink>
          <NavLink to="/parents" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserSquare2 size={20} />
            Parents
          </NavLink>
          <NavLink to="/classes" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={20} />
            Classes
          </NavLink>
          <NavLink to="/fees" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={20} />
            Fees
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={20} />
            Settings
          </NavLink>
        </nav>
        
        {/* The demo has no accounts, so there is nothing to log out of. */}
        {!IS_DEMO && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleLogout}
              style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', fontWeight: 500 }}
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header no-print">
          {IS_DEMO ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 999, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                DEMO
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Try anything you like — this data stays in your browser only.
              </span>
              <button onClick={handleResetDemo}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'underline' }}>
                Reset demo
              </button>
            </div>
          ) : (
            <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
              Welcome back, Admin
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
