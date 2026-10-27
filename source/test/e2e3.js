// AI path with a stand-in library (default-export shape), plus editor rotate/zoom, long text and A5/landscape layout checks.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build'), IMGS = path.join(__dirname, 'img'), OUT = path.join(__dirname, 'e2e3');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/catalogue-maker.html'));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); });
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/catalogue-maker.html`;
const log = []; let shot = 0;
const snap = async (page, name) => { await page.screenshot({ path: path.join(OUT, String(++shot).padStart(2, '0') + '-' + name + '.png') }); };
const pick = async (page, trigger, files) => { const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), trigger()]); await fc.setFiles(files); };
const idle = (page, ms = 400) => page.waitForTimeout(ms);
const waitNotBusy = (page, t = 60000) => page.waitForFunction(() => !document.querySelector('#ed-busy.on'), null, { timeout: t });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
  await page.goto(URL_); await idle(page, 900);
  // stand-in AI library: default export only, reports download progress, returns a PNG whose alpha is a centred ellipse
  await page.evaluate(() => {
    const src = `export default async function removeBackground(blob, cfg) {
      if (cfg && cfg.progress) { cfg.progress('fetch:/models/isnet_quint8', 20, 40); cfg.progress('fetch:/models/isnet_quint8', 40, 40); cfg.progress('compute:inference', 1, 1); }
      const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d');
      x.drawImage(bmp, 0, 0); x.globalCompositeOperation = 'destination-in'; x.beginPath(); x.ellipse(bmp.width/2, bmp.height/2, bmp.width*0.3, bmp.height*0.38, 0, 0, Math.PI*2); x.fill();
      return await c.convertToBlob({ type: 'image/png' });
    }`;
    const u = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    AI.urls = () => ['https://cdn.jsdelivr.net/npm/@imgly/background-removal@0.0.0-missing/+esm', u];
  });
  // add a product, use AI in the editor
  await page.click('.snap'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Take photo")'), path.join(IMGS, 'bottle-wall.jpg'));
  await page.waitForSelector('.editor'); await waitNotBusy(page); await idle(page, 300);
  await page.click('.tray-next .btn:has-text("Next: cut-out")'); await waitNotBusy(page); await idle(page, 300);
  await page.click('.seg-btn:has-text("AI")'); await idle(page, 300);
  await page.click('.modal-actions .btn:has-text("Download and use AI")');
  await page.waitForFunction(() => Editor.st && Editor.st.edit.bg === 'ai' && Editor.st.mask && !document.querySelector('#ed-busy.on'), null, { timeout: 30000 }); await idle(page, 400);
  await snap(page, 'ai-mask');
  const aiInfo = await page.evaluate(() => ({ url: AI.url, mask: [Editor.st.mask.w, Editor.st.mask.h], center: Editor.st.mask.data[(Editor.st.mask.h >> 1) * Editor.st.mask.w + (Editor.st.mask.w >> 1)], corner: Editor.st.mask.data[5] }));
  log.push('AI via stand-in: ' + JSON.stringify(aiInfo));
  // rotate in the frame step, zoom with wheel, then save
  await page.click('.ed-step[data-step=frame]'); await idle(page, 300);
  const q0 = await page.evaluate(() => JSON.stringify(Editor.st.edit.quad));
  await page.click('.tool:has-text("Rotate")'); await idle(page, 500);
  const after = await page.evaluate(() => ({ w: Editor.st.src.width, h: Editor.st.src.height, mask: Editor.st.mask && [Editor.st.mask.w, Editor.st.mask.h], quad: Editor.st.edit.quad.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]) }));
  log.push('rotate: before quad ' + q0 + ' after ' + JSON.stringify(after));
  await snap(page, 'rotated');
  await page.click('.ed-step[data-step=details]'); await idle(page, 600);
  await page.fill('#fld-name', 'Extra Virgin Cold-Pressed Coconut & Amla Hair Oil with Bhringraj, Hibiscus, Curry Leaves and Vitamin E for Strong Long Hair');
  await page.fill('#fld-brand', 'Parachute Advansed Ayurvedic');
  await page.fill('#fld-mrp', 'On request');
  await page.fill('#fld-size', 'नारियल तेल 500 ml');
  await idle(page, 700);
  await snap(page, 'long-text-card');
  await page.click('.tray-next .btn:has-text("Save"):not(:has-text("next"))'); await idle(page, 1500);
  // batch with AI as default
  await page.evaluate(() => { App.S.photo.bg = 'ai'; });
  await page.click('.snap'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Choose photos")'), ['pan-wood.jpg', 'box-showroom.jpg'].map(f => path.join(IMGS, f)));
  await page.waitForFunction(() => !Batch.running && App.products.length >= 3, null, { timeout: 120000 }); await idle(page, 600);
  log.push('batch with AI: ' + JSON.stringify(await page.evaluate(() => App.products.map(p => [p.edit && p.edit.bg, !!(p.img && p.img.out), p.review]))));
  // layouts: A5 landscape, 1 per page, elegant, long text + Devanagari raster fallback → PDF
  const res = await page.evaluate(async () => {
    const out = {};
    for (const [pg, orient, n] of [['A5', 'landscape', 3], ['A4', 'portrait', 1], ['Letter', 'landscape', 10]]) {
      Object.assign(App.S.cat, { page: pg, orient, perPage: n, include: 'all', font: 'serif', theme: 'ivory', cover: true, index: true, groupBy: 'none', split: 0, quality: 'small' });
      const L = CatalogueView.build();
      const parts = await RENDER.exportPDF(L, CatalogueView.exportSettings(), (src, w, h) => CatalogueView.drawable(src, w, h), null);
      const b = new Uint8Array(await parts[0].blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      out[pg + '-' + orient + '-' + n] = { pages: L.pages.length, b64: btoa(s) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) { fs.writeFileSync(path.join(OUT, k + '.pdf'), Buffer.from(v.b64, 'base64')); log.push('pdf ' + k + ' pages ' + v.pages); }
  log.push('errors: ' + JSON.stringify(errors));
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  console.log(log.join('\n'));
  await browser.close(); server.close();
})().catch(e => { console.error('E2E3 FAILED', e); console.log(log.join('\n')); server.close(); process.exit(1); });
