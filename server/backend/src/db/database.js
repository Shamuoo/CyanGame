const Database = require('better-sqlite3');
const fs   = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/cyangame.db';
let db;

function getDb() {
  if (!db) throw new Error('DB not ready');
  return db;
}

async function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, ip TEXT NOT NULL,
      os TEXT DEFAULT 'linux', status TEXT DEFAULT 'offline',
      last_seen INTEGER, created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS consoles (
      id TEXT PRIMARY KEY, node_id TEXT REFERENCES nodes(id),
      name TEXT NOT NULL, type TEXT NOT NULL,
      capture_device TEXT DEFAULT 'video0', resolution TEXT DEFAULT '1080p',
      usb_ip_port INTEGER DEFAULT 3240, launch_method TEXT DEFAULT 'manual',
      launch_config TEXT DEFAULT '{}', status TEXT DEFAULT 'idle',
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY, console_id TEXT REFERENCES consoles(id),
      title TEXT NOT NULL, cover_url TEXT, launch_id TEXT,
      rom_id TEXT, sort_title TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS roms (
      id TEXT PRIMARY KEY, system TEXT NOT NULL, title TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE, file_size INTEGER,
      cover_url TEXT, created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, console_id TEXT, game_id TEXT, rom_id TEXT,
      stream_path TEXT NOT NULL, mode TEXT DEFAULT 'physical',
      emulator_id TEXT, started_at INTEGER DEFAULT (unixepoch()), ended_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_roms_system ON roms(system);
    CREATE INDEX IF NOT EXISTS idx_games_console ON games(console_id);
  `);

  console.log(`[db] Ready: ${DB_PATH}`);
  return db;
}

module.exports = { getDb, initDb };
