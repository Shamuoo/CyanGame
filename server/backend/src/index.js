const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');
const nodesRouter = require('./routes/nodes');
const consolesRouter = require('./routes/consoles');
const gamesRouter = require('./routes/games');
const sessionsRouter = require('./routes/sessions');
const { broadcastNodeStatus } = require('./services/nodeManager');

const app = express();
expressWs(app);

app.use(cors());
app.use(express.json());

// ── Static UI ──────────────────────────────────────────────────────
app.use('/ui', express.static(path.join(__dirname, '../public')));

// ── API Routes ─────────────────────────────────────────────────────
app.use('/nodes',    nodesRouter);
app.use('/consoles', consolesRouter);
app.use('/games',    gamesRouter);
app.use('/sessions', sessionsRouter);

// ── Health ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── WebSocket - real-time updates to portal ────────────────────────
// Nodes and the frontend both connect here
const wsClients = new Set();

app.ws('/ws', (ws, req) => {
  const type = req.query.type || 'portal'; // 'portal' | 'node'
  ws.type = type;
  ws.nodeId = req.query.nodeId;
  wsClients.add(ws);

  console.log(`[ws] ${type} connected${ws.nodeId ? ` (${ws.nodeId})` : ''}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleWsMessage(ws, msg);
    } catch (e) {
      console.error('[ws] bad message:', e.message);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    if (ws.type === 'node' && ws.nodeId) {
      broadcastToPortals({ type: 'NODE_OFFLINE', nodeId: ws.nodeId });
    }
  });
});

function handleWsMessage(ws, msg) {
  switch (msg.type) {

    // Node sends heartbeat every 5s
    case 'HEARTBEAT':
      broadcastNodeStatus(ws.nodeId, msg.data);
      broadcastToPortals({ type: 'NODE_STATUS', nodeId: ws.nodeId, data: msg.data });
      break;

    // Node reports stream started
    case 'STREAM_STARTED':
      broadcastToPortals({ type: 'STREAM_STARTED', ...msg });
      break;

    // Node reports error
    case 'NODE_ERROR':
      broadcastToPortals({ type: 'NODE_ERROR', nodeId: ws.nodeId, error: msg.error });
      break;
  }
}

// Broadcast to all connected portal UIs
function broadcastToPortals(msg) {
  const data = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.type === 'portal' && client.readyState === 1) {
      client.send(data);
    }
  }
}

// Make broadcast available to routes
app.locals.broadcast = broadcastToPortals;
app.locals.wsClients = wsClients;

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`[consolehub] Backend running on :${PORT}`);
    console.log(`[consolehub] UI at http://localhost:${PORT}/ui`);
  });
}).catch(err => {
  console.error('[consolehub] Failed to init DB:', err);
  process.exit(1);
});
