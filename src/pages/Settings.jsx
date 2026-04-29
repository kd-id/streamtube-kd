import { useState, useEffect, useMemo } from 'react';
import {
  User, Shield, Link2, Info, Save, Copy, Check, Plus, Trash2,
  Star, Settings as SettingsIcon, Eye, EyeOff, ExternalLink,
  RefreshCw, Lock, Mail, LogOut, Bot, Server, Key, BrainCircuit,
  Unlink, ChevronDown, ChevronUp, Search, Sparkles, Cpu, Network, Zap, X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useYouTube } from '../hooks/useYouTubeStore';
import { useAIStore } from '../hooks/useAIStore';
import './Settings.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
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
/* ─── AI Assistants Tab ─── */
const AI_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', icon: <Sparkles size={14}/>, color: '#1a73e8', defaultBase: '' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', icon: <BrainCircuit size={14}/>, color: '#10a37f', defaultBase: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: <Zap size={14}/>, color: '#d97757', defaultBase: 'https://api.anthropic.com/v1' },
  { id: 'grok', name: 'Grok (xAI)', icon: <X size={14}/>, color: '#ffffff', defaultBase: 'https://api.x.ai/v1' },
  { id: 'groq', name: 'Groq', icon: <Cpu size={14}/>, color: '#f55036', defaultBase: 'https://api.groq.com/openai/v1' },
  { id: 'openrouter', name: 'OpenRouter', icon: <Network size={14}/>, color: '#3b82f6', defaultBase: 'https://openrouter.ai/api/v1' },
  { id: 'custom', name: 'Custom Endpoint', icon: <Server size={14}/>, color: '#8b5cf6', defaultBase: '' },
];

const AI_MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  grok: ['grok-2', 'grok-2-mini'],
  groq: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
  openrouter: ['google/gemini-2.5-flash', 'openai/gpt-4o', 'anthropic/claude-3-opus', 'meta-llama/llama-3-70b-instruct'],
  custom: []
};

function AITab() {
  const { config, updateConfig } = useAIStore();
  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [modelName, setModelName] = useState(config.modelName || 'gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '');
  
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [showProvDrop, setShowProvDrop] = useState(false);
  const [showModDrop, setShowModDrop] = useState(false);
  const [modSearch, setModSearch] = useState('');

  const activeProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];
  const modelOptions = AI_MODELS[provider] || [];
  const filteredModels = modelOptions.filter(m => m.toLowerCase().includes(modSearch.toLowerCase()));

  const isDirty = provider !== config.provider || apiKey !== config.apiKey || modelName !== config.modelName || baseUrl !== config.baseUrl;

  const handleProviderSelect = (prov) => {
    setProvider(prov.id);
    setBaseUrl(prov.defaultBase);
    setModelName(AI_MODELS[prov.id]?.[0] || '');
    setShowProvDrop(false);
  };

  const handleSave = () => {
    updateConfig({ provider, apiKey: apiKey.trim(), modelName: modelName.trim(), baseUrl: baseUrl.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="stab-section">
      <div className="glass-card stab-card">
        <div className="stab-header">
          <Bot size={18} />
          <h2>AI Assistants Configuration</h2>
        </div>
        <p className="form-hint" style={{ marginBottom: '20px' }}>
          Konfigurasi API untuk fitur Auto-Generate (Judul, Deskripsi, Tags) otomatis di menu Streams.
        </p>

        {/* AI Provider Dropdown */}
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label"><Server size={14} /> AI Provider</label>
          <div className="csm-rtmp-field" style={{ position: 'relative' }}>
            <button
              className="form-input"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-hover)', cursor: 'pointer', textAlign: 'left', border: `1px solid ${activeProvider.color}44` }}
              onClick={() => setShowProvDrop(!showProvDrop)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: activeProvider.color, display: 'flex', alignItems: 'center' }}>{activeProvider.icon}</span>
                <span>{activeProvider.name}</span>
              </div>
              {showProvDrop ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showProvDrop && (
              <div className="csm-platform-dropdown-v2" style={{ top: 'calc(100% + 4px)', left: 0, right: 0, width: '100%', maxHeight: '250px', overflowY: 'auto' }}>
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    className={`csm-pd-item ${provider === p.id ? 'active' : ''}`}
                    onClick={() => handleProviderSelect(p)}
                  >
                    <span className="csm-pd-icon" style={{ background: p.color + '22', color: p.color }}>
                      {p.icon}
                    </span>
                    <span className="csm-pd-label">{p.name}</span>
                    {provider === p.id && <span className="csm-pd-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Base URL (shown only if needed) */}
        {(provider === 'custom' || provider === 'openai' || provider === 'groq' || provider === 'grok' || provider === 'openrouter' || provider === 'anthropic') && (
          <div className="form-group">
            <label className="form-label"><Link2 size={14} /> {provider === 'custom' ? 'Custom Endpoint URL' : 'API Base URL'}</label>
            <input
              className="form-input"
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>
        )}

        {/* Model Selection Dropdown */}
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label"><BrainCircuit size={14} /> {provider === 'custom' ? 'Custom Model Name' : 'Model'}</label>
          
          {provider === 'custom' ? (
            <input
              className="form-input"
              type="text"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="model-name"
            />
          ) : (
            <div className="csm-rtmp-field" style={{ position: 'relative' }}>
              <button
                className="form-input"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-hover)', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => { setShowModDrop(!showModDrop); setModSearch(''); }}
              >
                <span>{modelName || 'Select a model...'}</span>
                {showModDrop ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {showModDrop && (
                <div className="csm-platform-dropdown-v2" style={{ top: 'calc(100% + 4px)', left: 0, right: 0, width: '100%', padding: '0', overflow: 'hidden' }}>
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search model..." 
                      value={modSearch} 
                      onChange={e => setModSearch(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '13px' }}
                      autoFocus
                    />
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredModels.length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Model not found.</div>
                    ) : (
                      filteredModels.map(m => (
                        <button
                          key={m}
                          className={`csm-pd-item ${modelName === m ? 'active' : ''}`}
                          onClick={() => { setModelName(m); setShowModDrop(false); }}
                          style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)22' }}
                        >
                          <span className="csm-pd-label">{m}</span>
                          {modelName === m && <span className="csm-pd-check">✓</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label"><Key size={14} /> API Key</label>
          <div className="pw-field">
            <input
              className="form-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
            <button className="pw-eye" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button className={`btn ${saved ? 'btn-green' : 'btn-primary'} stab-save-btn`} onClick={handleSave} disabled={!isDirty && !saved} style={{ marginTop: '16px' }}>
          {saved ? <><Check size={15} /> Tersimpan!</> : <><Save size={15} /> Save</>}
        </button>
      </div>
    </div>
  );
}
