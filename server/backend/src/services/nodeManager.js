const { getDb } = require('../db/database');

// Mark nodes offline if no heartbeat for 30 seconds
const OFFLINE_THRESHOLD_MS = 30_000;

function broadcastNodeStatus(nodeId, data) {
  const db = getDb();

  db.prepare(`
    UPDATE nodes SET status = 'online', last_seen = unixepoch() WHERE id = ?
  `).run(nodeId);
}

// Run every 15s — mark stale nodes offline
function startHealthChecker() {
  setInterval(() => {
    const db = getDb();
    const threshold = Math.floor((Date.now() - OFFLINE_THRESHOLD_MS) / 1000);

    const stale = db.prepare(`
      SELECT id, name FROM nodes
      WHERE status = 'online' AND last_seen < ?
    `).all(threshold);

    if (stale.length > 0) {
      db.prepare(`
        UPDATE nodes SET status = 'offline'
        WHERE status = 'online' AND last_seen < ?
      `).run(threshold);

      for (const node of stale) {
        console.log(`[nodeManager] ${node.name} went offline`);
      }
    }
  }, 15_000);
}

module.exports = { broadcastNodeStatus, startHealthChecker };
