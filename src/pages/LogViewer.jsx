import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, Download, X, AlertTriangle, Info,
  ChevronDown, Filter, Terminal, RefreshCw, Bug,
  FileText, Copy, Check, AlertCircle, Zap
} from 'lucide-react';
import { useLog } from '../hooks/useLogStore';
import './LogViewer.css';

const LEVEL_CONFIG = {
  debug: { label: 'DEBUG', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: Terminal },
  info:  { label: 'INFO',  color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   icon: Info },
  warn:  { label: 'WARN',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: AlertTriangle },
  error: { label: 'ERROR', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: AlertCircle },
  fatal: { label: 'FATAL', color: '#dc2626', bg: 'rgba(220,38,38,0.15)',  icon: Zap },
};

const CATEGORY_COLORS = {
  system:  '#8b5cf6',
  stream:  '#ef4444',
  ffmpeg:  '#f59e0b',
  media:   '#06b6d4',
  network: '#10b981',
  auth:    '#6366f1',
  ui:      '#ec4899',
};

export default function LogViewer() {
  const { logs, stats, clearLogs, exportText, exportJSON } = useLog();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef(null);

  // Filter logs
  const filtered = logs.filter(l => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.message.toLowerCase().includes(q) &&
          !(l.data && JSON.stringify(l.data).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filtered.length, autoScroll]);

  const handleExport = useCallback((format) => {
    const content = format === 'json' ? exportJSON() : exportText();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamtube-logs-${new Date().toISOString().slice(0,10)}.${format === 'json' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON, exportText]);

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(exportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportText]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  return (
    <div className="page">
      <h1 className="page-title"><Bug size={24} /> Application Logs</h1>
      <p className="page-subtitle">Monitor error, debug, dan event dari seluruh aplikasi</p>

      {/* Stats Bar */}
      <div className="log-stats-bar">
        <div className="log-stat total">
          <FileText size={14} />
          <span>{stats.total} Total</span>
        </div>
        {stats.error > 0 && (
          <div className="log-stat error">
            <AlertCircle size={14} />
            <span>{stats.error} Error{stats.error > 1 ? 's' : ''}</span>
          </div>
        )}
        {stats.warn > 0 && (
          <div className="log-stat warn">
            <AlertTriangle size={14} />
            <span>{stats.warn} Warning{stats.warn > 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="log-stat info">
          <Info size={14} />
          <span>{stats.info} Info</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="log-toolbar">
        <div className="log-search">
          <Search size={14} />
          <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="log-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>

        <div className="log-toolbar-actions">
          <button className={`log-btn filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(f => !f)}>
            <Filter size={13} /> Filters
          </button>
          <button className="log-btn" onClick={() => { if(window.logService?.refresh) window.logService.refresh(); }} title="Refresh logs from server">
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="log-btn" onClick={handleCopyAll} title="Copy all logs">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="log-btn" onClick={() => handleExport('txt')} title="Export as text">
            <Download size={13} /> .txt
          </button>
          <button className="log-btn" onClick={() => handleExport('json')} title="Export as JSON">
            <Download size={13} /> .json
          </button>
          <button className="log-btn danger" onClick={clearLogs} title="Clear all logs">
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="log-filters">
          <div className="log-filter-group">
            <label>Level:</label>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </select>
          </div>
          <div className="log-filter-group">
            <label>Category:</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="system">System</option>
              <option value="stream">Stream</option>
              <option value="ffmpeg">FFmpeg</option>
              <option value="media">Media</option>
              <option value="network">Network</option>
              <option value="auth">Auth</option>
              <option value="ui">UI</option>
            </select>
          </div>
          <div className="log-filter-group">
            <label className="log-auto-scroll-label">
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="log-container">
        {filtered.length === 0 ? (
          <div className="log-empty">
            <Terminal size={40} strokeWidth={1} />
            <h3>No Logs</h3>
            <p>{search || levelFilter !== 'all' || categoryFilter !== 'all' ? 'Tidak ada log yang sesuai filter' : 'Belum ada log tercatat'}</p>
          </div>
        ) : (
          <div className="log-list">
            {filtered.map(log => {
              const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
              const Icon = cfg.icon;
              const catColor = CATEGORY_COLORS[log.category] || '#6b7280';
              const isExpanded = expanded === log.id;

              return (
                <div
                  key={log.id}
                  className={`log-entry level-${log.level} ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  style={{ borderLeftColor: cfg.color }}
                >
                  <div className="log-entry-main">
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                    <span className="log-level-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      <Icon size={10} />
                      {cfg.label}
                    </span>
                    <span className="log-category-badge" style={{ color: catColor, borderColor: catColor }}>
                      {log.category}
                    </span>
                    <span className="log-category-badge" style={{ color: log.source === 'backend' ? '#8b5cf6' : '#ec4899', borderColor: log.source === 'backend' ? '#8b5cf6' : '#ec4899' }}>
                      {log.source === 'backend' ? 'BE' : 'FE'}
                    </span>
                    <span className="log-message">{log.message}</span>
                    {log.data && (
                      <ChevronDown size={12} className={`log-expand-icon ${isExpanded ? 'open' : ''}`} />
                    )}
                  </div>
                  {isExpanded && log.data && (
                    <div className="log-data">
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
