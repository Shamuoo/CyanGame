const express    = require('express');
const expressWs  = require('express-ws');
const cors       = require('cors');
const path       = require('path');
const { initDb } = require('./db/database');

const nodesRouter     = require('./routes/nodes');
const consolesRouter  = require('./routes/consoles');
const gamesRouter     = require('./routes/games');
const sessionsRouter  = require('./routes/sessions');
const romsRouter      = require('./routes/roms');
const setupRouter     = require('./routes/setup');
const { startHealthChecker } = require('./services/nodeManager');

const app = express();
expressWs(app);
app.use(cors());
app.use(express.json());

// ── Static UI ──────────────────────────────────────────
app.use('/ui', express.static(path.join(__dirname, 'ui')));

// ── Wizard redirect — /setup serves the wizard UI ─────
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

// ── API ────────────────────────────────────────────────
app.use('/nodes',    nodesRouter);
app.use('/consoles', consolesRouter);
app.use('/games',    gamesRouter);
app.use('/sessions', sessionsRouter);
app.use('/roms',     romsRouter);
app.use('/setup',    setupRouter);

app.get('/health', (req, res) => res.json({ ok: true, version: '0.2.0' }));

// ── WebSocket ──────────────────────────────────────────
const wsClients = new Set();

app.ws('/ws', (ws, req) => {
  ws.type   = req.query.type   || 'portal';
  ws.nodeId = req.query.nodeId || null;
  wsClients.add(ws);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleWsMessage(ws, msg);
    } catch (e) {}
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    if (ws.type === 'node' && ws.nodeId) {
      broadcast({ type: 'NODE_OFFLINE', nodeId: ws.nodeId });
    }
  });
});

function handleWsMessage(ws, msg) {
  switch (msg.type) {
    case 'HEARTBEAT':
      broadcast({ type: 'NODE_STATUS', nodeId: ws.nodeId, data: msg.data });
      break;
    case 'STREAM_STARTED':
      broadcast({ type: 'STREAM_STARTED', ...msg });
      break;
    case 'NODE_ERROR':
      broadcast({ type: 'NODE_ERROR', nodeId: ws.nodeId, error: msg.error });
      break;
  }
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.type === 'portal' && client.readyState === 1) {
      client.send(data);
    }
  }
}

app.locals.broadcast  = broadcast;
app.locals.wsClients  = wsClients;

// ── Start ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDb().then(() => {
  startHealthChecker();
  app.listen(PORT, () => {
    console.log(`[cyangame] Backend on :${PORT}`);
    console.log(`[cyangame] Portal:  http://localhost:${PORT}/ui`);
    console.log(`[cyangame] Wizard:  http://localhost:${PORT}/setup`);
  });
}).catch(err => {
  console.error('[cyangame] DB init failed:', err);
  process.exit(1);
});
