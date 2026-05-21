-- ConsoleHub v0.2 Schema Additions
-- Run this as a migration on top of v0.1 schema

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── Emulator Profiles ────────────────────────────────────────────────
-- One row per emulator binary/config on each target (server or node)
CREATE TABLE IF NOT EXISTS emulators (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,              -- "RetroArch SNES", "DuckStation", "PCSX2"
  system      TEXT NOT NULL,              -- nes / snes / ps1 / ps2 / gamecube etc
  binary      TEXT NOT NULL,              -- retroarch / duckstation-nogui / pcsx2
  core        TEXT,                       -- RetroArch core path (null for standalone)
  target      TEXT DEFAULT 'server',      -- server / node / both
  extra_args  TEXT DEFAULT '',            -- additional CLI args
  created_at  INTEGER DEFAULT (unixepoch())
);

-- ── ROMs / ISOs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roms (
  id          TEXT PRIMARY KEY,
  system      TEXT NOT NULL,              -- nes / snes / ps1 / ps2 / n64 etc
  title       TEXT NOT NULL,             -- display name
  file_path   TEXT NOT NULL,             -- /roms/snes/SuperMarioWorld.sfc
  file_size   INTEGER,                   -- bytes
  hash_md5    TEXT,                       -- for dedup / verification
  cover_url   TEXT,
  igdb_id     TEXT,                       -- for metadata
  created_at  INTEGER DEFAULT (unixepoch())
);

-- ── Update games table to support ROM linking ─────────────────────────
-- A game can have a physical console, a ROM, or both
ALTER TABLE games ADD COLUMN rom_id TEXT REFERENCES roms(id);

-- ── Update sessions to track emulation mode ──────────────────────────
ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'physical';
  -- physical / emulation_server / emulation_node
ALTER TABLE sessions ADD COLUMN emulator_id TEXT REFERENCES emulators(id);
ALTER TABLE sessions ADD COLUMN emulation_target TEXT;
  -- for emulation_node: the node_id running the emulator

-- ── Default emulator profiles (seeded on install) ────────────────────
INSERT OR IGNORE INTO emulators (id, name, system, binary, core, target, extra_args) VALUES
  ('emu-ra-nes',    'RetroArch NES',          'nes',      'retroarch', '/cores/fceumm_libretro.so',          'both',   ''),
  ('emu-ra-snes',   'RetroArch SNES',         'snes',     'retroarch', '/cores/snes9x_libretro.so',          'both',   ''),
  ('emu-ra-gb',     'RetroArch Game Boy',     'gb',       'retroarch', '/cores/gambatte_libretro.so',        'both',   ''),
  ('emu-ra-gba',    'RetroArch GBA',          'gba',      'retroarch', '/cores/mgba_libretro.so',            'both',   ''),
  ('emu-ra-gbc',    'RetroArch GBC',          'gbc',      'retroarch', '/cores/gambatte_libretro.so',        'both',   ''),
  ('emu-ra-gen',    'RetroArch Genesis',      'genesis',  'retroarch', '/cores/genesis_plus_gx_libretro.so','both',   ''),
  ('emu-ra-n64',    'RetroArch N64',          'n64',      'retroarch', '/cores/mupen64plus_next_libretro.so','both',   ''),
  ('emu-ra-ps1',    'RetroArch PS1',          'ps1',      'retroarch', '/cores/mednafen_psx_libretro.so',    'both',   ''),
  ('emu-ds',        'DuckStation',            'ps1',      'duckstation-nogui', NULL,                         'server', '--fullscreen'),
  ('emu-pcsx2',     'PCSX2',                  'ps2',      'pcsx2',     NULL,                                 'server', '--fullscreen --nogui'),
  ('emu-dolphin',   'Dolphin',                'gamecube', 'dolphin-emu-nogui', NULL,                         'server', ''),
  ('emu-dolphin-w', 'Dolphin',                'wii',      'dolphin-emu-nogui', NULL,                         'server', ''),
  ('emu-ryujinx',   'Ryujinx',                'switch',   'Ryujinx',   NULL,                                 'server', ''),
  ('emu-rpcs3',     'RPCS3',                  'ps3',      'rpcs3',     NULL,                                 'server', '--no-gui');

-- ── Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roms_system  ON roms(system);
CREATE INDEX IF NOT EXISTS idx_games_rom    ON games(rom_id);
CREATE INDEX IF NOT EXISTS idx_emu_system   ON emulators(system);
