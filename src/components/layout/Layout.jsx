import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { user } = useAuth();

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
        {user?.email === 'admin@streamtube.local' && (
          <div style={{ background: '#f59e0b', color: '#000', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500', justifyContent: 'center' }}>
            <AlertTriangle size={16} />
            <span>Peringatan Keamanan: Anda masih menggunakan email dan password bawaan Super Admin.</span>
            <Link to="/settings" style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 12px', borderRadius: '4px', color: '#000', textDecoration: 'none', marginLeft: '10px' }}>Ubah Profil Sekarang</Link>
          </div>
        )}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
