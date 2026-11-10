// SQLite setup (better-sqlite3). DB path from DATABASE_PATH env, else
// ./data/movielinkbd.db. Falls back to /tmp when the chosen dir is not writable.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const SEED = require('./seed');

function openDb() {
  const wanted = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'movielinkbd.db');
  const dir = path.dirname(path.resolve(wanted));
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* fall through */ }
  try {
    return new Database(path.resolve(wanted));
  } catch (e) {
    const fb = path.join('/tmp', 'movielinkbd.db');
    console.warn('DB path not writable, falling back to', fb, e.message);
    return new Database(fb);
  }
}

const db = openDb();

db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, cat TEXT DEFAULT '',
  genre TEXT DEFAULT '', language TEXT DEFAULT '', vtype TEXT DEFAULT 'movie',
  zone TEXT DEFAULT '', poster TEXT DEFAULT '', watch TEXT DEFAULT '',
  quality TEXT DEFAULT 'HD 1080p', rating REAL DEFAULT 8.5, tasks INTEGER DEFAULT 3,
  views INTEGER DEFAULT 0, year TEXT DEFAULT '', dur TEXT DEFAULT '',
  featured INTEGER DEFAULT 0, desc TEXT DEFAULT '', created_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, type TEXT NOT NULL, placement TEXT NOT NULL,
  content TEXT DEFAULT '', link_url TEXT DEFAULT '', image_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '', enabled INTEGER DEFAULT 1,
  schedule TEXT DEFAULT 'lifetime', start_at TEXT DEFAULT '', end_at TEXT DEFAULT '',
  priority INTEGER DEFAULT 10, freq_per_session INTEGER DEFAULT 0,
  freq_per_day INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ad_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id INTEGER, placement TEXT, kind TEXT, day TEXT, created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ad_events_ad ON ad_events(ad_id);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);
`);

const DEFAULT_SETTINGS = {
  site_name: 'MovieLinkBD',
  notice: 'MovieLinkBD আগেও ফ্রি ছিল, সবসময় ফ্রিই থাকবে 🍿',
  fb_link: '',
  tg_link: '',
  page_size: '30',
  ads_global: '1',
  feed_every: '5',
  reels_ad_every: '5',
  preroll_skip: '5',
  task_links: '', // one URL per line; tasks open these in order
  domains: 'MovieLinkBD.com,MovieLinkBD.one,MovieLinkBD.tv,MovieLinkBD.shop',
  gateway_headline: 'MovieLinkBD Official — Download Latest Movies & Web Series in Bangla, Hindi & Dual Audio',
};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)').run(k, v);
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (DEFAULT_SETTINGS[key] || '');
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value ?? ''));
}
function allSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

// Seed videos once (only when the table is empty).
const count = db.prepare('SELECT COUNT(*) c FROM videos').get().c;
if (count === 0) {
  const ins = db.prepare(`INSERT INTO videos
    (id, title, cat, genre, language, vtype, zone, poster, watch, quality, rating, tasks, views, year, dur, featured, desc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = Date.now();
  SEED.forEach((v, i) => ins.run(v.id, v.title, v.cat, v.genre, v.language, v.vtype, v.zone, v.watch, v.quality, v.rating, v.tasks, v.views, v.year, v.dur, v.featured, v.desc, now - i * 60000));
  console.log('Seeded', SEED.length, 'videos');
}

module.exports = { db, getSetting, setSetting, allSettings };
