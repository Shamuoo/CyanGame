const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { nodeId } = req.query;
  let q = `SELECT c.*, n.name as node_name, n.ip as node_ip, n.status as node_status, COUNT(g.id) as game_count
    FROM consoles c JOIN nodes n ON n.id=c.node_id LEFT JOIN games g ON g.console_id=c.id`;
  if (nodeId) { q += ' WHERE c.node_id=?'; q += ' GROUP BY c.id ORDER BY c.name'; res.json(db.prepare(q).all(nodeId)); }
  else { q += ' GROUP BY c.id ORDER BY c.name'; res.json(db.prepare(q).all()); }
});

router.get('/types', (req, res) => {
  res.json({
    nes:'NES', snes:'Super Nintendo', n64:'Nintendo 64', gamecube:'GameCube',
    wii:'Wii', wiiu:'Wii U', switch:'Switch', genesis:'Sega Genesis',
    ps1:'PlayStation', ps2:'PlayStation 2', ps3:'PlayStation 3',
    ps4:'PlayStation 4', ps5:'PlayStation 5',
    xbox:'Xbox', xbox360:'Xbox 360', xbone:'Xbox One', xboxseries:'Xbox Series X|S',
    gba:'Game Boy Advance', nds:'Nintendo DS',
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT c.*, n.name as node_name, n.ip as node_ip FROM consoles c JOIN nodes n ON n.id=c.node_id WHERE c.id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const games = db.prepare('SELECT * FROM games WHERE console_id=? ORDER BY sort_title').all(req.params.id);
  res.json({ ...c, games });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { nodeId, name, type, captureDevice, resolution, usbIpPort, launchConfig } = req.body;
  if (!nodeId || !name || !type) return res.status(400).json({ error: 'nodeId, name, type required' });
  const id = uuid();
  db.prepare(`INSERT INTO consoles (id, node_id, name, type, capture_device, resolution, usb_ip_port, launch_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, nodeId, name, type, captureDevice||'video0', resolution||'1080p', usbIpPort||3240, JSON.stringify(launchConfig||{}));
  res.status(201).json(db.prepare('SELECT * FROM consoles WHERE id=?').get(id));
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, captureDevice, resolution, status, launchConfig } = req.body;
  db.prepare(`UPDATE consoles SET name=COALESCE(?,name), capture_device=COALESCE(?,capture_device),
    resolution=COALESCE(?,resolution), status=COALESCE(?,status),
    launch_config=COALESCE(?,launch_config) WHERE id=?`
  ).run(name, captureDevice, resolution, status, launchConfig ? JSON.stringify(launchConfig) : null, req.params.id);
  res.json(db.prepare('SELECT * FROM consoles WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM consoles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
