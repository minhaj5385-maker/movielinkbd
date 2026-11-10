// MovieLinkBD — Render-ready full-stack app (Express + SQLite).
// Gateway first, then inside home. No user accounts: visitors browse free.
// Admin login is a server-side PIN (env ADMIN_PIN, default minhaj22).
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const { db, getSetting, setSetting, allSettings } = require('./lib/db');
const V = require('./lib/views');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'minhaj22';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'movielinkbd-dev-secret',
  resave: false, saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use((req, res, next) => { req.session.adShown = req.session.adShown || {}; next(); });

// ---------- ads ----------
function adsEnabled() { return getSetting('ads_global') !== '0'; }
function activeAds(placement) {
  if (!adsEnabled()) return [];
  const now = new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT * FROM ads WHERE placement = ? AND enabled = 1
    AND (schedule = 'lifetime' OR ( (start_at = '' OR start_at <= ?) AND (end_at = '' OR end_at >= ?) ))
    ORDER BY priority DESC, id ASC`).all(placement, now, now);
}
function pickAd(req, placement) {
  for (const ad of activeAds(placement)) {
    const shown = req.session.adShown[placement] || 0;
    if (ad.freq_per_session > 0 && shown >= ad.freq_per_session) continue;
    if (ad.freq_per_day > 0) {
      const day = new Date().toISOString().slice(0, 10);
      const n = db.prepare(`SELECT COUNT(*) c FROM ad_events WHERE ad_id = ? AND kind = 'impression' AND day = ?`).get(ad.id, day).c;
      if (n >= ad.freq_per_day) continue;
    }
    req.session.adShown[placement] = shown + 1;
    return ad;
  }
  return null;
}
function recordEvent(adId, placement, kind) {
  const day = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO ad_events(ad_id, placement, kind, day, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(adId, placement, kind, day, Date.now());
}

// Ad tracking: 1x1 impression pixel, click redirect.
app.get('/a/imp/:id', (req, res) => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
  if (ad) recordEvent(ad.id, req.query.p || ad.placement, 'impression');
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.type('gif').send(gif);
});
app.get('/a/click/:id', (req, res) => {
  const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
  if (!ad) return res.status(404).send('Ad not found');
  recordEvent(ad.id, ad.placement, 'click');
  res.redirect(ad.link_url || ad.content || '/home');
});

// ---------- video filtering (auto-categorisation: filters read the stored
// category/genre/language/type/zone, so an admin-added video appears in
// every matching list, Recently Updated and search at once) ----------
function filteredVideos(q) {
  let sql = 'SELECT * FROM videos WHERE 1=1';
  const args = [];
  if (q.q) { sql += ' AND (title LIKE ? OR desc LIKE ?)'; args.push('%' + q.q + '%', '%' + q.q + '%'); }
  if (q.cat) {
    const c = q.cat.toUpperCase();
    if (c === 'MOVIES') sql += " AND vtype = 'movie'";
    else if (c === 'WEB SERIES') sql += " AND vtype = 'series'";
    else if (c === 'LIVENOW') sql += ' AND featured = 1';
    else { sql += ' AND (UPPER(cat) = ? OR UPPER(genre) = ? OR UPPER(language) = ? OR UPPER(vtype) = ?)'; args.push(c, c, c, c.toLowerCase()); }
  }
  if (q.genre) { sql += ' AND genre = ?'; args.push(q.genre); }
  if (q.lang) { sql += ' AND language = ?'; args.push(q.lang); }
  if (q.zone) {
    if (q.zone === 'ongoing') sql += " AND (zone = 'ongoing' OR vtype = 'series')";
    else { sql += ' AND zone = ?'; args.push(q.zone); }
  }
  if (q.type) { sql += ' AND vtype = ?'; args.push(q.type); }
  sql += ' ORDER BY featured DESC, created_at DESC';
  return db.prepare(sql).all(...args);
}
function filterLabel(q) {
  if (q.q) return 'Search: ' + q.q;
  if (q.cat) return q.cat;
  if (q.genre) return 'Genre: ' + q.genre;
  if (q.lang) return 'Language: ' + q.lang;
  if (q.zone) return 'Zone: ' + (V.ZONE_LABEL[q.zone] || q.zone);
  if (q.type) return q.type === 'series' ? 'Web Series' : q.type === 'reel' ? 'Reels' : 'Movies';
  return '';
}

// ---------- public pages ----------
app.get('/', (req, res) => {
  const s = allSettings();
  const latest = db.prepare("SELECT * FROM videos WHERE vtype IN ('movie','series') ORDER BY featured DESC, created_at DESC LIMIT 8").all();
  res.send(V.gatewayHtml(s, latest));
});

app.get('/home', (req, res) => {
  const s = allSettings();
  const pageSize = parseInt(s.page_size || '30', 10) || 30;
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const all = filteredVideos(req.query);
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const videos = all.slice((page - 1) * pageSize, page * pageSize);
  const qs = new URLSearchParams(req.query);
  const pageUrl = (p) => { qs.set('page', p); return '/home?' + qs.toString(); };
  res.send(V.homeHtml(s, {
    videos, total, page, pages, q: req.query.q, filterLabel: filterLabel(req.query),
    pageUrl, homeAd: pickAd(req, 'home_banner'), feedAd: pickAd(req, 'feed'), stickyAd: pickAd(req, 'sticky'),
  }));
});

app.get('/reels', (req, res) => {
  const s = allSettings();
  const reels = db.prepare("SELECT * FROM videos WHERE vtype = 'reel' ORDER BY created_at DESC").all();
  res.send(V.reelsHtml(s, reels, parseInt(s.reels_ad_every || '5', 10)));
});

app.get('/watch/:id', (req, res) => {
  const s = allSettings();
  const v = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).send('Video not found');
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(v.id);
  const stored = (req.session.unlocked && req.session.unlocked[v.id]) || 0;
  const done = Array.isArray(stored) ? stored.length : stored;
  const unlocked = done >= (v.tasks || 3);
  const taskLinks = (s.task_links || '').split('\n').map(x => x.trim()).filter(Boolean);
  res.send(V.detailHtml(s, v, unlocked, taskLinks,
    unlocked ? null : pickAd(req, 'preroll'),
    unlocked ? pickAd(req, 'pause') : null));
});

app.post('/watch/:id/task', (req, res) => {
  const v = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).send('Video not found');
  const i = parseInt(req.query.task || req.body.task || '0', 10);
  req.session.unlocked = req.session.unlocked || {};
  const done = new Set();
  const cur = req.session.unlocked[v.id];
  if (Array.isArray(cur)) cur.forEach(x => done.add(x));
  else if (typeof cur === 'number') for (let k = 0; k < cur; k++) done.add(k);
  done.add(i);
  req.session.unlocked[v.id] = [...done];
  const s = allSettings();
  const taskLinks = (s.task_links || '').split('\n').map(x => x.trim()).filter(Boolean);
  if (taskLinks[i]) return res.redirect(taskLinks[i]);
  res.redirect('/watch/' + v.id);
});

// ---------- admin ----------
function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin');
}
function adminPage(title, body) {
  return V.layout(title + ' — Admin', `
<div class="logo" style="font-size:26px">MOVIE<span>LINK</span>BD</div>
<div class="adminnav"><a href="/admin">Dashboard</a><a href="/admin/videos">Videos</a>
<a href="/admin/ads">Ads Manager</a><a href="/admin/settings">Settings</a>
<a href="/admin/analytics">Analytics</a><a href="/home">← View Site</a>
<form action="/admin/logout" method="post" style="display:inline"><button class="btn btn-dark" style="padding:8px 14px">Logout</button></form></div>
${body}`);
}
app.get('/admin', (req, res) => {
  if (!req.session.admin) {
    return res.send(V.layout('Admin Login', `
<div class="logo">MOVIE<span>LINK</span>BD</div>
<h2 class="center">Admin Login</h2>
<form class="admin" action="/admin/login" method="post" style="max-width:360px;margin:16px auto">
<label>Admin PIN</label><input type="password" name="pin" required>
<button class="btn btn-red btn-block mt">Login</button></form>`));
  }
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM videos) videos,
    (SELECT COUNT(*) FROM ads) ads,
    (SELECT COUNT(*) FROM ad_events WHERE kind='impression') imps,
    (SELECT COUNT(*) FROM ad_events WHERE kind='click') clicks`).get();
  res.send(adminPage('Dashboard', `
<h2>Dashboard</h2>
<p>Videos: <b>${counts.videos}</b> &nbsp;•&nbsp; Ads: <b>${counts.ads}</b> &nbsp;•&nbsp; Ad impressions: <b>${counts.imps}</b> &nbsp;•&nbsp; Ad clicks: <b>${counts.clicks}</b></p>
<p style="color:#9ca3af">Admin-added videos appear for every visitor instantly (database-backed). Ads start empty — add real Adsterra codes/links in Ads Manager.</p>`));
});
app.post('/admin/login', (req, res) => {
  const pin = String(req.body.pin || '');
  const ok = pin.length === ADMIN_PIN.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(ADMIN_PIN));
  if (ok) { req.session.admin = true; return res.redirect('/admin'); }
  res.status(401).send(V.layout('Admin Login', '<p style="color:#f87171">Wrong PIN.</p><p><a href="/admin">Try again</a></p>'));
});
app.post('/admin/logout', (req, res) => { req.session.admin = false; res.redirect('/admin'); });

