import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  User, Users, Shield, Link2, Info, Save, Copy, Check, Plus, Trash2,
  Star, Settings as SettingsIcon, Eye, EyeOff, ExternalLink,
  RefreshCw, Lock, Mail, LogOut, Bot, Server, Key, BrainCircuit,
  Unlink, ChevronDown, ChevronUp, Search, Sparkles, Cpu, Network, Zap, X,
  CheckCircle, AlertCircle, Wifi, Terminal, Code, ArrowRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useYouTube } from '../hooks/useYouTubeStore';
import { useAIStore } from '../hooks/useAIStore';
import './Settings.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'accounts', label: 'Accounts', icon: Users, adminOnly: true },
  { id: 'integration', label: 'Integration', icon: Link2 },
  { id: 'ai', label: 'AI Assistants', icon: Bot },
  { id: 'about', label: 'About', icon: Info },
];

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuth();
  const visibleTabs = useMemo(() => TABS.filter(tab => !tab.adminOnly || user?.role === 'admin'), [user?.role]);

  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === activeTab)) setActiveTab('profile');
  }, [activeTab, visibleTabs]);

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Kelola profil, keamanan, dan integrasi YouTube</p>

      {/* Tab bar */}
      <div className="settings-tabs">
        {visibleTabs.map(tab => (
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
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'integration' && <IntegrationTab />}
        {activeTab === 'ai' && <AITab />}
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
  const getAvatarSrc = (url) => {
    if (!url) return '';
    if (url.startsWith('/uploads/') && url.split('/').length === 3) {
      const file = url.split('/').pop();
      return `/uploads/images/${file}`;
    }
    return url;
  };

  const [avatarUrl, setAvatarUrl] = useState(getAvatarSrc(user?.avatar_url));
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const initials = nickname
    ? nickname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSave = () => {
    updateProfile({ nickname: nickname.trim(), email: email.trim(), avatar_url: avatarUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('streamtube_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/upload', { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (data.success && data.file) {
        setAvatarUrl(data.file.url);
        updateProfile({ avatar_url: data.file.url }); // Auto save to database
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Avatar upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stab-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <User size={18} />
          <h2>Informasi Profil</h2>
        </div>

        <div className="profile-avatar-section">
          <div className="profile-avatar-big" style={{ background: user?.avatarColor || 'var(--accent-purple)', position: 'relative', overflow: 'hidden' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
            <div 
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', fontSize: '10px', textAlign: 'center', cursor: 'pointer', padding: '4px 0' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? '...' : 'Change'}
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
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
          {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Profile</>}
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

  const handleChange = async () => {
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
      setMsg({ type: 'error', text: 'Password confirmation does not match' });
      return;
    }
    const result = await changePassword(currentPw, newPw);
    if (result.success) {
      setMsg({ type: 'success', text: 'Password changed successfully' });
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
              placeholder="Enter current password"
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
function AccountsTab() {
  const { user, fetchUsers, updateUserRole, deleteUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const result = await fetchUsers();
    if (result.success) {
      setUsers(result.users || []);
      setMsg({ type: '', text: '' });
    } else {
      setMsg({ type: 'error', text: result.error || 'Gagal memuat akun' });
    }
    setLoading(false);
  }, [fetchUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (targetUser, role) => {
    const result = await updateUserRole(targetUser.id, role);
    if (!result.success) {
      setMsg({ type: 'error', text: result.error || 'Gagal mengubah role' });
      return;
    }
    setUsers(prev => prev.map(item => item.id === targetUser.id ? result.user : item));
    setMsg({ type: 'success', text: `Role ${targetUser.email} diubah ke ${role}` });
  };

  const handleDelete = async (targetUser) => {
    if (!confirm(`Hapus akun ${targetUser.email}? Data milik akun ini juga akan dibersihkan.`)) return;
    const result = await deleteUser(targetUser.id);
    if (!result.success) {
      setMsg({ type: 'error', text: result.error || 'Gagal menghapus akun' });
      return;
    }
    setUsers(prev => prev.filter(item => item.id !== targetUser.id));
    setMsg({ type: 'success', text: `Akun ${targetUser.email} dihapus` });
  };

  return (
    <div className="stab-section accounts-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <Users size={18} />
          <div className="stab-header-left">
            <h2>Account Roles</h2>
            <span className="stab-header-sub">Admin dapat memilih role admin atau user.</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {msg.text && <div className={`stab-msg ${msg.type}`}>{msg.text}</div>}

        <div className="accounts-list">
          {loading ? (
            <div className="accounts-empty">Loading accounts...</div>
          ) : users.length === 0 ? (
            <div className="accounts-empty">Belum ada akun.</div>
          ) : users.map(account => (
            <div key={account.id} className="account-row">
              <div className="account-avatar">
                {account.avatar_url ? (
                  <img src={account.avatar_url} alt="" />
                ) : (
                  <span>{(account.nickname || account.email || 'U').slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="account-info">
                <div className="account-name">
                  {account.nickname || 'User'}
                  {account.id === user?.id && <span className="account-self">You</span>}
                </div>
                <span className="account-email">{account.email}</span>
              </div>
              <select
                className="account-role-select"
                value={account.role || 'user'}
                onChange={e => handleRoleChange(account, e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                className="icon-action-btn danger"
                onClick={() => handleDelete(account)}
                disabled={account.id === user?.id}
                title={account.id === user?.id ? 'Tidak bisa hapus akun sendiri' : 'Hapus akun'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
            <span>API Credentials saved</span>
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
            <p>No channels connected yet.</p>
            <p className="no-channels-hint">Save your API credentials then click "Add Channel" to connect your YouTube channel.</p>
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
            StreamTube Pro is a YouTube streaming dashboard that lets you manage live streams,
            media library, playlists, overlays, and multi-account support in one application.
          </p>
        </div>
      </div>
    </div>
  );
}
/* ─── AI Assistants Tab ─── */
function AITab() {
  const {
    config, updateConfig, addProvider, deleteProvider, updateProviderDetails,
    deleteApiKey, addApiKeys, fetchAvailableModels, testConnection,
    getEffectiveKey, getEffectiveBase, getEffectiveEndpoint, saveProviderModels,
  } = useAIStore();

  const providers = config.providers || [];
  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [modelName, setModelName] = useState(config.modelName || '');
  const [modelList, setModelList] = useState(config.providerModels?.[config.provider || 'gemini'] || []);
  const [modSearch, setModSearch] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [endpointDrafts, setEndpointDrafts] = useState({});
  const [saved, setSaved] = useState(false);
  const [addKeyMsg, setAddKeyMsg] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    type: 'openai-compatible',
    baseUrl: '',
    chat: '/chat/completions',
    models: '/models',
  });

  const activeProvider = providers.find(p => p.id === provider) || providers[0];
  const storedKeys = getEffectiveKey(provider).split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
  const hasKeys = storedKeys.length > 0;

  const getTheme = (item) => {
    const themes = {
      gemini: { icon: <Sparkles size={18} />, color: '#4285f4' },
      openai: { icon: <BrainCircuit size={18} />, color: '#10a37f' },
      anthropic: { icon: <Zap size={18} />, color: '#d97757' },
      grok: { icon: <X size={18} />, color: '#a0a0a0' },
      groq: { icon: <Cpu size={18} />, color: '#f55036' },
      openrouter: { icon: <Network size={18} />, color: '#3b82f6' },
      devin: { icon: <Terminal size={18} />, color: '#f5a623' },
      leonardo: { icon: <Sparkles size={18} />, color: '#a855f7' },
    };
    if (themes[item?.id]) return themes[item.id];
    if (item?.type === 'leonardo') return themes.leonardo;
    if (item?.type === 'anthropic') return themes.anthropic;
    return { icon: <Server size={18} />, color: '#4d8eff' };
  };

  const endpointFields = useMemo(() => {
    if (!activeProvider) return [];
    if (activeProvider.type === 'gemini') return [];
    if (activeProvider.type === 'anthropic') return [{ key: 'messages', label: 'Messages Endpoint', placeholder: '/messages' }];
    if (activeProvider.type === 'devin') return [{ key: 'sessions', label: 'Sessions Endpoint', placeholder: '/sessions' }];
    if (activeProvider.type === 'leonardo') {
      return [
        { key: 'image', label: 'Image V2 Endpoint', placeholder: '/v2/generations' },
        { key: 'imageLegacy', label: 'Image V1 Endpoint', placeholder: '/v1/generations' },
        { key: 'video', label: 'Video Endpoint', placeholder: '/v2/generations' },
        { key: 'videoImage', label: 'Image-to-Video Endpoint', placeholder: '/v1/generations-image-to-video' },
        { key: 'status', label: 'Status Endpoint', placeholder: '/v1/generations/{{id}}' },
      ];
    }
    return [
      { key: 'chat', label: 'Chat Endpoint', placeholder: '/chat/completions' },
      { key: 'models', label: 'Models Endpoint', placeholder: '/models' },
    ];
  }, [activeProvider]);

  useEffect(() => {
    if (!providers.length) return;
    const nextProvider = providers.some(p => p.id === provider) ? provider : providers[0].id;
    if (nextProvider !== provider) setProvider(nextProvider);
  }, [providers, provider]);

  useEffect(() => {
    if (!activeProvider) return;
    setBaseUrl(getEffectiveBase(activeProvider.id));
    const endpoints = {};
    Object.keys(activeProvider.endpoints || {}).forEach(key => {
      endpoints[key] = getEffectiveEndpoint(activeProvider.id, key);
    });
    setEndpointDrafts(endpoints);
    const savedModels = config.providerModels?.[activeProvider.id] || [];
    setModelList(savedModels.length ? savedModels : []);
    // Only set modelName when switching providers
    setModelName(activeProvider.id === config.provider ? (config.modelName || savedModels[0] || '') : (savedModels[0] || ''));
    setFetchMsg('');
    setTestResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider?.id, config.provider]);

  const handleProviderSelect = (prov) => {
    setProvider(prov.id);
    setApiKeyInput('');
    updateConfig({
      provider: prov.id,
      modelName: config.providerModels?.[prov.id]?.[0] || modelName,
      baseUrl: getEffectiveBase(prov.id),
    });
  };

  const handleAddKey = async () => {
    const raw = apiKeyInput.trim();
    if (!raw) return;
    const result = addApiKeys(provider, raw);
    setApiKeyInput('');
    setAddKeyMsg(result.duplicates > 0
      ? `${result.total} key(s) total. ${result.duplicates} duplikat di-skip.`
      : `Key ditambahkan. Total: ${result.total}`);
    setTimeout(() => setAddKeyMsg(''), 3000);

    // Auto-fetch models after adding key
    if (result.added > 0) {
      setFetchingModels(true);
      setFetchMsg('');
      try {
        const models = await fetchAvailableModels(provider, raw, baseUrl || getEffectiveBase(provider));
        if (models.length) {
          setModelList(models);
          saveProviderModels(provider, models);
          if (!modelName && models[0]) {
            setModelName(models[0]);
            updateConfig({ provider, modelName: models[0] });
          }
          setFetchMsg(`${models.length} models found`);
        }
      } catch (e) {
        setFetchMsg(`Models: ${e.message}`);
      } finally {
        setFetchingModels(false);
      }
    }
  };

  const handleSaveProvider = () => {
    updateProviderDetails(provider, {
      baseUrl: baseUrl.trim(),
      endpoints: endpointDrafts,
    });
    updateConfig({ provider, modelName: modelName.trim(), baseUrl: baseUrl.trim() });
    if (modelList.length) saveProviderModels(provider, modelList);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleModelSelect = (model) => {
    setModelName(model);
    // Only update the active model, don't touch providerModels
    updateConfig({ provider, modelName: model });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handleFetchModels = async () => {
    const effectiveKey = getEffectiveKey(provider);
    if (!effectiveKey) { setFetchMsg('Tambahkan API key terlebih dahulu'); return; }
    setFetchingModels(true);
    setFetchMsg('');
    try {
      const models = await fetchAvailableModels(provider, effectiveKey, baseUrl || getEffectiveBase(provider));
      const nextModels = models.length ? models : modelList;
      setModelList(nextModels);
      if (!modelName && nextModels[0]) setModelName(nextModels[0]);
      saveProviderModels(provider, nextModels);
      setFetchMsg(`${models.length} models found`);
    } catch (e) {
      setFetchMsg(e.message);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTest = async () => {
    const effectiveKey = getEffectiveKey(provider);
    if (!effectiveKey) { setTestResult({ ok: false, msg: 'Tambahkan API key terlebih dahulu' }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await testConnection(provider, effectiveKey, baseUrl || getEffectiveBase(provider), modelName);
      setTestResult({ ok: true, msg: reply });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleAddProvider = () => {
    if (!newProvider.name.trim()) return;
    const endpoints = newProvider.type === 'anthropic'
      ? { messages: '/messages' }
      : { chat: newProvider.chat || '/chat/completions', models: newProvider.models || '/models' };
    const providerDef = addProvider({
      name: newProvider.name.trim(),
      type: newProvider.type,
      baseUrl: newProvider.baseUrl.trim(),
      endpoints,
    });
    setProvider(providerDef.id);
    setShowAddProvider(false);
    setNewProvider({ name: '', type: 'openai-compatible', baseUrl: '', chat: '/chat/completions', models: '/models' });
  };

  const filteredModels = modelList.filter(model => model.toLowerCase().includes(modSearch.toLowerCase()));
  const activeTheme = getTheme(activeProvider);

  return (
    <div className="stab-section ai-tab-layout">
      <div className="glass-card stab-card">
        <div className="stab-header ai-provider-header">
          <div className="stab-header-left">
            <h2>AI Providers</h2>
            <span className="stab-header-sub">Add, edit, atau hapus provider tambahan.</span>
          </div>
          <button className="btn btn-blue btn-sm" onClick={() => setShowAddProvider(v => !v)}>
            <Plus size={13} /> Add Provider
          </button>
        </div>

        {showAddProvider && (
          <div className="ai-add-provider">
            <div className="form-group">
              <label className="form-label"><Server size={13} /> Provider Name</label>
              <input className="form-input" value={newProvider.name} onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))} placeholder="Together AI, Local LLM, etc." />
            </div>
            <div className="ai-provider-form-grid">
              <div className="form-group">
                <label className="form-label"><SettingsIcon size={13} /> Type</label>
                <select className="form-input" value={newProvider.type} onChange={e => setNewProvider(p => ({ ...p, type: e.target.value }))}>
                  <option value="openai-compatible">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label"><Link2 size={13} /> Base URL</label>
                <input className="form-input" value={newProvider.baseUrl} onChange={e => setNewProvider(p => ({ ...p, baseUrl: e.target.value }))} placeholder="https://api.example.com/v1" />
              </div>
            </div>
            {newProvider.type === 'openai-compatible' && (
              <div className="ai-provider-form-grid">
                <div className="form-group">
                  <label className="form-label"><ArrowRight size={13} /> Chat Endpoint</label>
                  <input className="form-input" value={newProvider.chat} onChange={e => setNewProvider(p => ({ ...p, chat: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label"><ArrowRight size={13} /> Models Endpoint</label>
                  <input className="form-input" value={newProvider.models} onChange={e => setNewProvider(p => ({ ...p, models: e.target.value }))} />
                </div>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleAddProvider} disabled={!newProvider.name.trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}

        <div className="ai-prov-grid dynamic">
          {providers.map(item => {
            const theme = getTheme(item);
            const hasKey = !!(getEffectiveKey(item.id) || '').split(/[,\n]+/).map(k => k.trim()).filter(Boolean).length;
            return (
              <button
                key={item.id}
                className={`ai-prov-card ${provider === item.id ? 'active' : ''} ${hasKey ? 'has-key' : ''}`}
                style={{ '--prov-color': theme.color }}
                onClick={() => handleProviderSelect(item)}
                title={item.name}
              >
                <span className="ai-prov-icon">{theme.icon}</span>
                <span className="ai-prov-name">{item.short || item.name}</span>
                {hasKey && provider !== item.id && <span className="ai-prov-key-dot" />}
                {!item.system && (
                  <span
                    className="ai-prov-remove"
                    title="Delete provider"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Hapus provider ${item.name}?`)) deleteProvider(item.id);
                    }}
                  >
                    <Trash2 size={11} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeProvider && (
          <>
            <div className="ai-active-badge" style={{ '--prov-color': activeTheme.color }}>
              <span style={{ color: activeTheme.color, display: 'flex' }}>{activeTheme.icon}</span>
              <span>{activeProvider.name}</span>
              <span className="ai-capability-badge">{(activeProvider.capabilities || []).join(' / ')}</span>
            </div>

            {activeProvider.type !== 'gemini' && (
              <div className="form-group">
                <label className="form-label"><Link2 size={13} /> Base URL</label>
                <input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={activeProvider.baseUrl || 'https://api.example.com/v1'} />
              </div>
            )}

            {endpointFields.length > 0 && (
              <div className="ai-endpoint-grid">
                {endpointFields.map(field => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label"><ArrowRight size={13} /> {field.label}</label>
                    <input
                      className="form-input"
                      value={endpointDrafts[field.key] || ''}
                      onChange={e => setEndpointDrafts(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label"><Key size={13} /> Add API Key</label>
              <div className="pw-field ai-key-field">
                <input
                  className="form-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKey(); } }}
                  placeholder="Paste API key baru"
                />
                <button className="pw-eye" onClick={() => setShowKey(v => !v)} title={showKey ? 'Hide' : 'Show'}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button className="pw-eye ai-key-add" onClick={handleAddKey} disabled={!apiKeyInput.trim()} title="Tambah key">
                  <Plus size={14} />
                </button>
              </div>
              {addKeyMsg && <p className="ai-fetch-msg ok">{addKeyMsg}</p>}
              {hasKeys && (
                <div className="ai-saved-keys">
                  <span className="ai-saved-keys-title"><CheckCircle size={10} /> Saved Keys ({storedKeys.length})</span>
                  {storedKeys.map((key, idx) => (
                    <div key={`${key}-${idx}`} className="ai-saved-key-row">
                      <span>{showKey ? key : `${'*'.repeat(Math.max(0, key.length - 8))}${key.slice(-8)}`}</span>
                      <button onClick={() => deleteApiKey(provider, key)} title="Hapus key ini"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className={`btn ${saved ? 'btn-green' : 'btn-primary'} stab-save-btn`} onClick={handleSaveProvider}>
              {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Provider</>}
            </button>
          </>
        )}
      </div>

      <div className="glass-card stab-card">
        <div className="stab-header">
          <BrainCircuit size={18} />
          <h2>Model &amp; Test</h2>
        </div>

        {activeProvider && (activeProvider.capabilities || []).includes('text') ? (
          <>
            <div className="form-group">
              <div className="ai-model-label-row">
                <label className="form-label" style={{ margin: 0 }}><BrainCircuit size={13} /> Model</label>
                <button className="ai-fetch-btn" onClick={handleFetchModels} disabled={fetchingModels || !hasKeys}>
                  <RefreshCw size={12} className={fetchingModels ? 'spin' : ''} />
                  {fetchingModels ? 'Fetching...' : 'Update List'}
                </button>
              </div>
              <div className="ai-model-search">
                <Search size={13} />
                <input type="text" placeholder="Search models..." value={modSearch} onChange={e => setModSearch(e.target.value)} />
              </div>
              {fetchMsg && <p className={`ai-fetch-msg ${fetchMsg.toLowerCase().includes('error') || fetchMsg.toLowerCase().includes('gagal') ? 'err' : 'ok'}`}>{fetchMsg}</p>}
              <div className="ai-model-list">
                {filteredModels.length === 0 ? (
                  <div className="ai-model-empty">Model list kosong. Isi manual atau update list.</div>
                ) : filteredModels.map(model => (
                  <button
                    type="button"
                    key={model}
                    className={`ai-model-item ${modelName === model ? 'active' : ''}`}
                    onClick={() => handleModelSelect(model)}
                    style={modelName === model ? { '--prov-color': activeTheme.color } : {}}
                  >
                    <span className="ai-model-name">{model}</span>
                    {modelName === model && <CheckCircle size={13} style={{ color: activeTheme.color, flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
              <input className="form-input ai-manual-model" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="model-name" />
            </div>
          </>
        ) : (
          <div className="ai-media-provider-note">
            <Sparkles size={18} />
            <span>Provider ini dipakai oleh tab Generate Image/Video.</span>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label"><Wifi size={13} /> Test Connection</label>
          <button className="ai-test-btn" onClick={handleTest} disabled={testing || !hasKeys}>
            {testing ? <><RefreshCw size={14} className="spin" /> Testing connection...</> : <><Wifi size={14} /> Run Test</>}
          </button>
          {testResult && (
            <div className={`ai-test-result ${testResult.ok ? 'ok' : 'err'}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span style={{ whiteSpace: 'pre-wrap' }}>{testResult.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
