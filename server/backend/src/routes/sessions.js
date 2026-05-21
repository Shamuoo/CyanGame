const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db/database');
const { startStream, stopStream } = require('../services/streamManager');
const { launchGame } = require('../services/launcher');
const {
  startServerEmulation, stopServerEmulation,
  startNodeEmulation, stopNodeEmulation,
  pickEmulator,
} = require('../services/emulationManager');

const router = express.Router();

// GET /sessions — active sessions
router.get('/', (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT s.*,
      c.name  as console_name,  c.type as console_type,
      g.title as game_title,    g.cover_url,
      n.name  as node_name,     n.ip as node_ip,
      r.title as rom_title,     r.system as rom_system
    FROM sessions s
    LEFT JOIN consoles c ON c.id = s.console_id
    LEFT JOIN nodes n    ON n.id = c.node_id
    LEFT JOIN games g    ON g.id = s.game_id
    LEFT JOIN roms r     ON r.id = (SELECT rom_id FROM games WHERE id = s.game_id)
    WHERE s.ended_at IS NULL
    ORDER BY s.started_at DESC
  `).all();
  res.json(sessions);
});

// POST /sessions — start a session
// Body:
//   { consoleId, gameId? }               — physical
//   { gameId, mode: 'emulation_server' } — emulate on NAS
//   { gameId, mode: 'emulation_node', nodeId } — emulate on a node
router.post('/', async (req, res) => {
  const db = getDb();
  const { consoleId, gameId, mode = 'physical', nodeId } = req.body;

  if (!gameId) return res.status(400).json({ error: 'gameId required' });

  const game = db.prepare(`
    SELECT g.*, r.file_path as rom_path, r.system as rom_system,
      r.title as rom_title, r.id as rom_id
    FROM games g
    LEFT JOIN roms r ON r.id = g.rom_id
    WHERE g.id = ?
  `).get(gameId);

  if (!game) return res.status(404).json({ error: 'Game not found' });

  const sessionId = uuid();
  let streamPath, streamUrl, result;

  try {
    // ── Physical console ────────────────────────────────────────────
    if (mode === 'physical') {
      if (!consoleId) return res.status(400).json({ error: 'consoleId required for physical mode' });

      const console_ = db.prepare(`
        SELECT c.*, n.ip as node_ip, n.status as node_status, n.id as node_id_real
        FROM consoles c JOIN nodes n ON n.id = c.node_id
        WHERE c.id = ?
      `).get(consoleId);

      if (!console_) return res.status(404).json({ error: 'Console not found' });
      if (console_.node_status !== 'online') return res.status(503).json({ error: 'Node is offline' });

      const existing = db.prepare(
        'SELECT id FROM sessions WHERE console_id = ? AND ended_at IS NULL'
      ).get(consoleId);
      if (existing) return res.status(409).json({ error: 'Console in use', sessionId: existing.id });

      streamPath = `console/${console_.node_id}/${consoleId}`;
      await startStream(console_, streamPath);

      if (game) {
        await launchGame(console_, game).catch(err =>
          console.warn(`[sessions] Launch failed: ${err.message}`)
        );
      }

      db.prepare('UPDATE consoles SET status = ? WHERE id = ?').run('active', consoleId);
      db.prepare(`
        INSERT INTO sessions (id, console_id, game_id, stream_path, mode)
        VALUES (?, ?, ?, ?, 'physical')
      `).run(sessionId, consoleId, gameId, streamPath);

    // ── Emulation on server ─────────────────────────────────────────
    } else if (mode === 'emulation_server') {
      if (!game.rom_id) return res.status(400).json({ error: 'No ROM linked to this game' });

      const rom = db.prepare('SELECT * FROM roms WHERE id = ?').get(game.rom_id);
      const emulators = db.prepare('SELECT * FROM emulators WHERE system = ?').all(rom.system);
      const emulator  = pickEmulator(emulators, rom.system, 'server');

      if (!emulator) {
        return res.status(400).json({ error: `No server emulator configured for ${rom.system}` });
      }

      streamPath = `emu/server/${sessionId}`;
      result = await startServerEmulation({ rom, emulator, streamPath });

      db.prepare(`
        INSERT INTO sessions (id, game_id, stream_path, mode, emulator_id, emulation_target)
        VALUES (?, ?, ?, 'emulation_server', ?, 'server')
      `).run(sessionId, gameId, streamPath, emulator.id);

    // ── Emulation on node ───────────────────────────────────────────
    } else if (mode === 'emulation_node') {
      if (!nodeId) return res.status(400).json({ error: 'nodeId required for emulation_node mode' });
      if (!game.rom_id) return res.status(400).json({ error: 'No ROM linked to this game' });

      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
      if (!node)             return res.status(404).json({ error: 'Node not found' });
      if (node.status !== 'online') return res.status(503).json({ error: 'Node offline' });

      const rom = db.prepare('SELECT * FROM roms WHERE id = ?').get(game.rom_id);
      const emulators = db.prepare('SELECT * FROM emulators WHERE system = ?').all(rom.system);
      const emulator  = pickEmulator(emulators, rom.system, 'node');

      if (!emulator) {
        return res.status(400).json({ error: `No node emulator configured for ${rom.system}` });
      }

      streamPath = `emu/node/${nodeId}/${sessionId}`;
      result = await startNodeEmulation({ node, rom, emulator, streamPath });

      db.prepare(`
        INSERT INTO sessions (id, game_id, stream_path, mode, emulator_id, emulation_target)
        VALUES (?, ?, ?, 'emulation_node', ?, ?)
      `).run(sessionId, gameId, streamPath, emulator.id, nodeId);

    } else {
      return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }

    streamUrl = `/stream/${streamPath}/whep`;

    res.status(201).json({
      sessionId,
      streamPath,
      streamUrl,
      mode,
      gameId,
      consoleId: consoleId || null,
      emulationTarget: mode !== 'physical' ? (mode === 'emulation_server' ? 'server' : nodeId) : null,
    });

  } catch (err) {
    console.error('[sessions] Failed to start:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /sessions/:id — end session
router.delete('/:id', async (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    if (session.mode === 'physical' && session.console_id) {
      const console_ = db.prepare(`
        SELECT c.*, n.ip as node_ip FROM consoles c JOIN nodes n ON n.id = c.node_id WHERE c.id = ?
      `).get(session.console_id);
      if (console_) {
        await stopStream(console_, session.stream_path);
        db.prepare('UPDATE consoles SET status = ? WHERE id = ?').run('idle', session.console_id);
      }

    } else if (session.mode === 'emulation_server') {
      await stopServerEmulation(session.stream_path);

    } else if (session.mode === 'emulation_node') {
      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(session.emulation_target);
      if (node) await stopNodeEmulation(node, session.stream_path);
    }

    db.prepare('UPDATE sessions SET ended_at = unixepoch() WHERE id = ?').run(session.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[sessions] Stop error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
