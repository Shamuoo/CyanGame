-- ConsoleHub Database Schema

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── Nodes (Wyse 3040s / N100 mini PCs) ──────────────────────────────
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,          -- e.g. "wyse-livingroom"
  name        TEXT NOT NULL,             -- display name
  ip          TEXT NOT NULL,             -- last known IP
  os          TEXT DEFAULT 'dietpi',     -- dietpi / casaos / ubuntu
  status      TEXT DEFAULT 'offline',    -- online / offline / error
  last_seen   INTEGER,                   -- unix timestamp
  created_at  INTEGER DEFAULT (unixepoch())
);

-- ── Consoles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consoles (
  id              TEXT PRIMARY KEY,
  node_id         TEXT NOT NULL REFERENCES nodes(id),
  name            TEXT NOT NULL,          -- "PS3 - Living Room"
  type            TEXT NOT NULL,          -- ps3 / xbox360 / switch / ps5 etc
  capture_device  TEXT DEFAULT 'usb0',    -- which capture card on the node
  usb_ip_port     INTEGER DEFAULT 3240,   -- controller passthrough port
  launch_method   TEXT DEFAULT 'manual',  -- webman / smartglass / usbip-nav / manual
  launch_config   TEXT DEFAULT '{}',      -- JSON: IP, credentials, etc
  status          TEXT DEFAULT 'idle',    -- idle / active / unavailable
  resolution      TEXT DEFAULT '1080p',   -- 720p / 1080p / 4k
  created_at      INTEGER DEFAULT (unixepoch())
);

-- ── Games ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  console_id    TEXT NOT NULL REFERENCES consoles(id),
  title         TEXT NOT NULL,
  cover_url     TEXT,
  launch_id     TEXT,                     -- title ID, ROM path, etc
  sort_title    TEXT,                     -- for alphabetical sorting
  created_at    INTEGER DEFAULT (unixepoch())
);

-- ── Active Sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  console_id    TEXT NOT NULL REFERENCES consoles(id),
  game_id       TEXT REFERENCES games(id),
  stream_path   TEXT NOT NULL,            -- mediamtx path e.g. console/wyse1/ps3
  started_at    INTEGER DEFAULT (unixepoch()),
  ended_at      INTEGER
);

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consoles_node   ON consoles(node_id);
CREATE INDEX IF NOT EXISTS idx_games_console   ON games(console_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(console_id) WHERE ended_at IS NULL;
