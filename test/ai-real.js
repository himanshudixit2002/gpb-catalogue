// Real AI cut-out with the self-hosted files: worker vs page, isolated (multi-core) vs not.
// Usage: node ai-real.js [appHtml]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = process.argv[2] || path.join(ROOT, 'build', 'catalogue-maker.html');
const VENDOR = path.join(ROOT, 'vendor');
const OUT = path.join(__dirname, 'ai-real'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.html': 'text/html' };
function serve(isolated) {
  return http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let p;
    if (u === '/' || u === '/index.html') p = APP;
    else if (u === '/vendor/imgly/1.7.0/ai-worker.mjs') p = path.join(ROOT, 'src', 'ai-worker.mjs');
    else if (u.startsWith('/vendor/')) p = path.join(VENDOR, u.slice('/vendor/'.length));
    else if (u.startsWith('/img/')) p = path.join(__dirname, u);
    if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
    const h = { 'Content-Type': types[path.extname(p)] || (u.includes('/data/') ? 'application/octet-stream' : 'text/html') };
    if (isolated) { h['Cross-Origin-Opener-Policy'] = 'same-origin'; h['Cross-Origin-Embedder-Policy'] = 'require-corp'; }
    res.writeHead(200, h); fs.createReadStream(p).pipe(res);
  }).listen(0);
}
async function run(browser, isolated, worker, label) {
  const srv = serve(isolated); const url = `http://localhost:${srv.address().port}/`;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(800);
  const r = await page.evaluate(async ({ worker }) => {
    if (!worker) AI.noWorker = true;
    const img = await IMG.decode(await (await fetch('/img/box-showroom.jpg')).blob());
    const d = IMG.dims(img), s = 1024 / Math.max(d.w, d.h);
    const c = IMG.canvas(Math.round(d.w * s), Math.round(d.h * s)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    // watch the main thread: longest gap between timer ticks while the AI works
    let last = performance.now(), worst = 0, ticks = 0; const iv = setInterval(() => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; ticks++; }, 16);
    const events = []; const t0 = performance.now();
    await AI.load(p => events.push(p.text));
    const tLoad = performance.now() - t0;
    const t1 = performance.now();
    const a1 = await AI.mask(c, 'fast', p => { if (events.length < 400) events.push(p.phase); });
    const tFirst = performance.now() - t1;
    const t2 = performance.now();
    const a2 = await AI.mask(c, 'fast');
    const tWarm = performance.now() - t2;
    clearInterval(iv);
    // mask sanity: centre opaque, corners transparent, share of foreground
    const W = c.width, H = c.height, at = (x, y) => a2[Math.round(y) * W + Math.round(x)];
    let fg = 0; for (let i = 0; i < a2.length; i++) if (a2[i] > 127) fg++;
    // composite for a visual check
    const o = IMG.canvas(W, H), x = o.getContext('2d');
    for (let yy = 0; yy < H; yy += 16) for (let xx = 0; xx < W; xx += 16) { x.fillStyle = ((xx + yy) / 16) % 2 ? '#d8dbe4' : '#f4f5f8'; x.fillRect(xx, yy, 16, 16); }
    const m = IMG.canvas(W, H), mx = m.getContext('2d'); mx.drawImage(c, 0, 0); const id = mx.getImageData(0, 0, W, H); for (let i = 0; i < a2.length; i++) id.data[i * 4 + 3] = a2[i]; mx.putImageData(id, 0, 0); x.drawImage(m, 0, 0);
    const png = o.toDataURL('image/png');
    return { mode: AI.mode, isolated: AI.isolated, threads: AI.threads, crossOriginIsolated: window.crossOriginIsolated, size: [W, H], tLoad: Math.round(tLoad), tFirst: Math.round(tFirst), tWarm: Math.round(tWarm), worstGapMs: Math.round(worst), ticks, centre: at(W / 2, H / 2), corner: at(4, 4), fgShare: +(fg / a2.length).toFixed(3), same: a1.length === a2.length, downloaded: AI.isDownloaded('fast'), progressKinds: [...new Set(events)].slice(0, 8), png };
  }, { worker });
  fs.writeFileSync(path.join(OUT, label + '.png'), Buffer.from(r.png.split(',')[1], 'base64')); delete r.png;
  r.errors = errors;
  console.log(label.padEnd(22), JSON.stringify(r));
  await page.close(); srv.close();
  return r;
}
(async () => {
  const browser = await chromium.launch();
  const results = {};
  results.isoWorker = await run(browser, true, true, 'isolated-worker');
  results.isoPage = await run(browser, true, false, 'isolated-page');
  results.plainWorker = await run(browser, false, true, 'plain-worker');
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  await browser.close();
})().catch(e => { console.error('AI-REAL FAILED', e); process.exit(1); });
