const express = require('express');
const { v4: uuid } = require('uuid');
const fs   = require('fs');
const path = require('path');
const { getDb } = require('../db/database');
const router = express.Router();

const ROM_ROOT = process.env.ROM_ROOT || '/roms';

const SYSTEMS = {
  nes:      ['.nes'],
  snes:     ['.sfc', '.smc'],
  gb:       ['.gb'],
  gbc:      ['.gbc'],
  gba:      ['.gba'],
  n64:      ['.n64', '.z64', '.v64'],
  genesis:  ['.md', '.bin', '.gen'],
  ps1:      ['.bin', '.cue', '.iso', '.img'],
  ps2:      ['.iso'],
  gamecube: ['.iso', '.gcm', '.rvz'],
  wii:      ['.iso', '.wbfs', '.rvz'],
  nds:      ['.nds'],
  switch:   ['.nsp', '.xci'],
  ps3:      ['.iso'],
};

router.get('/', (req, res) => {
  const db = getDb();
  const { system, search } = req.query;
  let q = 'SELECT * FROM roms WHERE 1=1';
  const p = [];
  if (system) { q += ' AND system=?'; p.push(system); }
  if (search)  { q += ' AND title LIKE ?'; p.push(`%${search}%`); }
  q += ' ORDER BY system, title';
  res.json(db.prepare(q).all(...p));
});

router.get('/systems', (req, res) => {
  res.json(getDb().prepare('SELECT system, COUNT(*) as count FROM roms GROUP BY system ORDER BY system').all());
});

router.post('/scan', (req, res) => {
  const db = getDb();
  const added = [];

  if (!fs.existsSync(ROM_ROOT)) {
    return res.status(500).json({ error: `ROM folder not found: ${ROM_ROOT}` });
  }

  const insert = db.prepare(`INSERT OR IGNORE INTO roms (id, system, title, file_path, file_size) VALUES (?,?,?,?,?)`);

  db.transaction(() => {
    for (const system of Object.keys(SYSTEMS)) {
      const dir = path.join(ROM_ROOT, system);
      if (!fs.existsSync(dir)) continue;
      const exts = SYSTEMS[system];
      for (const file of fs.readdirSync(dir)) {
        const ext = path.extname(file).toLowerCase();
        if (!exts.includes(ext)) continue;
        const filePath = path.join(dir, file);
        const title = path.basename(file, ext).replace(/[\[\(].*?[\]\)]/g, '').replace(/_/g, ' ').trim();
        let size = 0;
        try { size = fs.statSync(filePath).size; } catch {}
        const result = insert.run(uuid(), system, title, filePath, size);
        if (result.changes > 0) added.push({ system, title, file });
      }
    }
  })();

  res.json({ ok: true, added: added.length, addedList: added });
});

router.get('/:id', (req, res) => {
  const r = getDb().prepare('SELECT * FROM roms WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { system, title, filePath, coverUrl } = req.body;
  if (!system || !title || !filePath) return res.status(400).json({ error: 'system, title, filePath required' });
  const id = uuid();
  db.prepare(`INSERT INTO roms (id, system, title, file_path, cover_url) VALUES (?,?,?,?,?)`
  ).run(id, system, title, filePath, coverUrl||null);
  res.status(201).json(db.prepare('SELECT * FROM roms WHERE id=?').get(id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM roms WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
