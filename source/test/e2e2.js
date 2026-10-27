// Second e2e pass: AI fallback, CSV import, photo↔code matching, restore on a fresh phone, file:// banner, 2,000-product scale test.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build'), IMGS = path.join(__dirname, 'img'), OUT = path.join(__dirname, 'e2e2');
if (process.argv[2] !== 'D') fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
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
  const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console.error ' + m.text()); }); return { ctx, page, errors }; };

  const ONLY_D = process.argv[2] === 'D';
  if (!ONLY_D) {
  /* ---------- A: CSV import + AI fallback + photo matching ---------- */
  const A = await mk(); let page = A.page;
  await page.goto(URL_); await idle(page, 900);
  await page.click('button[aria-label="More"]'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Import product list")'), path.join(__dirname, 'products.csv'));
  await page.waitForSelector('.modal:has-text("Import product list")'); await idle(page, 300);
  await snap(page, 'csv-mapping');
  const mapping = await page.evaluate(() => Array.from(document.querySelectorAll('.map-grid .field')).map(f => f.querySelector('.f-label').textContent + '=' + f.querySelector('select').selectedOptions[0].textContent));
  log.push('csv mapping: ' + mapping.join(' | '));
  await page.click('.toggle:has-text("Colour")');
  await page.click('.modal-actions .btn:has-text("Import")'); await idle(page, 900);
  await snap(page, 'csv-imported');
  const imported = await page.evaluate(() => App.products.map(p => [p.f.brand || '', p.f.name, p.f.size || '', p.f.mrp || '', p.f.product || '', p.f.code || '', p.f[Object.keys(p.f).find(k => k.startsWith('c_')) ] || '']));
  log.push('imported ' + imported.length + ': ' + JSON.stringify(imported.slice(0, 4)) + ' … last ' + JSON.stringify(imported[imported.length - 1]));
  // photo named by code attaches to the right product
  fs.copyFileSync(path.join(IMGS, 'bottle-wall.jpg'), path.join(OUT, 'VTK-AHO500.jpg'));
  fs.copyFileSync(path.join(IMGS, 'pan-wood.jpg'), path.join(OUT, 'HWK-T28.jpg'));
  await page.click('.snap'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Choose photos")'), [path.join(OUT, 'VTK-AHO500.jpg'), path.join(OUT, 'HWK-T28.jpg')]);
  await page.waitForFunction(() => !Batch.running && App.products.filter(p => p.img && p.img.out).length >= 2, null, { timeout: 120000 }); await idle(page, 800);
  const matched = await page.evaluate(() => App.products.filter(p => p.img && p.img.out).map(p => p.f.code + ':' + p.f.name));
  log.push('photo matching: ' + JSON.stringify(matched) + ' total products ' + await page.evaluate(() => App.products.length));
  await snap(page, 'matched');
  // AI fallback: CDN blocked in this sandbox → should fall back to Quick with a clear message
  await page.fill('input[type=search]', 'amla'); await idle(page, 500);
  await page.click('.tile:has-text("Amla Hair Oil")'); await page.waitForSelector('.editor'); await waitNotBusy(page); await idle(page, 500);
  await page.click('.ed-step[data-step=cutout]'); await waitNotBusy(page); await idle(page, 300);
  await page.click('.seg-btn:has-text("AI")'); await idle(page, 300);
  await snap(page, 'ai-confirm');
  await page.click('.modal-actions .btn:has-text("Download and use AI")');
  await page.waitForFunction(() => Editor.st && Editor.st.edit.bg === 'quick' && !document.querySelector('#ed-busy.on'), null, { timeout: 90000 }); await idle(page, 500);
  await snap(page, 'ai-fallback');
  log.push('AI fallback ok, failure: ' + await page.evaluate(() => AI.failed));
  await page.click('button[aria-label="Close editor"]'); await idle(page, 400);
  if (await page.locator('.modal-actions .btn:has-text("Leave")').count()) { await page.click('.modal-actions .btn:has-text("Leave")'); await idle(page, 400); }
  // backup this phone (used for restore test)
  await page.click('button[aria-label="More"]'); await idle(page, 300);
  await page.click('.sheet-item:has-text("Back up everything")');
  await page.waitForSelector('.modal:has-text("Backup ready")', { timeout: 60000 });
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('.modal-actions .btn:has-text("Download")')]);
  const bkPath = path.join(OUT, 'phoneA.zip'); await bk.saveAs(bkPath);
  log.push('A errors: ' + JSON.stringify(A.errors));
  await A.ctx.close();

  /* ---------- B: fresh phone restores A's backup (merge) ---------- */
  const B = await mk(); page = B.page;
  await page.goto(URL_); await idle(page, 900);
  await pick(page, () => page.click('.ob-more .btn:has-text("Restore a backup")'), bkPath);
  await page.waitForSelector('.modal:has-text("Restore backup")'); await idle(page, 200);
  await snap(page, 'restore-dialog');
  await page.click('.modal-actions .btn:has-text("Restore")');
  await page.waitForFunction(() => App.products.length >= 10, null, { timeout: 60000 }); await idle(page, 900);
  const restored = await page.evaluate(() => ({ n: App.products.length, withPhoto: App.products.filter(p => p.img && p.img.out).length, fields: App.S.fields.map(f => f.label) }));
  log.push('restored on fresh phone: ' + JSON.stringify(restored));
  await snap(page, 'restored');
  // restore the same file again → nothing duplicated
  await page.click('button[aria-label="More"]'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Restore or merge")'), bkPath);
  await page.waitForSelector('.modal:has-text("Restore backup")'); await page.click('.modal-actions .btn:has-text("Restore")'); await idle(page, 2000);
  log.push('after second merge: ' + await page.evaluate(() => App.products.length));
  log.push('B errors: ' + JSON.stringify(B.errors));
  await B.ctx.close();

  /* ---------- C: opened as a saved file (file://) → warning banner ---------- */
  const C = await mk(); page = C.page;
  await page.goto('file://' + path.join(ROOT, 'catalogue-maker.html')); await idle(page, 1200);
  const bannerTxt = await page.evaluate(() => { const b = document.querySelector('.banner.bad'); return b ? b.textContent : null; });
  log.push('file:// banner: ' + bannerTxt);
  await snap(page, 'file-protocol');
  await C.ctx.close();

  }
  /* ---------- D: scale test – 2,000 products ---------- */
  const D = await mk(); page = D.page;
  await page.goto(URL_); await idle(page, 900);
  // build seed images through the real batch path (3 photos), then clone records to 2,000
  await pick(page, () => page.evaluate(() => { Add.choose(); return true; }), ['box-showroom.jpg', 'bottle-wall.jpg', 'pan-wood.jpg'].map(f => path.join(IMGS, f)));
  const perPhoto = await page.waitForFunction(() => !Batch.running && App.products.length >= 3, null, { timeout: 120000 }).then(() => page.evaluate(() => App.products.map(p => p.q && p.q.sharpness)));
  const t = await page.evaluate(async () => {
    const seeds = App.products.slice(0, 3);
    const brands = ['Prestige', 'Hawkins', 'Milton', 'Cello', 'Borosil', 'Pigeon', 'Butterfly', 'Wonderchef'];
    const kinds = ['Cooker', 'Kadai', 'Tawa', 'Flask', 'Bottle', 'Kettle', 'Mixer', 'Pan'];
    const recs = [];
    for (let i = 0; i < 2000; i++) {
      const s = seeds[i % 3];
      recs.push({ id: 'px' + i, createdAt: Date.now() - i * 1000, updatedAt: Date.now(), order: i + 10, f: { brand: brands[i % 8], name: kinds[(i >> 3) % 8] + ' model ' + (1000 + i), size: (1 + i % 5) + ' L', mrp: String(499 + (i * 37) % 4000), product: kinds[(i >> 3) % 8] }, img: Object.assign({}, s.img), edit: s.edit, review: false });
    }
    const t0 = performance.now();
    await DB.putMany('products', recs);
    await App.load();
    const tLoad = performance.now() - t0;
    go('products'); await new Promise(r => setTimeout(r, 300));
    const t1 = performance.now(); ProductsView.refresh(); const tList = performance.now() - t1;
    App.S.cat.perPage = 10; App.S.cat.quality = 'small'; App.S.cat.split = 500; App.S.cat.groupBy = 'brand'; App.S.cat.index = true; App.S.cat.include = 'all';
    const t2 = performance.now(); const L = CatalogueView.build(); const tLayout = performance.now() - t2;
    const t3 = performance.now();
    const parts = await RENDER.exportPDF(L, CatalogueView.exportSettings(), (src, w, h) => CatalogueView.drawable(src, w, h), null);
    const tPdf = performance.now() - t3;
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    window.__parts = parts;
    return { products: App.products.length, tLoad: Math.round(tLoad), tList: Math.round(tList), tLayout: Math.round(tLayout), pages: L.pages.length, tPdf: Math.round(tPdf), files: parts.map(p => [p.name, p.pages, Math.round(p.blob.size / 1024) + 'KB']), heapMB: mem };
  });
  log.push('scale: ' + JSON.stringify(t));
  // save first part for inspection
  const b64 = await page.evaluate(async () => { const b = new Uint8Array(await window.__parts[0].blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); });
  fs.writeFileSync(path.join(OUT, 'scale-part1.pdf'), Buffer.from(b64, 'base64'));
  await page.evaluate(() => window.scrollTo(0, 40000)); await idle(page, 500);
  await snap(page, 'scale-scrolled');
  log.push('D errors: ' + JSON.stringify(D.errors));
  await D.ctx.close();
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  console.log(log.join('\n'));
  await browser.close(); server.close();
})().catch(e => { console.error('E2E2 FAILED', e); console.log(log.join('\n')); server.close(); process.exit(1); });
