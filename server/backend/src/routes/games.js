const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');
const router = express.Router();

const sortTitle = t => t.replace(/^(The|A|An) /i,'').toLowerCase();

router.get('/', (req, res) => {
  const db = getDb();
  const { consoleId, search } = req.query;
  let q = `SELECT g.*, c.name as console_name, c.type as console_type, n.name as node_name, n.status as node_status
    FROM games g JOIN consoles c ON c.id=g.console_id JOIN nodes n ON n.id=c.node_id WHERE 1=1`;
  const params = [];
  if (consoleId) { q += ' AND g.console_id=?'; params.push(consoleId); }
  if (search)    { q += ' AND g.title LIKE ?';  params.push(`%${search}%`); }
  q += ' ORDER BY g.sort_title';
  res.json(db.prepare(q).all(...params));
});

router.get('/:id', (req, res) => {
  const g = getDb().prepare('SELECT * FROM games WHERE id=?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  res.json(g);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { consoleId, title, coverUrl, launchId, romId } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = uuid();
  db.prepare(`INSERT INTO games (id, console_id, title, cover_url, launch_id, rom_id, sort_title) VALUES (?,?,?,?,?,?,?)`
  ).run(id, consoleId||null, title, coverUrl||null, launchId||null, romId||null, sortTitle(title));
  res.status(201).json(db.prepare('SELECT * FROM games WHERE id=?').get(id));
});

router.post('/bulk', (req, res) => {
  const db = getDb();
  const { consoleId, games } = req.body;
  if (!Array.isArray(games)) return res.status(400).json({ error: 'games[] required' });
  const insert = db.prepare(`INSERT OR IGNORE INTO games (id, console_id, title, sort_title) VALUES (?,?,?,?)`);
  db.transaction(() => { for (const g of games) insert.run(uuid(), consoleId||null, g.title, sortTitle(g.title)); })();
  res.json({ ok: true, added: games.length });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { title, coverUrl, launchId, romId } = req.body;
  db.prepare(`UPDATE games SET title=COALESCE(?,title), cover_url=COALESCE(?,cover_url),
    launch_id=COALESCE(?,launch_id), rom_id=COALESCE(?,rom_id),
    sort_title=COALESCE(?,sort_title) WHERE id=?`
  ).run(title, coverUrl, launchId, romId, title ? sortTitle(title) : null, req.params.id);
  res.json(db.prepare('SELECT * FROM games WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM games WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