// ---------- admin: videos ----------
app.get('/admin/videos', requireAdmin, (req, res) => {
  const videos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  const rows = videos.map(v => `<tr><td>${V.esc(v.title)}</td><td>${V.esc(v.genre)} / ${V.esc(v.language)}</td><td>${V.esc(v.vtype)}${v.zone ? ' / ' + V.esc(v.zone) : ''}</td><td>${V.esc(v.quality)}</td>
  <td><form action="/admin/videos/${V.esc(v.id)}/delete" method="post" onsubmit="return confirm('Delete this video?')"><button class="btn btn-red" style="padding:6px 12px">Delete</button></form></td></tr>`).join('');
  res.send(adminPage('Videos', `
<h2>Videos (${videos.length})</h2>
<form class="admin" action="/admin/videos" method="post">
<label>Title *</label><input name="title" required>
<label>Category</label><input name="cat" placeholder="অ্যাকশন">
<label>Genre</label><select name="genre">${V.GENRES.map(g => `<option>${g}</option>`).join('')}</select>
<label>Language</label><select name="language">${V.LANGUAGES.map(l => `<option>${l}</option>`).join('')}</select>
<label>Type</label><select name="vtype"><option value="movie">Movie</option><option value="series">Web Series</option><option value="reel">Reel</option></select>
<label>Zone</label><select name="zone"><option value="">No zone</option>${V.ZONES.map(z => `<option value="${z.key}">${z.label}</option>`).join('')}</select>
<label>Poster image link (https://… — leave empty for a gradient poster)</label><input name="poster">
<label>Watch link (YouTube / Drive / Telegram) *</label><input name="watch" required placeholder="https://…">
<label>Quality</label><input name="quality" value="HD 1080p">
<label>Rating</label><input name="rating" value="8.5">
<label>Tasks to unlock</label><input name="tasks" value="3">
<label>Description</label><textarea name="desc" rows="2"></textarea>
<label><input type="checkbox" name="featured" value="1"> Pinned (featured)</label>
<button class="btn btn-red mt">💾 Add video</button></form>
<table class="mt"><tr><th>Title</th><th>Genre / Lang</th><th>Type / Zone</th><th>Quality</th><th></th></tr>${rows}</table>
<p style="color:#9ca3af">Adding a video here auto-lists it in its category, genre, language, zone, Recently Updated and search. Editing: delete and re-add with the corrected fields.</p>`));
});
app.post('/admin/videos', requireAdmin, (req, res) => {
  const b = req.body;
  const id = 'v' + Date.now().toString(36);
  db.prepare(`INSERT INTO videos (id, title, cat, genre, language, vtype, zone, poster, watch, quality, rating, tasks, views, year, dur, featured, desc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, ?, ?)`)
    .run(id, b.title, b.cat || '', b.genre || '', b.language || 'Bangla', b.vtype || 'movie', b.zone || '', b.poster || '', b.watch,
      b.quality || 'HD 1080p', parseFloat(b.rating) || 8.5, parseInt(b.tasks) || 3, new Date().getFullYear().toString(), b.featured ? 1 : 0, b.desc || '', Date.now());
  res.redirect('/admin/videos');
});
app.post('/admin/videos/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.redirect('/admin/videos');
});

