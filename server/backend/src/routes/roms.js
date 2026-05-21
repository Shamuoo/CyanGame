const express = require('express');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');

const router = express.Router();

// ROM root on NAS — mounted into docker container
const ROM_ROOT = process.env.ROM_ROOT || '/roms';

// Supported file extensions per system
const SYSTEM_EXTENSIONS = {
  nes:      ['.nes', '.nez'],
  snes:     ['.sfc', '.smc'],
  gb:       ['.gb'],
  gbc:      ['.gbc'],
  gba:      ['.gba'],
  n64:      ['.n64', '.z64', '.v64'],
  genesis:  ['.md', '.bin', '.gen'],
  ps1:      ['.bin', '.cue', '.iso', '.img'],
  ps2:      ['.iso', '.bin'],
  gamecube: ['.iso', '.gcm', '.rvz'],
  wii:      ['.iso', '.wbfs', '.rvz'],
  switch:   ['.nsp', '.xci'],
  ps3:      ['.pkg', '.iso'],
  nds:      ['.nds'],
};

// GET /roms — list all roms, optionally filter by system
router.get('/', (req, res) => {
  const db = getDb();
  const { system, search } = req.query;

  let query = 'SELECT r.*, g.id as game_id, g.title as game_title FROM roms r LEFT JOIN games g ON g.rom_id = r.id WHERE 1=1';
  const params = [];

  if (system) { query += ' AND r.system = ?'; params.push(system); }
  if (search)  { query += ' AND r.title LIKE ?'; params.push(`%${search}%`); }

  query += ' ORDER BY r.system, r.title';
  res.json(db.prepare(query).all(...params));
});

// GET /roms/systems — list all systems that have ROMs
router.get('/systems', (req, res) => {
  const db = getDb();
  const systems = db.prepare(`
    SELECT system, COUNT(*) as count FROM roms GROUP BY system ORDER BY system
  `).all();
  res.json(systems);
});

// GET /roms/scan — scan NAS ROM_ROOT and auto-add new ROMs to DB
router.post('/scan', (req, res) => {
  const db = getDb();
  const added = [];
  const skipped = [];

  if (!fs.existsSync(ROM_ROOT)) {
    return res.status(500).json({ error: `ROM root not found: ${ROM_ROOT}. Mount your NAS share.` });
  }

  // Walk ROM_ROOT/{system}/ directories
  const systemDirs = fs.readdirSync(ROM_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO roms (id, system, title, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const system of systemDirs) {
      const exts = SYSTEM_EXTENSIONS[system];
      if (!exts) { skipped.push(`unknown system: ${system}`); continue; }

      const sysDir = path.join(ROM_ROOT, system);
      let files;
      try { files = fs.readdirSync(sysDir); } catch { continue; }

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!exts.includes(ext)) continue;

        const filePath = path.join(sysDir, file);
        const existing = db.prepare('SELECT id FROM roms WHERE file_path = ?').get(filePath);
        if (existing) { skipped.push(file); continue; }

        let size = 0;
        try { size = fs.statSync(filePath).size; } catch {}

        const title = path.basename(file, ext)
          .replace(/[\[\(].*?[\]\)]/g, '')  // strip region tags like [USA] (Rev 1)
          .replace(/_/g, ' ')
          .trim();

        insert.run(uuid(), system, title, filePath, size);
        added.push({ system, title, file });
      }
    }
  });

  insertMany();
  res.json({ ok: true, added: added.length, skipped: skipped.length, addedList: added });
});

// GET /roms/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const rom = db.prepare('SELECT * FROM roms WHERE id = ?').get(req.params.id);
  if (!rom) return res.status(404).json({ error: 'ROM not found' });
  res.json(rom);
});

// POST /roms — manually add a ROM
router.post('/', (req, res) => {
  const db = getDb();
  const { system, title, filePath, coverUrl, igdbId } = req.body;

  if (!system || !title || !filePath) {
    return res.status(400).json({ error: 'system, title, filePath required' });
  }

  if (!SYSTEM_EXTENSIONS[system]) {
    return res.status(400).json({ error: `Unknown system: ${system}` });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: `File not found: ${filePath}` });
  }

  let size = 0;
  try { size = fs.statSync(filePath).size; } catch {}

  const id = uuid();
  db.prepare(`
    INSERT INTO roms (id, system, title, file_path, file_size, cover_url, igdb_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, system, title, filePath, size, coverUrl || null, igdbId || null);

  res.status(201).json(db.prepare('SELECT * FROM roms WHERE id = ?').get(id));
});

// PATCH /roms/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { title, coverUrl, igdbId } = req.body;
  db.prepare(`
    UPDATE roms SET
      title = COALESCE(?, title),
      cover_url = COALESCE(?, cover_url),
      igdb_id = COALESCE(?, igdb_id)
    WHERE id = ?
  `).run(title, coverUrl, igdbId, req.params.id);
  res.json(db.prepare('SELECT * FROM roms WHERE id = ?').get(req.params.id));
});

// DELETE /roms/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  // Unlink from any games first
  db.prepare('UPDATE games SET rom_id = NULL WHERE rom_id = ?').run(req.params.id);
  db.prepare('DELETE FROM roms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /roms/:id/link — link a ROM to an existing game entry
router.post('/:id/link', (req, res) => {
  const db = getDb();
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  const rom = db.prepare('SELECT * FROM roms WHERE id = ?').get(req.params.id);
  if (!rom) return res.status(404).json({ error: 'ROM not found' });

  db.prepare('UPDATE games SET rom_id = ? WHERE id = ?').run(req.params.id, gameId);
  res.json({ ok: true });
});

// GET /roms/systems/list — just the list of supported systems
router.get('/systems/supported', (req, res) => {
  res.json(Object.keys(SYSTEM_EXTENSIONS));
});

module.exports = router;
module.exports.ROM_ROOT = ROM_ROOT;
