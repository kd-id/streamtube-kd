import { useState, useRef, useEffect } from 'react';
import { Bell, Search, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useStream } from '../../hooks/useStreamStore';
import { useAuth } from '../../hooks/useAuth';
import './Header.css';

export default function Header({ onToggleMobile }) {
  const { isLive } = useStream();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.nickname
    ? user.nickname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="header">
      {/* Hamburger - mobile only */}
      <button className="hamburger-btn" onClick={onToggleMobile} title="Menu">
        <Menu size={20} />
      </button>

      <div className="header-search">
        <Search size={16} className="search-icon" />
        <input type="text" placeholder="Search streams, settings..." className="search-input" />
      </div>

      <div className="header-right">
        <button className="header-icon-btn" title="Notifications">
          <Bell size={18} />
          <span className="notif-badge">3</span>
        </button>

        <div className="header-user-menu" ref={menuRef}>
          <button
            className="header-user-btn"
            onClick={() => setShowUserMenu(v => !v)}
          >
            <div className="header-avatar" style={{ background: user?.avatarColor || 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' }}>
              <span>{initials}</span>
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{user?.nickname || 'User'}</span>
              <span className="header-user-email">{user?.email || ''}</span>
            </div>
            <ChevronDown size={14} className={`header-chevron ${showUserMenu ? 'open' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="dropdown-avatar" style={{ background: user?.avatarColor || 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' }}>
                  {initials}
                </div>
                <div className="dropdown-info">
                  <span className="dropdown-name">{user?.nickname || 'User'}</span>
                  <span className="dropdown-email">{user?.email || ''}</span>
                </div>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item logout-item" onClick={logout}>
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
