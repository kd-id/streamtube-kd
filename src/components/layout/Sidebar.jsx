import { NavLink } from 'react-router-dom';
import { useStream } from '../../hooks/useStreamStore';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Radio, Layers, BarChart3,
  DollarSign, Settings, ChevronLeft, ChevronRight,
  FolderOpen, ListMusic, X, Bug
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/streams', icon: Radio, label: 'Streams' },
  { path: '/media', icon: FolderOpen, label: 'Media' },
  { path: '/playlist', icon: ListMusic, label: 'Playlist' },
  { path: '/overlays', icon: Layers, label: 'Overlays' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/monetization', icon: DollarSign, label: 'Monetization' },
  { path: '/logs', icon: Bug, label: 'Logs' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

// Bottom nav shows only these items on mobile
const mobileNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/streams', icon: Radio, label: 'Streams' },
  { path: '/media', icon: FolderOpen, label: 'Media' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ mobileOpen, onCloseMobile, collapsed, onToggleCollapse }) {
  const { isLive } = useStream();
  const { user } = useAuth();

  const userInitials = user?.nickname
    ? user.nickname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          {!collapsed && (
            <>
              <div className="logo-icon">
                <Radio size={20} />
              </div>
              <span className="logo-text">StreamTube <span className="logo-accent">Pro</span></span>
            </>
          )}
          <button className="collapse-btn desktop-only" onClick={onToggleCollapse} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="collapse-btn mobile-close-only" onClick={onCloseMobile} title="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${item.path === '/streams' && isLive ? 'nav-live' : ''}`
              }
              end={item.path === '/'}
              title={collapsed ? item.label : undefined}
              onClick={onCloseMobile}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="channel-info">
            <div className="channel-avatar">{userInitials}</div>
            {!collapsed && (
              <div className="channel-details">
                <span className="channel-name">{user?.nickname || 'User'}</span>
                <span className="channel-handle">{user?.email || ''}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        {mobileNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