// ---------- admin: ads ----------
const AD_TYPES = ['html', 'link', 'banner', 'video', 'native'];
const PLACEMENTS = ['home_banner', 'feed', 'video_page', 'preroll', 'midroll', 'pause', 'popunder', 'reels', 'sticky'];
app.get('/admin/ads', requireAdmin, (req, res) => {
  const ads = db.prepare('SELECT * FROM ads ORDER BY priority DESC, id ASC').all();
  const rows = ads.map(a => `<tr><td>${V.esc(a.name)}</td><td>${V.esc(a.type)} / ${V.esc(a.placement)}</td><td>${a.enabled ? 'ON' : 'OFF'} • ${V.esc(a.schedule)} • pri ${a.priority}</td>
  <td><form action="/admin/ads/${a.id}/toggle" method="post" style="display:inline"><button class="btn btn-dark" style="padding:6px 10px">Toggle</button></form>
  <form action="/admin/ads/${a.id}/delete" method="post" style="display:inline" onsubmit="return confirm('Delete this ad?')"><button class="btn btn-red" style="padding:6px 10px">Delete</button></form></td></tr>`).join('');
  res.send(adminPage('Ads Manager', `
<h2>Ads Manager ${getSetting('ads_global') === '0' ? '(GLOBAL OFF)' : ''}</h2>
<p style="color:#9ca3af">Ads start empty. Add real Adsterra / network codes or direct links here — nothing is invented.</p>
<form class="admin" action="/admin/ads" method="post">
<label>Name *</label><input name="name" required>
<label>Type</label><select name="type">${AD_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
<label>Placement</label><select name="placement">${PLACEMENTS.map(p => `<option>${p}</option>`).join('')}</select>
<label>Content (HTML/JS code for "html", text for "native")</label><textarea name="content" rows="3"></textarea>
<label>Click / destination link</label><input name="link_url" placeholder="https://…">
<label>Image URL (banner)</label><input name="image_url" placeholder="https://…">
<label>Video URL (video ad)</label><input name="video_url" placeholder="https://…">
<label>Schedule</label><select name="schedule"><option value="lifetime">Lifetime</option><option value="dated">Dated</option></select>
<label>Start date (dated only)</label><input name="start_at" type="date">
<label>End date (dated only)</label><input name="end_at" type="date">
<label>Priority (higher shows first)</label><input name="priority" value="10">
<label>Frequency cap / session (0 = no cap)</label><input name="freq_per_session" value="0">
<label>Frequency cap / day (0 = no cap)</label><input name="freq_per_day" value="0">
<button class="btn btn-red mt">💾 Add ad</button></form>
<table class="mt"><tr><th>Name</th><th>Type / Placement</th><th>Status</th><th></th></tr>${rows || '<tr><td colspan="4">No ads yet.</td></tr>'}</table>`));
});
app.post('/admin/ads', requireAdmin, (req, res) => {
  const b = req.body;
  db.prepare(`INSERT INTO ads (name, type, placement, content, link_url, image_url, video_url, enabled, schedule, start_at, end_at, priority, freq_per_session, freq_per_day, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`)
    .run(b.name, b.type, b.placement, b.content || '', b.link_url || '', b.image_url || '', b.video_url || '',
      b.schedule || 'lifetime', b.start_at || '', b.end_at || '', parseInt(b.priority) || 10,
      parseInt(b.freq_per_session) || 0, parseInt(b.freq_per_day) || 0, Date.now());
  res.redirect('/admin/ads');
});
app.post('/admin/ads/:id/toggle', requireAdmin, (req, res) => {
  db.prepare('UPDATE ads SET enabled = 1 - enabled WHERE id = ?').run(req.params.id);
  res.redirect('/admin/ads');
});
app.post('/admin/ads/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM ads WHERE id = ?').run(req.params.id);
  res.redirect('/admin/ads');
});

