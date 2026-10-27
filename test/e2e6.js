// The website build (public/) with Firebase-like headers: isolation, service worker, offline,
// shortcuts, share target, update notice, and the self-hosted AI (also offline).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public'), IMGS = path.join(__dirname, 'img'), OUT = path.join(__dirname, 'e2e6');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.csv': 'text/csv' };
let swExtra = '';               // appended to sw.js to simulate a new release
const hits = { vendor: 0 };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const head = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'X-Content-Type-Options': 'nosniff' };
  let p;
  if (u === '/') p = path.join(PUB, 'index.html');
  else if (u.startsWith('/test-img/')) p = path.join(IMGS, u.slice(10));
  else if (u === '/test-csv') p = path.join(__dirname, 'products.csv');
  else p = path.join(PUB, u);
  if (req.method === 'POST') { res.writeHead(405, head); res.end(); return; } // static hosting: the service worker must answer POSTs
  if (!p.startsWith(PUB) && !p.startsWith(IMGS) && !p.endsWith('products.csv') || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404, head); res.end('not found'); return; }
  if (u.startsWith('/vendor/')) hits.vendor++;
  let body = fs.readFileSync(p);
  if (u === '/sw.js' && swExtra) body = Buffer.concat([body, Buffer.from(swExtra)]);
  head['Content-Type'] = types[path.extname(p)] || 'application/octet-stream';
  head['Cache-Control'] = /\/(assets|vendor)\//.test(u) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, head); res.end(body);
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/`;
const results = []; const ok = (n, p, i) => results.push((p ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
const idle = (page, ms = 400) => page.waitForTimeout(ms);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()); });

  /* 1. site loads isolated, service worker takes control, manifest + icons are valid */
  await page.goto(URL_); await idle(page, 1200);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await idle(page, 1200);
  const s1 = await page.evaluate(async () => {
    const m = await (await fetch('manifest.webmanifest')).json();
    const icons = await Promise.all(m.icons.concat(m.shortcuts.flatMap(s => s.icons)).map(async i => (await fetch(i.src)).status));
    return { title: document.title, isolated: window.crossOriginIsolated, controlled: !!navigator.serviceWorker.controller, app: typeof App !== 'undefined' && !!App.S,
      name: m.name, display: m.display, share: m.share_target && m.share_target.action, shortcuts: m.shortcuts.length, icons, scripts: Array.from(document.scripts).map(s => s.src.replace(location.origin, '')) };
  });
  ok('Site opens cross-origin isolated with the service worker in control', s1.isolated && s1.controlled && s1.app && s1.title === 'GPB Catalogue', JSON.stringify({ isolated: s1.isolated, controlled: s1.controlled, title: s1.title }));
  ok('Manifest has name, standalone display, shortcuts and a share target; all icons load', s1.name === 'GPB Catalogue' && s1.display === 'standalone' && s1.shortcuts === 2 && !!s1.share && s1.icons.every(x => x === 200), JSON.stringify({ icons: s1.icons, share: s1.share }));
  ok('Code and styles load as separate files from the site', s1.scripts.length === 2 && s1.scripts.every(x => /^\/assets\/(app|fonts)\.[0-9a-f]{10}\.js$/.test(x)), JSON.stringify(s1.scripts));

  /* 2. offline */
  await ctx.setOffline(true); await page.reload(); await idle(page, 1200);
  const off = await page.evaluate(() => ({ app: typeof App !== 'undefined' && !!App.S, main: !!document.querySelector('#main .onboard, #main .grid, #main') }));
  ok('Opens with no internet after the first visit', off.app && off.main, JSON.stringify(off));
  await ctx.setOffline(false);

  /* 3. home-screen shortcuts */
  await page.goto(URL_ + '?action=catalogue'); await idle(page, 1300);
  const sc1 = await page.evaluate(() => ({ view: App.view, url: location.search }));
  ok('Shortcut "Make a catalogue" opens the catalogue and tidies the address', sc1.view === 'catalogue' && sc1.url === '', JSON.stringify(sc1));
  await page.goto(URL_ + '?action=add'); await idle(page, 1300);
  ok('Shortcut "Add products" opens the add sheet', await page.locator('.sheet:has-text("Take photo")').count() === 1);
  await page.keyboard.press('Escape'); await idle(page, 300);

  /* 4. share target: two photos shared from another app */
  const share = async (files) => {
    await page.evaluate(async (files) => {
      const dt = new DataTransfer();
      for (const f of files) { const b = await (await fetch(f.url)).blob(); dt.items.add(new File([b], f.name, { type: f.type })); }
      const form = document.createElement('form'); form.method = 'POST'; form.action = 'share-target'; form.enctype = 'multipart/form-data';
      const inp = document.createElement('input'); inp.type = 'file'; inp.name = 'files'; inp.multiple = true; inp.files = dt.files; form.appendChild(inp);
      document.body.appendChild(form); form.submit();
    }, files);
    await page.waitForURL(u => !/share-target/.test(u.toString()), { timeout: 15000 }); await idle(page, 1500);
  };
  const before = await page.evaluate(() => App.products.length);
  await share([{ url: '/test-img/bottle-wall.jpg', name: 'IMG_20261027_101500.jpg', type: 'image/jpeg' }, { url: '/test-img/pan-wood.jpg', name: 'IMG_20261027_101530.jpg', type: 'image/jpeg' }]);
  await page.waitForFunction((n) => !Batch.running && App.products.length >= n + 2, before, { timeout: 120000 }).catch(() => { });
  const sh = await page.evaluate(() => ({ n: App.products.length, url: location.search, names: App.products.map(p => p.srcName).filter(Boolean) }));
  ok('Two photos shared from Gallery/WhatsApp become two products', sh.n === before + 2 && sh.url === '' && sh.names.includes('IMG_20261027_101500.jpg'), JSON.stringify(sh));
  const leftovers = await page.evaluate(async () => (await (await caches.open('share-inbox')).keys()).length);
  ok('Shared files are cleared from the inbox once taken', leftovers === 0, 'left ' + leftovers);
  await share([{ url: '/test-csv', name: 'price-list.csv', type: 'text/csv' }]);
  ok('A shared product list (CSV) opens the import', await page.locator('.modal:has-text("Import product list")').count() === 1);
  await page.screenshot({ path: path.join(OUT, 'shared-csv.png') });
  await page.keyboard.press('Escape'); await idle(page, 300);

  /* 5. update notice when a new version is published */
  swExtra = '\n// release ' + Date.now();
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some(t => /new version/i.test(t.textContent)), null, { timeout: 20000 }).catch(() => { });
  const upd = await page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | '));
  ok('Publishing a new version shows "A new version of the app is ready" with Reload', /new version of the app is ready/i.test(upd) && /Reload/.test(upd), upd);
  await page.screenshot({ path: path.join(OUT, 'update-toast.png') });

  /* 6. AI from the site in a background worker, then again with no internet */
  if (fs.existsSync(path.join(PUB, 'vendor', 'imgly', '1.7.0', 'background-removal.mjs'))) {
    await page.reload(); await idle(page, 1200);
    const ai = await page.evaluate(async () => {
      const img = await IMG.decode(await (await fetch('/test-img/box-showroom.jpg')).blob());
      const c = IMG.canvas(768, 576); c.getContext('2d').drawImage(img, 0, 0, 768, 576);
      const t = performance.now(); const a = await AI.mask(c, 'fast'); const ms = performance.now() - t;
      const cached = (await (await caches.open('ai-files')).keys()).length;
      return { mode: AI.mode, isolated: AI.isolated, ms: Math.round(ms), centre: a[288 * 768 + 384], corner: a[5], cached, downloaded: AI.isDownloaded('fast') };
    });
    ok('AI cut-out runs from the site in a background worker, multi-core', ai.mode === 'worker' && ai.isolated && ai.centre > 200 && ai.corner < 30, JSON.stringify(ai));
    ok('AI files are kept on the phone after the first download', ai.cached >= 15 && ai.downloaded, 'cached ' + ai.cached);
    const hitsBefore = hits.vendor;
    await ctx.setOffline(true); await page.reload(); await idle(page, 1500);
    const ai2 = await page.evaluate(async () => {
      const c = IMG.canvas(400, 300); const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#c33'; x.fillRect(120, 80, 160, 140);
      const a = await AI.mask(c, 'fast'); return { mode: AI.mode, centre: a[150 * 400 + 200], corner: a[3] };
    }).catch(e => ({ error: e.message }));
    ok('AI cut-out also works with no internet once downloaded', !ai2.error && ai2.mode === 'worker' && hits.vendor === hitsBefore, JSON.stringify(ai2) + ' new requests ' + (hits.vendor - hitsBefore));
    await ctx.setOffline(false);
  } else ok('AI files present in public/vendor (skipped)', false, 'run npm run vendor');

  ok('No page errors', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
  fs.writeFileSync(path.join(OUT, 'results.txt'), results.join('\n'));
  console.log(results.join('\n'));
  await browser.close(); server.close();
})().catch(e => { console.error('E2E6 FAILED', e); console.log(results.join('\n')); server.close(); process.exit(1); });
