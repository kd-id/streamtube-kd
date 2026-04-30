// ═══════════════════════════════════════════════
// SQLite Database — Server-side via better-sqlite3
// ═══════════════════════════════════════════════
// Data stored at ./data/streamtube.db — persistent across all browsers/devices.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'streamtube.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db = null;

export function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Create tables ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      avatar_color TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stream_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      stream_id TEXT NOT NULL,
      platform TEXT DEFAULT 'youtube',
      rtmp_url TEXT DEFAULT '',
      title TEXT DEFAULT '',
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT DEFAULT 'started',
      peak_fps REAL DEFAULT 0,
      avg_bitrate TEXT DEFAULT '',
      total_frames INTEGER DEFAULT 0,
      error_msg TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      level TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL DEFAULT 'system',
      message TEXT NOT NULL,
      data_json TEXT,
      source TEXT DEFAULT 'backend'
    );

    CREATE TABLE IF NOT EXISTS streams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS overlays (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS youtube_channels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Auto-migration for schema changes
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasAvatarUrl = tableInfo.some(col => col.name === 'avatar_url');
    if (!hasAvatarUrl) {
      db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''").run();
      console.log('[DB] Migrated: Added avatar_url to users table.');
    }

    const hasRole = tableInfo.some(col => col.name === 'role');
    if (!hasRole) {
      db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'public'").run();
      console.log('[DB] Migrated: Added role to users table.');
      
      // Check if there are any users. If yes, make the oldest user superadmin.
      const firstUser = db.prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").get();
      if (firstUser) {
        db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(firstUser.id);
        console.log('[DB] Migrated: Set first user as superadmin.');
      } else {
        // If no users, create default admin
        const id = 'user_admin_001';
        const nickname = 'Super Admin';
        const email = 'admin@streamtube.local';
        const password = 'admin123';
        
        import('crypto').then(crypto => {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = crypto.scryptSync(password, salt, 64).toString('hex');
          const avatarColor = 'linear-gradient(135deg, #ff3b5c, #ffc144)';
          
          db.prepare('INSERT INTO users (id, nickname, email, password_hash, salt, avatar_color, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, nickname, email, hash, salt, avatarColor, 'superadmin');
          console.log('[DB] Migrated: Created default Super Admin (admin@streamtube.local)');
        });
      }
    }
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
  }

  console.log(`[DB] SQLite initialized: ${DB_PATH}`);
  return db;
}

// ── Helper shortcuts ──
export function runQuery(sql, params = []) {
  return getDb().prepare(sql).run(...(Array.isArray(params) ? params : [params]));
}

export function getOne(sql, params = []) {
  return getDb().prepare(sql).get(...(Array.isArray(params) ? params : [params]));
}

export function getAll(sql, params = []) {
  return getDb().prepare(sql).all(...(Array.isArray(params) ? params : [params]));
}

// ── Log helper for backend use ──
export function dbLog(level, category, message, data = null) {
  try {
    getDb().prepare(
      'INSERT INTO app_logs (level, category, message, data_json, source) VALUES (?, ?, ?, ?, ?)'
    ).run(level, category, message, data ? JSON.stringify(data) : null, 'backend');
  } catch { /* ignore log errors */ }
}
