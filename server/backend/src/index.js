const express   = require('express');
const expressWs = require('express-ws');
const cors      = require('cors');
const path      = require('path');
const { initDb } = require('./db/database');

const app = express();
expressWs(app);
app.use(cors());
app.use(express.json());

// Serve portal UI
app.use(express.static(path.join(__dirname, 'ui')));

// API routes
app.use('/nodes',    require('./routes/nodes'));
app.use('/consoles', require('./routes/consoles'));
app.use('/games',    require('./routes/games'));
app.use('/sessions', require('./routes/sessions'));
app.use('/roms',     require('./routes/roms'));
app.use('/setup',    require('./routes/setup'));

app.get('/health', (req, res) => res.json({ ok: true, version: '0.2.0' }));

// Catch-all — serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

// WebSocket for live updates
const clients = new Set();
app.ws('/ws', (ws, req) => {
  ws.clientType = req.query.type || 'portal';
  ws.nodeId     = req.query.nodeId || null;
  clients.add(ws);
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'HEARTBEAT') broadcast({ type: 'NODE_STATUS', nodeId: ws.nodeId, data: msg.data });
    } catch {}
  });
  ws.on('close', () => {
    clients.delete(ws);
    if (ws.clientType === 'node' && ws.nodeId) broadcast({ type: 'NODE_OFFLINE', nodeId: ws.nodeId });
  });
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of clients) {
    if (c.clientType === 'portal' && c.readyState === 1) c.send(data);
  }
}
app.locals.broadcast = broadcast;

const PORT = process.env.PORT || 3001;
initDb().then(() => {
  app.listen(PORT, () => console.log(`[cyangame] Running on :${PORT}`));
}).catch(err => { console.error('[cyangame] DB failed:', err); process.exit(1); });
