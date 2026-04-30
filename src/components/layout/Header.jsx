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
            style={{ padding: '2px', borderRadius: '50%' }}
            onClick={() => setShowUserMenu(v => !v)}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="header-avatar-img" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="header-avatar" style={{ background: user?.avatarColor || 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' }}>
                <span>{initials}</span>
              </div>
            )}
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="dropdown-avatar" style={{ background: user?.avatarColor || 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' }}>
                    {initials}
                  </div>
                )}
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
