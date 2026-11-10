// HTML rendering helpers. No user accounts anywhere: visitors browse free.
const GENRES = ['Action','Adventure','Animation','Biographical','Comedy','Crime','Documentary','Drama','Family','Fantasy','Historical','Horror','Music','Musical','Mystery','Romance','Sci-Fi','Sports','FIFA','Superhero','Survival','Suspense','Thriller','War'];
const LANGUAGES = ['Bangla','Bangla Dubbed','Chinese','Dual Audio','English','French','Gujrati','Hindi','Hindi Dubbed','Indonesian','Italian','Japanese','Kannada','Korean','Malayalam','Malaysian','Marathi','Others','Portuguese','Punjabi','Spanish','Tamil','Telugu','Turkish','Vietnamese'];
const CATEGORIES = ['LIVENOW','BANGLA','BANGLA DUB','BOLLYWOOD','HINDI','HINDI DUB','DUAL AUDIO','INDONESIAN','ENGLISH','ACTION','THRILLER','HORROR','ROMANCE','MOVIES','WEB SERIES','WWE','MCU','DC'];
const ZONES = [
  { key: 'anime', label: 'ANIME ZONE', badge: 'FRESH', cls: 'purple' },
  { key: 'adult', label: '18+ ADULT', badge: 'HOT NOW', cls: 'red' },
  { key: 'ongoing', label: 'ONGOING SERIES', badge: 'NEW', cls: 'orange' },
  { key: 'drama', label: 'K/J/C-DRAMA', badge: 'ALL DRAMA', cls: 'blue' },
  { key: 'south', label: 'SOUTH INDIAN', badge: 'BEST', cls: 'teal' },
  { key: 'animation', label: 'ANIMATION', badge: 'CARTOONS', cls: 'magenta' },
];
const ZONE_LABEL = Object.fromEntries(ZONES.map(z => [z.key, z.label]));

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hue(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function posterHtml(v, big) {
  const inner = v.poster
    ? `<img src="${esc(v.poster)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
    : `<span>${esc((v.title || '?').trim().charAt(0))}</span>`;
  return `<div class="poster" style="background:linear-gradient(135deg,hsl(${hue(v.id)} 70% 45%),hsl(${(hue(v.id) + 60) % 360} 70% 45%))">${inner}
    ${v.featured ? '<span class="badge">📌 PINNED</span>' : ''}
    <span class="qual">${esc(v.quality || '')}</span>
    <span class="type">${v.vtype === 'series' ? 'SERIES' : v.vtype === 'reel' ? 'REEL' : 'MOVIE'}</span></div>`;
}
function cardHtml(v) {
  return `<div class="card"><a href="/watch/${esc(v.id)}">${posterHtml(v)}
    <h3>${esc(v.title)}</h3>
    <div class="meta">⭐ ${esc(v.rating)} &nbsp;•&nbsp; ${esc(v.year)} &nbsp;•&nbsp; ${esc(v.dur)}</div></a></div>`;
}
function layout(title, body, extra = '') {
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — MovieLinkBD</title>
<link rel="stylesheet" href="/style.css"></head>
<body><div class="wrap">${body}</div>${extra}</body></html>`;
}
function socialButtons(s) {
  let out = '';
  if (s.fb_link) out += `<a class="btn btn-blue" href="${esc(s.fb_link)}" target="_blank" rel="noopener">👥 Join Group</a> `;
  if (s.tg_link) out += `<a class="btn btn-teal" href="${esc(s.tg_link)}" target="_blank" rel="noopener">✈️ Join Us On Telegram</a>`;
  return out ? `<div class="center mt">${out}</div>` : '';
}
function adHtml(ad, placement) {
  // Renders one ad. Impressions are tracked by the 1px image below.
  if (!ad) return '';
  let inner = '';
  if (ad.type === 'html') inner = ad.content || '';
  else if (ad.type === 'link') inner = `<a class="btn btn-red" href="/a/click/${ad.id}" target="_blank" rel="noopener">👉 ${esc(ad.name)}</a>`;
  else if (ad.type === 'banner') inner = `<a href="/a/click/${ad.id}" target="_blank" rel="noopener"><img src="${esc(ad.image_url)}" alt="${esc(ad.name)}" style="max-width:100%;border-radius:8px"></a>`;
  else if (ad.type === 'video') inner = `<video src="${esc(ad.video_url)}" controls style="max-width:100%;border-radius:8px"></video><br><a class="btn btn-red" href="/a/click/${ad.id}" target="_blank" rel="noopener">${esc(ad.name)}</a>`;
  else inner = `<div class="card" style="padding:14px"><b>${esc(ad.name)}</b><p>${esc(ad.content || '')}</p><a class="btn btn-red" href="/a/click/${ad.id}" target="_blank" rel="noopener">Visit</a></div>`;
  return `<div class="ad" data-placement="${esc(placement)}"><div class="lbl">ADVERTISEMENT</div>${inner}<img src="/a/imp/${ad.id}?p=${esc(placement)}" width="1" height="1" alt=""></div>`;
}
function gatewayHtml(s, videos) {
  const domains = (s.domains || '').split(',').map(d => d.trim()).filter(Boolean);
  return layout('MovieLinkBD — Latest Movies & Web Series', `
<div class="logo">MOVIE<span>LINK</span>BD</div>
<h1 class="center" style="font-size:20px;margin:8px 0">MovieLinkBD Official — Download Latest Movies &amp; Web Series in <span style="color:#4ade80">Bangla, Hindi &amp; Dual Audio</span></h1>
<div class="center mt"><span class="pill pill-green">Official &amp; Always Active Link: MovieLinkBD.com</span></div>
<form class="searchbar" action="/home" method="get"><input name="q" placeholder="Movie বা Series-এর English নাম লিখুন"><button>Search</button></form>
<div class="center"><a class="btn btn-pink" href="/home">Visit MovieLinkBD</a>
<a class="btn btn-dark" href="/home?proxy=1">Visit via Proxy</a></div>
<p class="center mt" style="font-size:13px;color:#9ca3af">সাইট ব্লক বা Error দেখালে ব্যবহার করুন</p>
<div class="warn-box"><b>⚠️ সতর্কতা:</b> নকল সাইট থেকে সাবধান থাকুন। MovieLinkBD-এর অফিসিয়াল ডোমেইন শুধু এই ${domains.length}টি: <b>${domains.map(esc).join(', ')}</b></div>
<div class="center"><span class="pill pill-orange">📥 ডাউনলোড করার নিয়ম</span></div>
<p class="center mt" style="font-size:13px">সাইট না খুললে <b style="color:#4ade80">1.1.1.1 VPN</b> ব্যবহার করুন। নতুন লিংক সবসময় MovieLinkBD.com-এ পাবেন — আপডেট পেতে গ্রুপে জয়েন করুন।</p>
${socialButtons(s)}
<h2 class="section-h">🎬 নতুন মুভি ও সিরিজ — Latest Movies &amp; Web Series <a href="/home" style="float:right;font-size:14px">সব দেখুন →</a></h2>
<div class="grid">${videos.map(cardHtml).join('')}</div>
<footer><div class="logo" style="font-size:24px">MOVIE<span>LINK</span>BD</div>
<p>বাংলা • হিন্দি • সাউথ • K/J/C ড্রামা • অ্যানিমে — HEVC 480p থেকে 4K পর্যন্ত, এক ক্লিকে ডাউনলোড ও ওয়াচ</p>
<p>© 2026 MovieLinkBD.com — All Rights Reserved.</p></footer>`);
}
function homeHtml(s, opts) {
  const { videos, total, page, pages, q, filterLabel, homeAd, feedAd, stickyAd } = opts;
  const domains = (s.domains || '').split(',').map(d => d.trim()).filter(Boolean);
  const d = (i) => domains[i] || '#';
  const pager = [];
  if (pages > 1) {
    if (page > 1) pager.push(`<a href="${opts.pageUrl(page - 1)}">&lt;</a>`);
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) pager.push(p === page ? `<span class="cur">${p}</span>` : `<a href="${opts.pageUrl(p)}">${p}</a>`);
      else if (pager[pager.length - 1] !== '…') pager.push('<span>…</span>');
    }
    if (page < pages) pager.push(`<a href="${opts.pageUrl(page + 1)}">&gt;</a>`);
  }
  return layout('MovieLinkBD — Home', `
<div class="logo">MOVIE<span>LINK</span>BD</div>
<p class="center" style="font-size:13px">Working official link: <b>MovieLinkBD.com</b> &nbsp;•&nbsp; সাইট না খুললে <b style="color:#4ade80">1.1.1.1 VPN</b> ব্যবহার করুন</p>
<div class="pills">
<a class="pillbtn grey" href="/home">🏠 HOME</a>
<a class="pillbtn teal" href="https://${esc(d(1))}" target="_blank" rel="noopener">.ONE</a>
<a class="pillbtn blue" href="https://${esc(d(0))}" target="_blank" rel="noopener">.WORK</a>
<a class="pillbtn yellow" href="https://${esc(d(3))}" target="_blank" rel="noopener">.SHOP</a>
<a class="pillbtn lightblue" href="https://${esc(d(2))}" target="_blank" rel="noopener">.TV</a>
</div>
<div class="center"><span class="pill pill-orange">📥 ডাউনলোড করার নিয়ম</span></div>
<div class="catgrid">${CATEGORIES.map(c => `<a href="/home?cat=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
<form class="searchbar" action="/home" method="get"><input name="q" value="${esc(q || '')}" placeholder="Movie বা Series-এর English নাম লিখুন"><button>Search</button></form>
<div class="zonegrid">${ZONES.map(z => `<a class="zone ${z.cls}" href="/home?zone=${z.key}">${z.label}<small>${z.badge}</small></a>`).join('')}</div>
<div class="free">${esc(s.notice || '')}</div>
${adHtml(homeAd, 'home_banner')}
<h2 class="section-h">🕐 RECENTLY UPDATED ${filterLabel ? '— ' + esc(filterLabel) : ''} <span style="float:right;font-size:13px;color:#9ca3af">(${total}টি)</span></h2>
<div class="grid">${videos.map(cardHtml).join('') || '<p>কিছু পাওয়া যায়নি।</p>'}</div>
${feedAd ? adHtml(feedAd, 'feed') : ''}
<div class="pager">${pager.join('')}</div>
<h2 class="section-h">GENRES • ${GENRES.length}</h2>
<div class="cols2">${GENRES.map(g => `<a href="/home?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>
<h2 class="section-h">LANGUAGES • ${LANGUAGES.length}</h2>
<div class="cols2">${LANGUAGES.map(l => `<a href="/home?lang=${encodeURIComponent(l)}">${esc(l)}</a>`).join('')}</div>
<div class="warn-box"><b>নোটিশ:</b> সিনেমা হলে চলমান কোনো বাংলাদেশি কনটেন্টের হলপ্রিন্ট / লিক ভার্সন এখানে আপলোড করা হয় না। সঠিক নামে সার্চ করে না পেলে পোস্টারটি Facebook গ্রুপে পোস্ট করুন। অ্যাড খুলে গেলে একবার Back চেপে আবার ক্লিক করুন — আসল Download / Watch পেজ খুলবে। নাম বা পোস্টারে ক্লিক করে কোয়ালিটি বেছে নিন: 480p / 720p / 1080p / 4K।</div>
${socialButtons(s)}
<h2 class="section-h">❓ FAQ</h2>
<details><summary>কীভাবে ডাউনলোড করব?</summary><p>নাম বা পোস্টারে ক্লিক করুন, টাস্কগুলো শেষ করুন, তারপর কোয়ালিটি বেছে Download / Watch চাপুন।</p></details>
<details><summary>কোন কোয়ালিটি পাওয়া যায়?</summary><p>480p / 720p / 1080p / HEVC, সর্বোচ্চ 4K পর্যন্ত।</p></details>
<details><summary>বাংলা / হিন্দি / ডুয়াল অডিও আছে?</summary><p>হ্যাঁ — বাংলা, হিন্দি, ডুয়াল অডিও ছাড়াও সাউথ ইন্ডিয়ান, K/J/C ড্রামা ও অ্যানিমে আছে।</p></details>
<details><summary>ব্যবহার কি ফ্রি?</summary><p>হ্যাঁ, সম্পূর্ণ ফ্রি — কোনো অ্যাকাউন্ট বা সাবস্ক্রিপশন লাগে না।</p></details>
<details><summary>নতুন কনটেন্ট কখন আসে?</summary><p>প্রতিদিন নতুন মুভি ও সিরিজ যোগ করা হয়।</p></details>
<footer><div class="logo" style="font-size:24px">MOVIE<span>LINK</span>BD</div>
<p>বাংলা • হিন্দি • সাউথ • K/J/C ড্রামা • অ্যানিমে — HEVC 480p থেকে 4K পর্যন্ত, এক ক্লিকে ডাউনলোড ও ওয়াচ</p>
<div class="links"><a href="/home">Help &amp; FAQ</a><a href="/home">How to Unzip</a><a href="/home">Most Watched</a><a href="/home">Upcoming Releases</a><a href="/home">Latest Published</a></div>
<p>© 2026 MovieLinkBD.com — All Rights Reserved.</p><p>DramaLinkBD – K/J/C Drama &nbsp;•&nbsp; MovieLinkBD.one</p>
<p><a href="/admin">Admin</a></p></footer>`,
  stickyAd ? `<div class="sticky">${adHtml(stickyAd, 'sticky')}</div>` : '');
}
function detailHtml(s, v, unlocked, taskLinks, prerollAd, pauseAd) {
  const tasks = Array.from({ length: v.tasks || 3 }, (_, i) => i);
  return layout(v.title + ' — MovieLinkBD', `
<div class="logo" style="font-size:26px">MOVIE<span>LINK</span>BD</div>
<p><a href="/home">← ফিরে যান</a></p>
<div class="card" style="margin-top:12px">${posterHtml(v)}
<div style="padding:14px"><h1 style="font-size:20px">${esc(v.title)}</h1>
<p style="color:#9ca3af">⭐ ${esc(v.rating)} • ${esc(v.year)} • ${esc(v.dur)} • ${esc(v.quality)} • ${esc(v.genre)} • ${esc(v.language)}</p>
<p class="mt">${esc(v.desc || '')}</p>
${prerollAd && !unlocked ? `<div class="mt">${adHtml(prerollAd, 'preroll')}<p style="font-size:13px;color:#9ca3af">Skip after ${esc(s.preroll_skip || 5)}s — এই অ্যাডের পর টাস্ক শুরু হবে।</p></div>` : ''}
${unlocked
    ? `<div class="mt"><a class="btn btn-pink" href="${esc(v.watch)}" target="_blank" rel="noopener">▶ Watch Now</a>
       <a class="btn btn-teal" href="${esc(v.watch)}" target="_blank" rel="noopener">⬇ Download</a></div>
       ${pauseAd ? `<div class="mt">${adHtml(pauseAd, 'pause')}</div>` : ''}`
    : `<h2 class="section-h">🔒 Watch / Download আনলক করতে ${v.tasks || 3}টি টাস্ক শেষ করুন</h2>
       <form action="/watch/${esc(v.id)}/task" method="post">
       ${tasks.map(i => `<button class="taskbtn" name="task" value="${i}" formaction="/watch/${esc(v.id)}/task?task=${i}">Task ${i + 1}${taskLinks[i] ? ' — খুলুন' : ' — সম্পন্ন করুন'}</button>`).join('')}
       </form><p style="font-size:13px;color:#9ca3af">টাস্কে ক্লিক করলে অ্যাড / লিংক খুলতে পারে — ফিরে এসে পরের টাস্কটি শেষ করুন।</p>`}
</div></div>`);
}
function reelsHtml(s, reels, adEvery) {
  return layout('Reels — MovieLinkBD', `
<div class="logo" style="font-size:26px">MOVIE<span>LINK</span>BD</div>
<p><a href="/home">← Home</a></p>
${reels.map((v, i) => `<div class="reel"><h2>${esc(v.title)}</h2><p>⭐ ${esc(v.rating)} • ${esc(v.dur)}</p>
<a class="btn btn-pink" href="/watch/${esc(v.id)}" style="margin-top:10px;align-self:flex-start">▶ Watch</a></div>
${(i + 1) % (adEvery || 5) === 0 ? '<div class="ad"><div class="lbl">SPONSORED REEL</div></div>' : ''}`).join('')}`);
}
module.exports = { GENRES, LANGUAGES, CATEGORIES, ZONES, ZONE_LABEL, esc, layout, cardHtml, posterHtml, gatewayHtml, homeHtml, detailHtml, reelsHtml, adHtml, socialButtons };
