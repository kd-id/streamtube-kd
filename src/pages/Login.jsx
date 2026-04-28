import { useState } from 'react';
import { Radio, Lock, Mail, User, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const { login, register, isAuthenticated } = useAuth();
  const [mode, setMode] = useState('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email dan password wajib diisi');
      return;
    }

    if (mode === 'register' && !nickname.trim()) {
      setError('Nickname wajib diisi');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await register(nickname.trim(), email.trim(), password);
      } else {
        result = await login(email.trim(), password);
      }

      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan');
    }
    setLoading(false);
  };



  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-container">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <Radio size={24} />
            </div>
            <span className="login-logo-text">
              StreamTube <span className="login-logo-accent">Pro</span>
            </span>
          </div>

          {/* Heading */}
          <div className="login-heading">
            <h1>{mode === 'login' ? 'Selamat Datang' : 'Buat Akun Baru'}</h1>
            <p>{mode === 'login' ? 'Masuk ke dashboard streaming kamu' : 'Daftar untuk mulai streaming'}</p>
          </div>

          {/* Tab Switcher */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Masuk
            </button>
            <button
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Daftar
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'register' && (
              <div className="login-field">
                <label className="login-label">
                  <User size={14} />
                  Nickname
                </label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Nama tampilan kamu"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="login-field">
              <label className="login-label">
                <Mail size={14} />
                Email
              </label>
              <input
                type="email"
                className="login-input"
                placeholder="nama@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label className="login-label">
                <Lock size={14} />
                Password
              </label>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner" />
              ) : (
                mode === 'login' ? 'Masuk' : 'Daftar'
              )}
            </button>
          </form>



          {/* Switch mode */}
          <div className="login-switch">
            <span>
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
            </span>
            <button type="button" className="login-switch-btn" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
