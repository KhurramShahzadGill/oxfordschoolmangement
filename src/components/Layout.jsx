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
import { getSettings } from '../services/db';

export default function Layout() {
  const navigate = useNavigate();
  const settings = getSettings();

  // Mock logout
  const handleLogout = () => {
    localStorage.removeItem('auth');
    navigate('/login');
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
        
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={handleLogout}
            style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', fontWeight: 500 }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header no-print">
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
            Welcome back, Admin
          </div>
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
