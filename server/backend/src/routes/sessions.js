const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');
const router = express.Router();

const EMU_API = process.env.EMULATION_API || 'http://cyangame-emulation:7002';

async function emuRequest(path, body) {
  const fetch = (...a) => import('node-fetch').then(({default: f}) => f(...a));
  const r = await fetch(`${EMU_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return r.json();
}

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT s.*, g.title as game_title, g.cover_url,
      r.title as rom_title, r.system as rom_system
    FROM sessions s
    LEFT JOIN games g ON g.id=s.game_id
    LEFT JOIN roms r ON r.id=s.rom_id
    WHERE s.ended_at IS NULL ORDER BY s.started_at DESC
  `).all());
});

router.post('/', async (req, res) => {
  const db = getDb();
  const { romId, gameId, mode = 'emulation_server' } = req.body;

  if (!romId && !gameId) return res.status(400).json({ error: 'romId or gameId required' });

  const rom = romId
    ? db.prepare('SELECT * FROM roms WHERE id=?').get(romId)
    : db.prepare('SELECT * FROM roms WHERE id=(SELECT rom_id FROM games WHERE id=?)').get(gameId);

  if (!rom) return res.status(404).json({ error: 'ROM not found. Link a ROM to this game first.' });

  const sessionId  = uuid();
  const streamPath = `emu/server/${sessionId}`;

  try {
    const result = await emuRequest('/emulate/start', {
      romPath:    rom.file_path,
      system:     rom.system,
      streamPath,
    });

    if (result.error) throw new Error(result.error);

    db.prepare(`INSERT INTO sessions (id, game_id, rom_id, stream_path, mode) VALUES (?,?,?,?,?)`
    ).run(sessionId, gameId||null, rom.id, streamPath, mode);

    res.status(201).json({
      sessionId,
      streamPath,
      streamUrl: `/stream/${streamPath}/whep`,
      romTitle:  rom.title,
      system:    rom.system,
    });
  } catch (err) {
    console.error('[sessions] Start failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  try {
    await emuRequest('/emulate/stop', { streamPath: session.stream_path });
  } catch (e) {
    console.warn('[sessions] Stop warning:', e.message);
  }

  db.prepare('UPDATE sessions SET ended_at=unixepoch() WHERE id=?').run(session.id);
  res.json({ ok: true });
});

module.exports = router;