// ---------- admin: settings ----------
app.get('/admin/settings', requireAdmin, (req, res) => {
  const s = allSettings();
  res.send(adminPage('Settings', `
<h2>Gateway &amp; Site Settings</h2>
<form class="admin" action="/admin/settings" method="post">
<label>Site name</label><input name="site_name" value="${V.esc(s.site_name)}">
<label>Free-forever notice</label><input name="notice" value="${V.esc(s.notice)}">
<label>Facebook Group link</label><input name="fb_link" value="${V.esc(s.fb_link)}" placeholder="https://facebook.com/groups/…">
<label>Telegram link</label><input name="tg_link" value="${V.esc(s.tg_link)}" placeholder="https://t.me/…">
<label>Movies per page (default 30)</label><input name="page_size" value="${V.esc(s.page_size)}">
<label>Task links (one URL per line, in order)</label><textarea name="task_links" rows="3">${V.esc(s.task_links)}</textarea>
<label>Official domains (comma-separated)</label><input name="domains" value="${V.esc(s.domains)}">
<label>Ads global on/off</label><select name="ads_global"><option value="1" ${s.ads_global !== '0' ? 'selected' : ''}>ON</option><option value="0" ${s.ads_global === '0' ? 'selected' : ''}>OFF</option></select>
<label>Feed ad every N videos</label><input name="feed_every" value="${V.esc(s.feed_every)}">
<label>Pre-roll skip after (seconds)</label><input name="preroll_skip" value="${V.esc(s.preroll_skip)}">
<button class="btn btn-red mt">💾 Save settings</button></form>
<p style="color:#9ca3af">Admin PIN comes from the ADMIN_PIN environment variable (default minhaj22) — change it in Render env vars, never in a public page.</p>`));
});
app.post('/admin/settings', requireAdmin, (req, res) => {
  for (const [k, v] of Object.entries(req.body)) setSetting(k, v);
  res.redirect('/admin/settings');
});

