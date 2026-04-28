import { useState, useEffect, useMemo } from 'react';
import {
  User, Shield, Link2, Info, Save, Copy, Check, Plus, Trash2,
  Star, Settings as SettingsIcon, Eye, EyeOff, ExternalLink,
  RefreshCw, Lock, Mail, LogOut,
  Unlink
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useYouTube } from '../hooks/useYouTubeStore';
import './Settings.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integration', label: 'Integration', icon: Link2 },
  { id: 'about', label: 'About', icon: Info },
];

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Kelola profil, keamanan, dan integrasi YouTube</p>

      {/* Tab bar */}
      <div className="settings-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-tab-content">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'integration' && <IntegrationTab />}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saved, setSaved] = useState(false);

  const initials = nickname
    ? nickname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSave = () => {
    updateProfile({ nickname: nickname.trim(), email: email.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="stab-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <User size={18} />
          <h2>Informasi Profil</h2>
        </div>

        <div className="profile-avatar-section">
          <div className="profile-avatar-big" style={{ background: user?.avatarColor || 'var(--accent-purple)' }}>
            {initials}
          </div>
          <div className="profile-avatar-info">
            <span className="profile-avatar-name">{user?.nickname || 'User'}</span>
            <span className="profile-avatar-email">{user?.email || ''}</span>
            <span className="profile-avatar-joined">Bergabung {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nickname</label>
          <input
            className="form-input"
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Nama tampilan"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="nama@email.com"
          />
        </div>

        <button className={`btn ${saved ? 'btn-green' : 'btn-primary'} stab-save-btn`} onClick={handleSave}>
          {saved ? <><Check size={15} /> Tersimpan!</> : <><Save size={15} /> Simpan Profil</>}
        </button>
      </div>
    </div>
  );
}

/* ─── Security Tab ─── */
function SecurityTab() {
  const { changePassword } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleChange = () => {
    setMsg({ type: '', text: '' });
    if (!currentPw || !newPw || !confirmPw) {
      setMsg({ type: 'error', text: 'Semua field wajib diisi' });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ type: 'error', text: 'Password baru minimal 6 karakter' });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' });
      return;
    }
    const result = changePassword(currentPw, newPw);
    if (result.success) {
      setMsg({ type: 'success', text: 'Password berhasil diubah' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } else {
      setMsg({ type: 'error', text: result.error });
    }
  };

  return (
    <div className="stab-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <Shield size={18} />
          <h2>Ganti Password</h2>
        </div>

        {msg.text && (
          <div className={`stab-msg ${msg.type}`}>
            {msg.text}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Password Lama</label>
          <div className="pw-field">
            <input
              className="form-input"
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              placeholder="Masukkan password lama"
            />
            <button className="pw-eye" onClick={() => setShowCurrent(v => !v)}>
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Password Baru</label>
          <div className="pw-field">
            <input
              className="form-input"
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
            <button className="pw-eye" onClick={() => setShowNew(v => !v)}>
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Konfirmasi Password Baru</label>
          <input
            className="form-input"
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder="Ketik ulang password baru"
          />
        </div>

        <button className="btn btn-primary stab-save-btn" onClick={handleChange}>
          <Lock size={15} /> Ganti Password
        </button>
      </div>
    </div>
  );
}

/* ─── Integration Tab ─── */
function IntegrationTab() {
  const { credentials, channels, connecting, hasCredentials, saveCredentials, connectChannel, removeChannel, setDefaultChannel, disconnectAll } = useYouTube();
  const [clientId, setClientId] = useState(credentials.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [credSaved, setCredSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Track dirty state — only enable save when something has changed
  const isDirty = useMemo(() => {
    const idChanged = clientId.trim() !== credentials.clientId;
    const secretChanged = clientSecret.trim() !== '';
    return idChanged || secretChanged;
  }, [clientId, clientSecret, credentials.clientId]);

  const handleSaveCred = () => {
    if (!isDirty) return;
    saveCredentials(clientId.trim(), clientSecret.trim() || credentials.clientSecret);
    setCredSaved(true);
    setClientSecret(''); // Reset secret field after save
    setTimeout(() => setCredSaved(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(credentials.redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddChannel = () => {
    const result = connectChannel();
    if (result && !result.success) {
      alert(result.error);
    }
  };

  return (
    <div className="integration-layout">
      {/* Left: YouTube Integration */}
      <div className="glass-card stab-card integration-left">
        <div className="stab-header">
          <Link2 size={18} />
          <h2>YouTube Integration</h2>
        </div>

        {/* Credential status indicator */}
        {hasCredentials && (
          <div className="cred-status-badge">
            <Check size={13} />
            <span>API Credentials tersimpan</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            <ExternalLink size={12} /> Authorized Redirect URI
          </label>
          <p className="form-hint">Copy this URL and add it to your Google Cloud OAuth 2.0 credentials</p>
          <div className="copy-field">
            <input className="form-input" type="text" value={credentials.redirectUri} readOnly />
            <button className="copy-btn" onClick={handleCopy} title="Copy to clipboard">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <SettingsIcon size={12} /> Client ID
          </label>
          <input
            className="form-input"
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <Lock size={12} /> Client Secret
          </label>
          <p className="form-hint">Enter a new value to update</p>
          <div className="pw-field">
            <input
              className="form-input"
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder={credentials.clientSecret ? '••••••••••••••••' : 'Enter client secret'}
            />
            <button className="pw-eye" onClick={() => setShowSecret(v => !v)}>
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          className={`btn ${credSaved ? 'btn-green' : isDirty ? 'btn-blue' : 'btn-secondary'} stab-save-btn`}
          onClick={handleSaveCred}
          disabled={!isDirty && !credSaved}
        >
          {credSaved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save API Credentials</>}
        </button>
      </div>

      {/* Right: Connected Channels */}
      <div className="glass-card stab-card integration-right">
        <div className="stab-header">
          <div className="stab-header-left">
            <h2>Connected Channels</h2>
            <span className="stab-header-sub">Manage your YouTube channels for streaming</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAddChannel}
            disabled={connecting}
          >
            {connecting ? (
              <><RefreshCw size={13} className="spin" /> Connecting...</>
            ) : (
              <><Plus size={13} /> Add Channel</>
            )}
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="no-channels">
            <p>Belum ada channel terhubung.</p>
            <p className="no-channels-hint">Simpan API credentials lalu klik "Add Channel" untuk menghubungkan akun YouTube.</p>
          </div>
        ) : (
          <>
            <div className="channels-list">
              {channels.map(ch => (
                <div key={ch.id} className={`channel-row ${ch.isDefault ? 'is-default' : ''}`}>
                  {ch.avatarUrl ? (
                    <img src={ch.avatarUrl} alt="" className="channel-row-avatar" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="channel-row-avatar" style={{ background: ch.avatarColor }}>
                      {ch.avatar}
                    </div>
                  )}
                  <div className="channel-row-info">
                    <div className="channel-row-name">
                      {ch.name}
                      {ch.isDefault && <span className="default-badge">Default</span>}
                    </div>
                    <span className="channel-row-subs">{formatNum(ch.subscribers)} subscribers</span>
                    {ch.email && <span className="channel-row-email"><Mail size={11} /> {ch.email}</span>}
                    {ch.handle && <span className="channel-row-handle">{ch.handle}</span>}
                  </div>
                  <div className="channel-row-actions">
                    {!ch.isDefault && (
                      <button
                        className="icon-action-btn"
                        onClick={() => setDefaultChannel(ch.id)}
                        title="Set as default"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      className="icon-action-btn danger"
                      onClick={() => removeChannel(ch.id)}
                      title="Disconnect channel"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {channels.length > 0 && (
              <button className="disconnect-all-btn" onClick={disconnectAll}>
                <Unlink size={13} /> Disconnect All Channels
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── About Tab ─── */
function AboutTab() {
  return (
    <div className="stab-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <Info size={18} />
          <h2>Tentang Aplikasi</h2>
        </div>

        <div className="about-content">
          <div className="about-logo">
            <div className="about-logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
                <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
              </svg>
            </div>
            <div>
              <h3>StreamTube Pro</h3>
              <span className="about-version">Version 1.0.0</span>
            </div>
          </div>

          <div className="about-items">
            <div className="about-item">
              <span className="about-item-label">Platform</span>
              <span className="about-item-value">Web Application (React + Vite)</span>
            </div>
            <div className="about-item">
              <span className="about-item-label">Status</span>
              <span className="about-item-value about-status">● Active</span>
            </div>
            <div className="about-item">
              <span className="about-item-label">License</span>
              <span className="about-item-value">Personal Use</span>
            </div>
          </div>

          <p className="about-desc">
            StreamTube Pro adalah dashboard streaming YouTube yang memungkinkan kamu mengelola live stream,
            media library, playlist, overlays, dan multi-akun dalam satu aplikasi.
          </p>
        </div>
      </div>
    </div>
  );
}
