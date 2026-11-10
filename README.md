# MovieLinkBD — Render-ready full-stack app

Express + SQLite version of the MovieLinkBD movie & web-series site.
Gateway landing page first, then the inside home (screenshot-matched),
12 seeded sample videos, 30-per-page pagination, auto-categorisation,
task-lock unlock, server-side admin PIN login, Ads Manager and analytics.

## What is in here

- `server.js` — all routes (gateway, home, reels, watch/task-lock, ads tracking, admin)
- `lib/db.js` — SQLite setup + settings + seeding (better-sqlite3)
- `lib/seed.js` — the 12 sample videos (titles/categories/genres/languages
  from the static file; posters are CSS gradients, not copied base64 blobs)
- `lib/views.js` — HTML rendering (gateway, home, detail, reels, admin)
- `public/style.css` — all styling
- `render.yaml` — Render blueprint (free web service)
- `package.json` — start script: `node server.js`

## Run locally

```bash
cd render-app
npm install
npm start
# open http://localhost:3000
```

Admin: open http://localhost:3000/admin — PIN is `minhaj22` by default.
Change it with the env var: `ADMIN_PIN=your-new-pin npm start`

## Deploy on Render (free)

1. Push this folder to a GitHub repo (as the repo root, or set the
   Root Directory to this folder in Render).
2. Render Dashboard → **New → Web Service** → **Build and deploy from a
   Git repository** → pick the repo. Render reads `render.yaml`:
   - Build command: `npm install`
   - Start command: `npm start`
3. Set env vars in Render (Environment):
   - `ADMIN_PIN` — your admin PIN (default `minhaj22` if unset)
   - `SESSION_SECRET` — generated automatically by render.yaml
   - `DATABASE_PATH` — `data/movielinkbd.db` (default)
4. Deploy. Your site gets a `https://movielinkbd.onrender.com` style URL.
   Open it, check the gateway loads, log in to `/admin` with your PIN.

## Important — free-tier data persistence

On Render's **free** plan there is no persistent disk, so the SQLite file
lives on the ephemeral filesystem: **videos/ads/settings you add in admin
will reset when the service restarts or redeploys**. The 12 seed videos
always come back (they re-seed into a fresh DB).

For real persistence: upgrade the service to a paid instance, attach a
Render disk mounted at `/var/data`, and set `DATABASE_PATH` to
`/var/data/movielinkbd.db`.

## Admin — what you can do

- **Videos**: add / delete. A video added with category/genre/language/
  type/zone automatically appears in that category, genre, language, zone,
  Recently Updated and search. Watch links are links (YouTube / Drive /
  Telegram) — videos are not uploaded as files.
- **Ads Manager**: 5 ad types (HTML/JS code, direct/smart/affiliate link,
  custom banner, custom video, native) × placements (home banner, feed,
  video page, pre-roll, mid-roll, pause, popunder, reels, sticky).
  Enable/disable, Lifetime or dated schedule, priority/rotation,
  frequency caps per session/day, global on/off. **Ads start empty** —
  add your real Adsterra codes/links; none are invented here.
- **Settings**: site name, free-forever notice, Facebook Group + Telegram
  links (buttons stay hidden until set), movies per page (default 30),
  task links, official domains, pre-roll skip seconds.
- **Analytics**: impressions / clicks / CTR per ad and placement, CSV export.

## Notes / gaps (honest)

- No user accounts: visitors browse, watch and download free — by design.
- Pre-roll / mid-roll / pause ads render as ad slots on the watch page;
  true video-player mid-roll timing needs a JS player and is not built in.
- Popunder is rendered as a sponsored slot, not a forced new window.
- The free Render tier sleeps after inactivity, so the first visit after a
  pause can take ~30–60s to wake up.
- No invented payment numbers, support contacts, real video links or
  Adsterra codes anywhere in this code.
