import { useState, useEffect, useMemo } from 'react';
import {
  User, Shield, Link2, Info, Save, Copy, Check, Plus, Trash2,
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
  { id: 'gemini',     name: 'Google Gemini',      short: 'Gemini',    icon: <Sparkles size={18}/>,     color: '#4285f4', grad: 'linear-gradient(135deg,#4285f4,#34a853)', defaultBase: '' },
  { id: 'openai',     name: 'OpenAI',              short: 'OpenAI',    icon: <BrainCircuit size={18}/>, color: '#10a37f', grad: 'linear-gradient(135deg,#10a37f,#1cb08e)', defaultBase: 'https://api.openai.com/v1' },
  { id: 'anthropic',  name: 'Anthropic',           short: 'Claude',    icon: <Zap size={18}/>,          color: '#d97757', grad: 'linear-gradient(135deg,#d97757,#e8935a)', defaultBase: 'https://api.anthropic.com/v1' },
  { id: 'grok',       name: 'xAI Grok',            short: 'Grok',      icon: <X size={18}/>,            color: '#a0a0a0', grad: 'linear-gradient(135deg,#555,#888)',       defaultBase: 'https://api.x.ai/v1' },
  { id: 'groq',       name: 'Groq',                short: 'Groq',      icon: <Cpu size={18}/>,          color: '#f55036', grad: 'linear-gradient(135deg,#f55036,#ff7055)', defaultBase: 'https://api.groq.com/openai/v1' },
  { id: 'openrouter', name: 'OpenRouter',          short: 'Router',    icon: <Network size={18}/>,      color: '#3b82f6', grad: 'linear-gradient(135deg,#3b82f6,#6366f1)', defaultBase: 'https://openrouter.ai/api/v1' },
  { id: 'devin',      name: 'Devin.ai',            short: 'Devin',     icon: <Terminal size={18}/>,     color: '#f5a623', grad: 'linear-gradient(135deg,#f5a623,#f8e71c)', defaultBase: 'https://api.devin.ai/v1' },
  { id: 'custom',     name: 'Custom',              short: 'Custom',    icon: <Server size={18}/>,       color: '#8b5cf6', grad: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', defaultBase: '' },
];

const AI_MODELS = {
  gemini:     ['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-2.0-flash-lite','gemini-1.5-flash','gemini-1.5-pro','gemini-1.5-flash-8b'],
  openai:     ['gpt-4.1','gpt-4.1-mini','gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],
  anthropic:  ['claude-opus-4-5','claude-sonnet-4-5','claude-haiku-4-5','claude-3-opus-20240229','claude-3-sonnet-20240229','claude-3-haiku-20240307'],
  grok:       ['grok-3','grok-3-mini','grok-2','grok-2-mini'],
  groq:       ['llama-3.3-70b-versatile','llama-3.1-8b-instant','gemma2-9b-it','mixtral-8x7b-32768'],
  openrouter: ['google/gemini-2.5-flash','google/gemini-2.5-pro','openai/gpt-4o','anthropic/claude-3-opus','meta-llama/llama-3-70b-instruct'],
  devin:      ['devin-session'], // placeholder
  custom:     [],
};

function AITab() {
  const { config, updateConfig, fetchAvailableModels, testConnection, getEffectiveKey, getEffectiveBase } = useAIStore();
  const [provider, setProvider] = useState(config.provider || 'gemini');
  
  // Load initial key and base for the selected provider
  const initialKey = getEffectiveKey(config.provider || 'gemini');
  const initialBase = getEffectiveBase(config.provider || 'gemini');

  const [apiKey, setApiKey] = useState(initialKey);
  const [modelName, setModelName] = useState(config.modelName || 'gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = useState(initialBase);
  const [customTemplate, setCustomTemplate] = useState(config.customBodyTemplate || '');
  const [customPath, setCustomPath] = useState(config.customResponsePath || '');

  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [modSearch, setModSearch] = useState('');
  const [modelList, setModelList] = useState(AI_MODELS[config.provider || 'gemini'] || AI_MODELS.gemini);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const activeProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];
  const filteredModels = modelList.filter(m => m.toLowerCase().includes(modSearch.toLowerCase()));
  
  const isDirty = provider !== config.provider || 
                  apiKey !== getEffectiveKey(config.provider) || 
                  modelName !== config.modelName || 
                  baseUrl !== getEffectiveBase(config.provider) ||
                  customTemplate !== config.customBodyTemplate ||
                  customPath !== config.customResponsePath;

  const handleProviderSelect = (prov) => {
    setProvider(prov.id);
    
    // Auto-populate devin's key if empty
    let newKey = getEffectiveKey(prov.id);
    if (prov.id === 'devin' && !newKey) newKey = 'apk_b3JnLWIxOTJiMTMxMDUzNjQ5MTFhZjQwMmUxYWE2MzMxZjQ3OjU2MDlkYzFhYzU0MzRiMTg4N2RmZWQxYzlhZjg3NDNk';
    
    setApiKey(newKey);
    setBaseUrl(getEffectiveBase(prov.id) || prov.defaultBase);
    
    const defaults = AI_MODELS[prov.id] || [];
    setModelList(defaults);
    setModelName(defaults[0] || '');
    setFetchMsg('');
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    setFetchingModels(true); setFetchMsg('');
    try {
      const models = await fetchAvailableModels(provider, apiKey, baseUrl);
      if (models.length > 0) {
        setModelList(models);
        if (!models.includes(modelName)) setModelName(models[0]);
        setFetchMsg(`✓ ${models.length} model ditemukan`);
      } else { setFetchMsg('Tidak ada model ditemukan.'); }
    } catch (e) { setFetchMsg('⚠ ' + e.message); }
    finally { setFetchingModels(false); }
  };

  useEffect(() => {
    if (provider === 'custom' || provider === 'devin' || !apiKey || !apiKey.trim()) return;
    const debounceFetch = setTimeout(() => {
      // Don't fetch if already fetching or if the key is empty
      handleFetchModels();
    }, 800);
    return () => clearTimeout(debounceFetch);
  }, [provider, apiKey, baseUrl]);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const reply = await testConnection({ provider, apiKey, modelName, baseUrl, customTemplate, customPath });
      setTestResult({ ok: true, msg: `Koneksi berhasil! Response: "${reply}"` });
    } catch (e) { setTestResult({ ok: false, msg: e.message }); }
    finally { setTesting(false); }
  };

  const handleSave = () => {
    updateConfig({ 
      provider, 
      apiKey: apiKey.trim(), 
      modelName: modelName.trim(), 
      baseUrl: baseUrl.trim(),
      customBodyTemplate: customTemplate,
      customResponsePath: customPath.trim()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="stab-section ai-tab-layout">

      {/* ── Left: Provider + Auth ── */}
      <div className="glass-card stab-card">
        <div className="stab-header">
          <Bot size={18} />
          <h2>Provider &amp; Auth</h2>
        </div>

        {/* Provider card grid */}
        <div className="form-group">
          <label className="form-label"><Server size={13} /> AI Provider</label>
          <div className="ai-prov-grid">
            {AI_PROVIDERS.map(p => (
              <button
                key={p.id}
                className={`ai-prov-card ${provider === p.id ? 'active' : ''}`}
                style={{ '--prov-color': p.color, '--prov-grad': p.grad }}
                onClick={() => handleProviderSelect(p)}
                title={p.name}
              >
                <span className="ai-prov-icon">{p.icon}</span>
                <span className="ai-prov-name">{p.short}</span>
                {provider === p.id && <span className="ai-prov-dot" />}
              </button>
            ))}
          </div>
          {/* Active provider badge */}
          <div className="ai-active-badge" style={{ '--prov-color': activeProvider.color }}>
            <span style={{ color: activeProvider.color, display: 'flex' }}>{activeProvider.icon}</span>
            <span>{activeProvider.name}</span>
          </div>
        </div>

        {/* Base URL (non-gemini) */}
        {provider !== 'gemini' && (
          <div className="form-group">
            <label className="form-label"><Link2 size={13} /> {provider === 'custom' ? 'Endpoint URL' : 'API Base URL'}</label>
            <input className="form-input" type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
          </div>
        )}

        {/* API Key */}
        <div className="form-group">
          <label className="form-label"><Key size={13} /> API Key</label>
          <div className="pw-field">
            <input className="form-input" type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Masukkan API key..." />
            <button className="pw-eye" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Custom JSON Templating */}
        {provider === 'custom' && (
          <>
            <div className="form-group">
              <label className="form-label"><Code size={13} /> JSON Body Template</label>
              <textarea 
                className="form-input" 
                style={{ fontFamily: 'monospace', minHeight: '80px', fontSize: '11px', whiteSpace: 'pre' }} 
                value={customTemplate} 
                onChange={e => setCustomTemplate(e.target.value)} 
                placeholder={`{\n  "messages": [\n    { "role": "user", "content": "{{PROMPT}}" }\n  ],\n  "model": "{{MODEL}}"\n}`} 
              />
              <p className="ai-fetch-msg" style={{color: 'var(--text-muted)'}}>Gunakan <code>{`{{PROMPT}}`}</code> dan <code>{`{{MODEL}}`}</code> sebagai placeholder.</p>
            </div>
            <div className="form-group">
              <label className="form-label"><ArrowRight size={13} /> Response Extraction Path</label>
              <input 
                className="form-input" 
                type="text" 
                value={customPath} 
                onChange={e => setCustomPath(e.target.value)} 
                placeholder="choices[0].message.content" 
                style={{ fontFamily: 'monospace', fontSize: '11px' }}
              />
            </div>
          </>
        )}

        <button className={`btn ${saved ? 'btn-green' : 'btn-primary'} stab-save-btn`} onClick={handleSave} disabled={!isDirty && !saved}>
          {saved ? <><Check size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Konfigurasi</>}
        </button>
      </div>

      {/* ── Right: Model + Test ── */}
      <div className="glass-card stab-card">
        <div className="stab-header">
          <BrainCircuit size={18} />
          <h2>Model &amp; Test</h2>
        </div>

        {/* Model section */}
        <div className="form-group">
          <div className="ai-model-label-row">
            <label className="form-label" style={{ margin: 0 }}><BrainCircuit size={13} /> Model</label>
            {provider !== 'custom' && provider !== 'devin' && (
              <button className="ai-fetch-btn" onClick={handleFetchModels} disabled={fetchingModels || !apiKey} title="Fetch model terbaru dari API">
                <RefreshCw size={12} className={fetchingModels ? 'spin' : ''} />
                {fetchingModels ? 'Fetching...' : 'Update List'}
              </button>
            )}
          </div>

          {/* Search */}
          {provider !== 'custom' && provider !== 'devin' && (
            <div className="ai-model-search">
              <Search size={13} />
              <input type="text" placeholder="Cari model..." value={modSearch} onChange={e => setModSearch(e.target.value)} />
            </div>
          )}

          {fetchMsg && (
            <p className={`ai-fetch-msg ${fetchMsg.startsWith('⚠') ? 'err' : 'ok'}`}>{fetchMsg}</p>
          )}

          {/* Model list / custom input */}
          {provider === 'custom' || provider === 'devin' ? (
            <input className="form-input" style={{ marginTop: '8px' }} type="text" value={modelName} onChange={e => setModelName(e.target.value)} placeholder={provider === 'devin' ? "devin-session" : "nama-model"} disabled={provider === 'devin'} />
          ) : (
            <div className="ai-model-list">
              {filteredModels.length === 0
                ? <div className="ai-model-empty">Model tidak ditemukan.</div>
                : filteredModels.map(m => (
                  <button
                    key={m}
                    className={`ai-model-item ${modelName === m ? 'active' : ''}`}
                    onClick={() => setModelName(m)}
                    style={modelName === m ? { '--prov-color': activeProvider.color } : {}}
                  >
                    <span className="ai-model-name">{m}</span>
                    {modelName === m && <CheckCircle size={13} style={{ color: activeProvider.color, flexShrink: 0 }} />}
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {/* Selected model display */}
        {modelName && provider !== 'custom' && provider !== 'devin' && (
          <div className="ai-selected-model" style={{ '--prov-color': activeProvider.color }}>
            <BrainCircuit size={13} />
            <span>Aktif: <strong>{modelName}</strong></span>
          </div>
        )}

        {/* Test connection */}
        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label"><Wifi size={13} /> Test Koneksi</label>
          <button
            className="ai-test-btn"
            onClick={handleTest}
            disabled={testing || !apiKey || !modelName}
          >
            {testing
              ? <><RefreshCw size={14} className="spin" /> Testing koneksi...</>
              : <><Wifi size={14} /> Jalankan Test</>}
          </button>
          {testResult && (
            <div className={`ai-test-result ${testResult.ok ? 'ok' : 'err'}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

