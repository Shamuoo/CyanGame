const Database = require('better-sqlite3');
const fs   = require('fs');
const path = require('path');

const DB_PATH   = process.env.DB_PATH   || path.join(__dirname, '../../../data/cyangame.db');
const SCHEMA_V1 = path.join(__dirname, 'schema.sql');
const SCHEMA_V2 = path.join(__dirname, 'schema-v2.sql');

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

async function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_V1, 'utf8'));

  // Apply v2 migration (ALTER TABLE statements use IF NOT EXISTS via try/catch)
  try { db.exec(fs.readFileSync(SCHEMA_V2, 'utf8')); } catch (e) {
    // Column already exists = safe to ignore
    if (!e.message.includes('duplicate column')) throw e;
  }

  console.log(`[db] SQLite ready: ${DB_PATH}`);
  return db;
}

module.exports = { getDb, initDb };