// ---------- admin: analytics ----------
app.get('/admin/analytics', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT a.id, a.name, a.placement,
    (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.kind='impression') imps,
    (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.kind='click') clicks
    FROM ads a ORDER BY imps DESC`).all();
  const body = rows.map(r => `<tr><td>${V.esc(r.name)}</td><td>${V.esc(r.placement)}</td><td>${r.imps}</td><td>${r.clicks}</td><td>${r.imps ? ((r.clicks / r.imps) * 100).toFixed(2) + '%' : '—'}</td></tr>`).join('');
  res.send(adminPage('Analytics', `
<h2>Ad Analytics</h2>
<p><a class="btn btn-teal" href="/admin/analytics.csv">⬇ Export CSV</a></p>
<table><tr><th>Ad</th><th>Placement</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr>${body || '<tr><td colspan="5">No ad data yet — ads start empty.</td></tr>'}</table>`));
});
app.get('/admin/analytics.csv', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT a.name, a.placement, a.type,
    (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.kind='impression') imps,
    (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.kind='click') clicks
    FROM ads a ORDER BY imps DESC`).all();
  const csv = 'name,placement,type,impressions,clicks,ctr\n' + rows.map(r =>
    `"${r.name.replace(/"/g, '""')}",${r.placement},${r.type},${r.imps},${r.clicks},${r.imps ? (r.clicks / r.imps).toFixed(4) : 0}`).join('\n');
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="movielinkbd-analytics.csv"').send(csv);
});

app.listen(PORT, () => console.log(`MovieLinkBD running on port ${PORT}`));
