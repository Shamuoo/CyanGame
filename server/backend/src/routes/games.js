const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /games — all games, filter by consoleId or search
router.get('/', (req, res) => {
  const db = getDb();
  const { consoleId, search } = req.query;

  let query = `
    SELECT g.*, c.name as console_name, c.type as console_type,
      n.name as node_name
    FROM games g
    JOIN consoles c ON c.id = g.console_id
    JOIN nodes n ON n.id = c.node_id
    WHERE 1=1
  `;
  const params = [];

  if (consoleId) {
    query += ' AND g.console_id = ?';
    params.push(consoleId);
  }

  if (search) {
    query += ' AND g.title LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY g.sort_title';

  res.json(db.prepare(query).all(...params));
});

// GET /games/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

// POST /games — add a game to a console
router.post('/', (req, res) => {
  const db = getDb();
  const { consoleId, title, coverUrl, launchId } = req.body;

  if (!consoleId || !title) {
    return res.status(400).json({ error: 'consoleId, title required' });
  }

  const console_ = db.prepare('SELECT * FROM consoles WHERE id = ?').get(consoleId);
  if (!console_) return res.status(404).json({ error: 'Console not found' });

  const id = uuid();
  const sortTitle = title.replace(/^(The|A|An) /i, '').toLowerCase();

  db.prepare(`
    INSERT INTO games (id, console_id, title, cover_url, launch_id, sort_title)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, consoleId, title, coverUrl || null, launchId || null, sortTitle);

  res.status(201).json(db.prepare('SELECT * FROM games WHERE id = ?').get(id));
});

// POST /games/bulk — add many games at once
router.post('/bulk', (req, res) => {
  const db = getDb();
  const { consoleId, games } = req.body;

  if (!consoleId || !Array.isArray(games)) {
    return res.status(400).json({ error: 'consoleId and games[] required' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO games (id, console_id, title, cover_url, launch_id, sort_title)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const g of items) {
      const sortTitle = g.title.replace(/^(The|A|An) /i, '').toLowerCase();
      insert.run(uuid(), consoleId, g.title, g.coverUrl || null, g.launchId || null, sortTitle);
    }
  });

  insertMany(games);

  res.json({
    ok: true,
    added: games.length,
    total: db.prepare('SELECT COUNT(*) as c FROM games WHERE console_id = ?').get(consoleId).c
  });
});

// PATCH /games/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { title, coverUrl, launchId } = req.body;

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const sortTitle = title
    ? title.replace(/^(The|A|An) /i, '').toLowerCase()
    : null;

  db.prepare(`
    UPDATE games SET
      title = COALESCE(?, title),
      cover_url = COALESCE(?, cover_url),
      launch_id = COALESCE(?, launch_id),
      sort_title = COALESCE(?, sort_title)
    WHERE id = ?
  `).run(title, coverUrl, launchId, sortTitle, req.params.id);

  res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id));
});

// DELETE /games/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
