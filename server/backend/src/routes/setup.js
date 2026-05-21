const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const router = express.Router();

const ENV_PATH = process.env.ENV_FILE || path.join(__dirname, '../../../../../data/.env');

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function writeEnv(values) {
  const merged = { ...readEnv(), ...values };
  const dir = path.dirname(ENV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = [
    '# CyanGame Configuration',
    '# Written by setup wizard',
    '',
    ...Object.entries(merged).map(([k, v]) => `${k}=${v}`),
  ];
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

// GET /setup/status
router.get('/status', (req, res) => {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const nodeCount    = db.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
    const consoleCount = db.prepare('SELECT COUNT(*) as c FROM consoles').get().c;
    const env = readEnv();
    res.json({ firstRun: nodeCount === 0, configured: !!env.NAS_IP, nodeCount, consoleCount });
  } catch (e) {
    res.json({ firstRun: true, configured: false });
  }
});

// GET /setup/env — safe values only, never secrets
router.get('/env', (req, res) => {
  const env = readEnv();
  res.json({
    nasIp:      env.NAS_IP   || '',
    romPath:    env.ROM_PATH || '/mnt/user/roms',
    hasSecrets: !!(env.JWT_SECRET && env.JWT_SECRET.length > 20),
  });
});

// POST /setup/configure — write config, auto-gen secrets
router.post('/configure', (req, res) => {
  const { nasIp, romPath, regenerateSecrets } = req.body;
  if (!nasIp) return res.status(400).json({ error: 'nasIp required' });

  const updates = {};
  updates.NAS_IP   = nasIp;
  updates.ROM_PATH = romPath || '/mnt/user/roms';

  const current = readEnv();
  const needsSecrets = !current.JWT_SECRET || current.JWT_SECRET === 'changeme' || regenerateSecrets;
  if (needsSecrets) {
    updates.JWT_SECRET     = crypto.randomBytes(32).toString('hex');
    updates.TURN_PASSWORD  = crypto.randomBytes(16).toString('hex');
  }

  try {
    writeEnv(updates);
    console.log('[setup] Config saved:', Object.keys(updates).join(', '));
    res.json({ ok: true, written: Object.keys(updates), needsRestart: needsSecrets });
  } catch (e) {
    console.error('[setup] Write failed:', e.message);
    res.status(500).json({ error: 'Could not write config: ' + e.message });
  }
});

// GET /setup/detect-ip — server's own LAN IP
router.get('/detect-ip', (req, res) => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips  = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push({ iface: name, ip: net.address });
    }
  }
  res.json({ ips, primary: ips[0]?.ip || null });
});

module.exports = router;
