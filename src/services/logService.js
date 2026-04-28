// ═══════════════════════════════════════════
// Log Service — Synced with Server SQLite
// ═══════════════════════════════════════════

const MAX_LOGS = 1000;

export const LOG_LEVELS = {
  DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error', FATAL: 'fatal',
};

const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

export const LOG_CATEGORIES = {
  SYSTEM: 'system', STREAM: 'stream', FFMPEG: 'ffmpeg', MEDIA: 'media',
  NETWORK: 'network', AUTH: 'auth', UI: 'ui', YOUTUBE: 'youtube',
};

let logs = [];
let listeners = new Set();
let isInitialized = false;
let pendingSync = [];
let syncTimer = null;

function notifyListeners() {
  listeners.forEach(fn => fn([...logs]));
}

function createEntry(level, category, message, data = null) {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    level, category, message, data, source: 'frontend',
  };
}

// Batch sync to server every 2 seconds
function scheduleSyncToServer() {
  if (syncTimer) return;
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    if (pendingSync.length === 0) return;
    const batch = pendingSync.splice(0, pendingSync.length);
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    } catch { /* server offline, ignore */ }
  }, 2000);
}

export const logService = {
  async init() {
    if (isInitialized) return;
    isInitialized = true;

    // Load from server
    try {
      const res = await fetch('/api/logs?limit=500');
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        logs = data.logs.map(l => ({
          id: `db_${l.id}`,
          timestamp: l.timestamp,
          level: l.level,
          category: l.category,
          message: l.message,
          data: l.data_json ? JSON.parse(l.data_json) : null,
          source: l.source || 'backend',
        }));
        notifyListeners();
      }
    } catch { /* server not ready yet */ }

    // Capture global errors
    window.addEventListener('error', (event) => {
      logService.error(LOG_CATEGORIES.SYSTEM, `Uncaught Error: ${event.message}`, {
        filename: event.filename, lineno: event.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logService.error(LOG_CATEGORIES.SYSTEM, `Unhandled Promise: ${event.reason}`);
    });

    logService.info(LOG_CATEGORIES.SYSTEM, 'Log service initialized');
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getLogs() { return [...logs]; },

  getFiltered({ level, category, search, limit } = {}) {
    let result = [...logs];
    if (level && level !== 'all') {
      const minP = LEVEL_PRIORITY[level] || 0;
      result = result.filter(l => (LEVEL_PRIORITY[l.level] || 0) >= minP);
    }
    if (category && category !== 'all') result = result.filter(l => l.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => l.message.toLowerCase().includes(q) || (l.data && JSON.stringify(l.data).toLowerCase().includes(q)));
    }
    if (limit) result = result.slice(-limit);
    return result;
  },

  _add(level, category, message, data) {
    const entry = createEntry(level, category, message, data);
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
    notifyListeners();

    // Queue for server sync
    pendingSync.push({ timestamp: entry.timestamp, level, category, message, data });
    scheduleSyncToServer();

    return entry;
  },

  debug(category, message, data) { return this._add(LOG_LEVELS.DEBUG, category, message, data); },
  info(category, message, data) { return this._add(LOG_LEVELS.INFO, category, message, data); },
  warn(category, message, data) { return this._add(LOG_LEVELS.WARN, category, message, data); },
  error(category, message, data) { return this._add(LOG_LEVELS.ERROR, category, message, data); },
  fatal(category, message, data) { return this._add(LOG_LEVELS.FATAL, category, message, data); },

  async clear() {
    logs = [];
    notifyListeners();
    try { await fetch('/api/logs', { method: 'DELETE' }); } catch {}
  },

  // Refresh from server
  async refresh() {
    try {
      const res = await fetch('/api/logs?limit=500');
      const data = await res.json();
      if (data.logs) {
        logs = data.logs.map(l => ({
          id: `db_${l.id}`,
          timestamp: l.timestamp,
          level: l.level,
          category: l.category,
          message: l.message,
          data: l.data_json ? JSON.parse(l.data_json) : null,
          source: l.source || 'backend',
        }));
        notifyListeners();
      }
    } catch {}
  },

  exportAsText() {
    return logs.map(l => {
      const time = new Date(l.timestamp).toLocaleString();
      const src = l.source === 'backend' ? '[BE]' : '[FE]';
      const dataStr = l.data ? ` | ${JSON.stringify(l.data)}` : '';
      return `[${time}] ${src} [${l.level.toUpperCase()}] [${l.category}] ${l.message}${dataStr}`;
    }).join('\n');
  },

  exportAsJSON() { return JSON.stringify(logs, null, 2); },

  getStats() {
    const stats = { total: logs.length, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
    logs.forEach(l => { if (stats[l.level] !== undefined) stats[l.level]++; });
    return stats;
  },
};
