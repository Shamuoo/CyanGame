const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const router  = express.Router();

const ENV_PATH = process.env.ENV_FILE || '/data/.env';

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
  fs.writeFileSync(ENV_PATH, [
    '# CyanGame config — written by setup wizard',
    ...Object.entries(merged).map(([k, v]) => `${k}=${v}`),
  ].join('\n') + '\n');
}

router.get('/status', (req, res) => {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const romCount = db.prepare('SELECT COUNT(*) as c FROM roms').get().c;
    res.json({ ok: true, romCount, configured: fs.existsSync(ENV_PATH) });
  } catch { res.json({ ok: true, romCount: 0, configured: false }); }
});

router.get('/env', (req, res) => {
  const env = readEnv();
  res.json({ nasIp: env.NAS_IP || '', romPath: env.ROM_PATH || '/mnt/user/roms', hasSecrets: !!env.JWT_SECRET });
});

router.post('/configure', (req, res) => {
  const { nasIp, romPath } = req.body;
  if (!nasIp) return res.status(400).json({ error: 'nasIp required' });
  const updates = { NAS_IP: nasIp, ROM_PATH: romPath || '/mnt/user/roms' };
  const current = readEnv();
  if (!current.JWT_SECRET) updates.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  writeEnv(updates);
  res.json({ ok: true });
});

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
