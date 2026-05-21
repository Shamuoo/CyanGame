const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /nodes — list all nodes with status
router.get('/', (req, res) => {
  const db = getDb();
  const nodes = db.prepare(`
    SELECT n.*,
      COUNT(c.id) as console_count
    FROM nodes n
    LEFT JOIN consoles c ON c.node_id = n.id
    GROUP BY n.id
    ORDER BY n.name
  `).all();
  res.json(nodes);
});

// GET /nodes/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const consoles = db.prepare('SELECT * FROM consoles WHERE node_id = ?').all(node.id);
  res.json({ ...node, consoles });
});

// POST /nodes — register a new node (called by node-agent on boot)
router.post('/', (req, res) => {
  const db = getDb();
  const { id, name, ip, os } = req.body;

  if (!id || !name || !ip) {
    return res.status(400).json({ error: 'id, name, ip required' });
  }

  // Upsert — node re-registers on reboot with same ID
  db.prepare(`
    INSERT INTO nodes (id, name, ip, os, status, last_seen)
    VALUES (?, ?, ?, ?, 'online', unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      ip = excluded.ip,
      status = 'online',
      last_seen = unixepoch()
  `).run(id, name, ip, os || 'dietpi');

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  console.log(`[nodes] Registered: ${name} (${ip})`);
  res.json(node);
});

// PATCH /nodes/:id — update node details
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, ip, status } = req.body;
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  db.prepare(`
    UPDATE nodes SET
      name = COALESCE(?, name),
      ip = COALESCE(?, ip),
      status = COALESCE(?, status),
      last_seen = unixepoch()
    WHERE id = ?
  `).run(name, ip, status, req.params.id);

  res.json(db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id));
});

// DELETE /nodes/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /nodes/:id/ping — heartbeat from node agent
router.post('/:id/ping', (req, res) => {
  const db = getDb();
  const { cpu, ram, streams } = req.body;

  db.prepare(`
    UPDATE nodes SET status = 'online', last_seen = unixepoch() WHERE id = ?
  `).run(req.params.id);

  res.json({ ok: true });
});

module.exports = router;
