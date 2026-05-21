const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

// Supported console types and their launch methods
const CONSOLE_TYPES = {
  nes:       { name: 'NES',             launch: 'manual' },
  snes:      { name: 'Super Nintendo',  launch: 'manual' },
  n64:       { name: 'Nintendo 64',     launch: 'manual' },
  gamecube:  { name: 'GameCube',        launch: 'manual' },
  wii:       { name: 'Wii',             launch: 'manual' },
  wiiu:      { name: 'Wii U',           launch: 'manual' },
  switch:    { name: 'Nintendo Switch', launch: 'usbip-nav' },
  genesis:   { name: 'Sega Genesis',    launch: 'manual' },
  ps1:       { name: 'PlayStation',     launch: 'manual' },
  ps2:       { name: 'PlayStation 2',   launch: 'opl' },
  ps3:       { name: 'PlayStation 3',   launch: 'webman' },
  ps4:       { name: 'PlayStation 4',   launch: 'ps-remote' },
  ps5:       { name: 'PlayStation 5',   launch: 'ps-remote' },
  xbox:      { name: 'Xbox',            launch: 'manual' },
  xbox360:   { name: 'Xbox 360',        launch: 'manual' },
  xbone:     { name: 'Xbox One',        launch: 'smartglass' },
  xboxseries:{ name: 'Xbox Series X|S', launch: 'smartglass' },
  gba:       { name: 'Game Boy Advance',launch: 'manual' },
  nds:       { name: 'Nintendo DS',     launch: 'manual' },
};

// GET /consoles — all consoles, optionally filter by node
router.get('/', (req, res) => {
  const db = getDb();
  const { nodeId } = req.query;

  let query = `
    SELECT c.*, n.name as node_name, n.ip as node_ip, n.status as node_status,
      COUNT(g.id) as game_count
    FROM consoles c
    JOIN nodes n ON n.id = c.node_id
    LEFT JOIN games g ON g.console_id = c.id
  `;
  const params = [];

  if (nodeId) {
    query += ' WHERE c.node_id = ?';
    params.push(nodeId);
  }

  query += ' GROUP BY c.id ORDER BY c.name';

  res.json(db.prepare(query).all(...params));
});

// GET /consoles/types — list supported console types
router.get('/types', (req, res) => {
  res.json(CONSOLE_TYPES);
});

// GET /consoles/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const console_ = db.prepare(`
    SELECT c.*, n.name as node_name, n.ip as node_ip
    FROM consoles c JOIN nodes n ON n.id = c.node_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!console_) return res.status(404).json({ error: 'Console not found' });

  const games = db.prepare(
    'SELECT * FROM games WHERE console_id = ? ORDER BY sort_title'
  ).all(req.params.id);

  res.json({ ...console_, games });
});

// POST /consoles — add a console to a node
router.post('/', (req, res) => {
  const db = getDb();
  const { nodeId, name, type, captureDevice, usbIpPort, resolution, launchConfig } = req.body;

  if (!nodeId || !name || !type) {
    return res.status(400).json({ error: 'nodeId, name, type required' });
  }

  if (!CONSOLE_TYPES[type]) {
    return res.status(400).json({ error: `Unknown console type: ${type}` });
  }

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const id = uuid();
  const launchMethod = CONSOLE_TYPES[type].launch;

  db.prepare(`
    INSERT INTO consoles
      (id, node_id, name, type, capture_device, usb_ip_port, launch_method, launch_config, resolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, nodeId, name, type,
    captureDevice || 'usb0',
    usbIpPort || 3240,
    launchMethod,
    JSON.stringify(launchConfig || {}),
    resolution || '1080p'
  );

  res.status(201).json(db.prepare('SELECT * FROM consoles WHERE id = ?').get(id));
});

// PATCH /consoles/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, captureDevice, usbIpPort, resolution, launchConfig, status } = req.body;

  const console_ = db.prepare('SELECT * FROM consoles WHERE id = ?').get(req.params.id);
  if (!console_) return res.status(404).json({ error: 'Console not found' });

  db.prepare(`
    UPDATE consoles SET
      name = COALESCE(?, name),
      capture_device = COALESCE(?, capture_device),
      usb_ip_port = COALESCE(?, usb_ip_port),
      resolution = COALESCE(?, resolution),
      launch_config = COALESCE(?, launch_config),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    name, captureDevice, usbIpPort, resolution,
    launchConfig ? JSON.stringify(launchConfig) : null,
    status,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM consoles WHERE id = ?').get(req.params.id));
});

// DELETE /consoles/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM consoles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
