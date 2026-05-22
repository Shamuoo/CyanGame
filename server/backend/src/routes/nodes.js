const express = require('express');
const { getDb } = require('../db/database');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT n.*, COUNT(c.id) as console_count
    FROM nodes n LEFT JOIN consoles c ON c.node_id = n.id
    GROUP BY n.id ORDER BY n.name
  `).all());
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Not found' });
  const consoles = db.prepare('SELECT * FROM consoles WHERE node_id = ?').all(node.id);
  res.json({ ...node, consoles });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { id, name, ip, os } = req.body;
  if (!id || !name || !ip) return res.status(400).json({ error: 'id, name, ip required' });
  db.prepare(`
    INSERT INTO nodes (id, name, ip, os, status, last_seen) VALUES (?, ?, ?, ?, 'online', unixepoch())
    ON CONFLICT(id) DO UPDATE SET ip=excluded.ip, status='online', last_seen=unixepoch()
  `).run(id, name, ip, os || 'linux');
  res.json(db.prepare('SELECT * FROM nodes WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, ip, status } = req.body;
  db.prepare(`UPDATE nodes SET name=COALESCE(?,name), ip=COALESCE(?,ip), status=COALESCE(?,status), last_seen=unixepoch() WHERE id=?`
  ).run(name, ip, status, req.params.id);
  res.json(db.prepare('SELECT * FROM nodes WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM nodes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/ping', (req, res) => {
  getDb().prepare(`UPDATE nodes SET status='online', last_seen=unixepoch() WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Health checker — mark stale nodes offline every 30s
setInterval(() => {
  try {
    const threshold = Math.floor((Date.now() - 30000) / 1000);
    getDb().prepare(`UPDATE nodes SET status='offline' WHERE status='online' AND last_seen < ?`).run(threshold);
  } catch {}
}, 15000);

module.exports = router;
