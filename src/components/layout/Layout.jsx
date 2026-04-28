import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleMobile = () => setMobileMenuOpen(v => !v);
  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${isMobile ? 'is-mobile' : ''}`}>
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={closeMobile}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      {mobileMenuOpen && <div className="sidebar-backdrop" onClick={closeMobile} />}
      <div className="main-wrapper">
        <Header onToggleMobile={toggleMobile} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
