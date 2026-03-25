import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const teacherLinks = [
  { path: '/teacher/dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/teacher/courses',   icon: '📚', label: 'Courses' },
  { path: '/teacher/subjects',  icon: '📖', label: 'Subjects' },
  { path: '/teacher/timetable', icon: '📅', label: 'Timetable' },
  { path: '/teacher/attendance',icon: '✅', label: 'Attendance Logs' },
  { path: '/teacher/insights',  icon: '📊', label: 'Teacher Insights' },
];

const studentLinks = [
  { path: '/student/dashboard',        icon: '🏠', label: 'Dashboard' },
  { path: '/student/courses',          icon: '📚', label: 'My Courses' },
  { path: '/student/subjects',         icon: '📖', label: 'My Subjects' },
  { path: '/student/timetable',        icon: '📅', label: 'Timetable' },
  { path: '/student/attendance',       icon: '✅', label: 'My Attendance' },
  { path: '/student/face-registration',icon: '📷', label: 'Face Registration' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = useMemo(() => (user?.role === 'teacher' ? teacherLinks : studentLinks), [user?.role]);

  const appRootRef = useRef(null);
  // Desktop: expanded by default, can collapse to icon-only
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: hidden by default, toggled open as overlay
  const [mobileOpen, setMobileOpen] = useState(false);

  const isMobile = () => window.innerWidth <= 768;

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    const el = document.querySelector('.app');
    appRootRef.current = el;
  }, []);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;
    root.classList.toggle('sidebar-collapsed', collapsed);
    root.classList.toggle('mobile-open', mobileOpen);
  }, [collapsed, mobileOpen]);

  // Close mobile overlay on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleToggle = () => {
    if (isMobile()) setMobileOpen(v => !v);
    else setCollapsed(v => !v);
  };

  return (
    <>
      <div
        className="sidebar-overlay"
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <div className="sidebar">

        {/* Toggle button — always fully inside sidebar, never clipped */}
        <div className="sidebar-toggle-wrap">
          <div className="sidebar-brand-inner">
            <span className="brand-icon">🎓</span>
            <span className="brand-text">ClassRoom</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={handleToggle}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            {collapsed ? '→' : '☰'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map(link => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) => isActive ? 'active' : ''}
              title={link.label}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="user-name">{user?.name}</div>
            <div className="role-tag">{user?.role}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Logout" type="button">
            <span aria-hidden>⏏</span>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
