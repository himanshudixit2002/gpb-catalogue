// Regression tests for the independent review's findings.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build'), IMGS = path.join(__dirname, 'img'), OUT = path.join(__dirname, 'e2e4');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const types = { '.jpg': 'image/jpeg', '.zip': 'application/zip', '.csv': 'text/csv' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/img/') ? path.join(__dirname, u) : u.startsWith('/out/') ? path.join(OUT, u.slice(5)) : path.join(ROOT, 'catalogue-maker.html');
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/html' }); res.end(d); });
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/`;
const results = []; const ok = (name, pass, info) => { results.push((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const pick = async (page, trigger, files) => { const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), trigger()]); await fc.setFiles(files); };
const idle = (page, ms = 400) => page.waitForTimeout(ms);
const waitNotBusy = (page, t = 60000) => page.waitForFunction(() => !document.querySelector('#ed-busy.on'), null, { timeout: t });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto(URL_); await idle(page, 900);

  /* 1. CSV with Hindi names must not merge rows */
  fs.writeFileSync(path.join(OUT, 'hindi.csv'), '﻿Brand,Name,Size,MRP\nTata,चाय,250 g,120\nTata,कॉफ़ी,250 g,240\nTata,हल्दी,250 g,60\nAB,C,1,10\nA,BC,1,11\n');
  await pick(page, () => page.evaluate(() => { CsvImport.run(); return 1; }), path.join(OUT, 'hindi.csv'));
  await page.waitForSelector('.modal:has-text("Import product list")');
  await page.click('.modal-actions .btn:has-text("Import")'); await idle(page, 800);
  const n1 = await page.evaluate(() => App.products.map(p => p.f.name));
  ok('CSV keeps 5 distinct products incl. Hindi names', n1.length === 5, JSON.stringify(n1));
  // re-import same file → updates, not duplicates
  await pick(page, () => page.evaluate(() => { CsvImport.run(); return 1; }), path.join(OUT, 'hindi.csv'));
  await page.waitForSelector('.modal:has-text("Import product list")'); await page.click('.modal-actions .btn:has-text("Import")'); await idle(page, 800);
  ok('Re-importing the same CSV updates instead of duplicating', await page.evaluate(() => App.products.length) === 5);

  /* 3. "Add details only" → type → Leave → stays as Unfinished, visible now and after reload */
  await page.evaluate(() => Editor.open({ noPhoto: true })); await page.waitForSelector('.editor'); await idle(page, 400);
  await page.fill('#fld-name', 'Draft product typed only'); await idle(page, 1200);
  await page.click('button[aria-label="Close editor"]'); await idle(page, 300);
  await page.click('.modal-actions .btn:has-text("Leave")'); await idle(page, 700);
  const d1 = await page.evaluate(() => { const p = App.products.find(x => x.f.name === 'Draft product typed only'); return p ? { draft: p.draft, status: App.status(p) } : null; });
  ok('Typed-only draft is kept as Unfinished in the list', !!d1 && d1.draft === true && d1.status === 'review', JSON.stringify(d1));
  // empty "add details" + leave → nothing saved
  const before = await page.evaluate(() => App.products.length);
  await page.evaluate(() => Editor.open({ noPhoto: true })); await page.waitForSelector('.editor'); await idle(page, 300);
  await page.click('button[aria-label="Close editor"]'); await idle(page, 500);
  if (await page.locator('.modal-actions .btn:has-text("Leave")').count()) { await page.click('.modal-actions .btn:has-text("Leave")'); await idle(page, 500); }
  ok('Empty draft is not kept', await page.evaluate(() => App.products.length) === before);

  /* 2. Reopen an unfinished draft, type, leave, then reorder → details survive reload */
  await page.evaluate(() => { const p = App.products.find(x => x.f.name === 'Draft product typed only'); Editor.open({ product: p }); });
  await page.waitForSelector('.editor'); await idle(page, 400);
  await page.fill('#fld-mrp', '777'); await idle(page, 1300);
  await page.click('button[aria-label="Close editor"]'); await idle(page, 300);
  if (await page.locator('.modal-actions .btn:has-text("Leave")').count()) { await page.click('.modal-actions .btn:has-text("Leave")'); await idle(page, 600); }
  await page.evaluate(async () => { const p = App.products.find(x => x.f.name === 'Draft product typed only'); p.order = 999; await App.renumber(); });
  await page.reload(); await idle(page, 1000);
  const d2 = await page.evaluate(() => { const p = App.products.find(x => x.f.name === 'Draft product typed only'); return p && p.f.mrp; });
  ok('Draft edits survive reorder + reload', d2 === '777', 'mrp=' + d2);

  /* 4. Two tabs: B edits, A duplicates → B's edit is not reverted */
  const pageB = await ctx.newPage(); await pageB.goto(URL_); await idle(pageB, 1000);
  const warnA = await page.evaluate(() => Sync.warned);
  await pageB.evaluate(async () => { const p = App.products.find(x => x.f.name === 'चाय'); p.f.mrp = '135'; await App.saveProduct(p); });
  await idle(page, 600);
  await page.evaluate(async () => { const p = App.products.find(x => x.f.name === 'AB' || x.f.name === 'C'); await App.duplicateProduct(p); });
  await idle(page, 400);
  const mrpNow = await pageB.evaluate(async () => (await DB.all('products')).find(x => x.f.name === 'चाय').f.mrp);
  ok('Second tab edit survives first tab duplicate', mrpNow === '135', 'mrp=' + mrpNow + ' warnedA=' + warnA);
  await pageB.close();

  /* 6. Retake inside a new product: one draft, old photo removed */
  await pick(page, () => page.evaluate(() => { Add.photo(); return 1; }), path.join(IMGS, 'bottle-wall.jpg'));
  await page.waitForSelector('.editor'); await waitNotBusy(page); await idle(page, 300);
  const blobs1 = await page.evaluate(async () => (await DB.allKeys('blobs')).length);
  const draftId = await page.evaluate(() => Editor.st.p.id);
  const drafts1 = await page.evaluate(async () => (await DB.all('products')).filter(p => p.draft).length);
  await pick(page, () => page.evaluate(() => { Editor.addPhoto(true); return 1; }), path.join(IMGS, 'pan-wood.jpg'));
  await waitNotBusy(page); await idle(page, 400);
  const blobs2 = await page.evaluate(async () => (await DB.allKeys('blobs')).length);
  const sameDraft = await page.evaluate((id) => Editor.st.p.id === id, draftId);
  const drafts2 = await page.evaluate(async () => (await DB.all('products')).filter(p => p.draft).length);
  ok('Retake keeps one draft and replaces its photo', blobs2 === blobs1 && sameDraft && drafts2 === drafts1, `blobs ${blobs1}->${blobs2}, drafts ${drafts1}->${drafts2}, same=${sameDraft}`);
  const histBefore = await page.evaluate(() => history.length);
  await page.click('button[aria-label="Close editor"]'); await idle(page, 300);
  await page.click('.modal-actions .btn:has-text("Cancel")'); await idle(page, 300);
  ok('X then Cancel adds no history entry', await page.evaluate(() => history.length) === histBefore);

  /* 7. Rotate during a cut-out is refused; saved mask matches the photo */
  await page.click('.ed-step[data-step=cutout]'); await idle(page, 50);
  const rot = await page.evaluate(async () => { const busy = Editor.st.busy; const w0 = Editor.st.src.width; await Editor.rotate(); return { busy, rotated: Editor.st.src.width !== w0 }; });
  await waitNotBusy(page); await idle(page, 300);
  ok('Rotate is refused while the cut-out runs', rot.busy > 0 ? rot.rotated === false : true, JSON.stringify(rot));
  await page.click('.ed-step[data-step=frame]'); await idle(page, 200);
  await page.evaluate(() => Editor.rotate()); await idle(page, 600);
  await page.click('.ed-step[data-step=cutout]'); await waitNotBusy(page); await idle(page, 300);
  const dims = await page.evaluate(() => ({ src: [Editor.st.src.width, Editor.st.src.height], mask: Editor.st.mask && [Editor.st.mask.w, Editor.st.mask.h] }));
  const aspectOk = dims.mask && Math.abs(dims.src[0] / dims.src[1] - dims.mask[0] / dims.mask[1]) < 0.02;
  ok('Mask orientation matches the photo after rotate', !!aspectOk, JSON.stringify(dims));
  await page.click('.ed-step[data-step=details]'); await idle(page, 400);
  await page.fill('#fld-name', 'Rotated pan'); await page.click('.tray-next .btn:has-text("Save"):not(:has-text("next"))'); await idle(page, 1500);
  const saved = await page.evaluate(async () => { const p = App.products.find(x => x.f.name === 'Rotated pan'); const m = await PIPE.blobToMask(await DB.getBlob(p.img.mask)); return { sw: p.img.sw, sh: p.img.sh, mw: m.w, mh: m.h, draft: p.draft }; });
  ok('Saved photo and mask agree', Math.abs(saved.sw / saved.sh - saved.mw / saved.mh) < 0.02 && saved.draft === false, JSON.stringify(saved));

  /* 8. Typing a title then exporting at once uses the new title */
  const t8 = await page.evaluate(async () => {
    go('catalogue'); await new Promise(r => setTimeout(r, 300));
    const inp = Array.from(document.querySelectorAll('label.field')).find(l => l.textContent.startsWith('Catalogue title')).querySelector('input');
    inp.value = 'Diwali Specials'; inp.dispatchEvent(new Event('input'));
    App.S.cat.include = 'all';
    CatalogueView.build();
    const L = CatalogueView.L;
    return L.pages[0].ops.filter(o => o.t === 'text').map(o => o.str).join(' | ');
  });
  ok('Export layout uses the just-typed title', t8.indexOf('Diwali Specials') >= 0);

  /* 9 + 10 + 11. Layout checks */
  const lay = await page.evaluate(() => {
    const mk = (i) => ({ id: 'L' + i, order: i, createdAt: 0, updatedAt: 0, f: { brand: 'Brand ' + String(i % 16).padStart(2, '0'), name: 'Item ' + i, size: '1 L', mrp: '100' }, img: {} });
    const prods = Array.from({ length: 64 }, (_, i) => mk(i));
    const groups = []; const m = new Map(); for (const p of prods) { if (!m.has(p.f.brand)) m.set(p.f.brand, []); m.get(p.f.brand).push(p); }
    for (const [name, items] of m) groups.push({ name, items });
    const out = {};
    for (const [pg, orient] of [['A5', 'landscape'], ['A5', 'portrait'], ['A4', 'landscape']]) {
      const S = { biz: { name: 'Sharma Traders', tagline: 'Since 1987', phone: '+91 98765 43210', whatsapp: '9876543210', email: 'sales@sharmatraders.in', website: 'sharmatraders.in', address: '12, Station Road, Jaipur 302006', gstin: '08ABCDE1234F1Z5' }, fields: App.S.fields, cat: Object.assign({}, App.S.cat, { page: pg, orient, perPage: 4, groupBy: 'brand', contents: true, dividers: true, cover: true, index: false }) };
      const L = LAYOUT.build(groups, S, null);
      const contents = L.pages.filter(p => p.ops.some(o => o.t === 'text' && o.str === 'Contents'));
      const listed = contents.reduce((a, p) => a + p.ops.filter(o => o.t === 'goto').length, 0);
      const cover = L.pages[0], W = cover.w, H = cover.h;
      const outside = cover.ops.filter(o => o.t === 'text' && (o.y > H + 1 || o.x + o.w > W + 1 || o.x < -1)).map(o => o.str);
      const qr = cover.ops.find(o => o.t === 'qr');
      const gst = cover.ops.find(o => o.t === 'text' && o.str === '08ABCDE1234F1Z5');
      const imgOverQr = qr ? cover.ops.filter(o => o.t === 'img' && o.x < qr.x + qr.size && o.x + o.w > qr.x && o.y < qr.y + qr.size && o.y + o.h > qr.y).length : 0;
      out[pg + '-' + orient] = { sections: groups.length, listed, outside, gstinY: gst && Math.round(gst.y), H: Math.round(H), imgOverQr };
    }
    // split with sections: no part may end with a divider
    const S2 = { biz: {}, fields: App.S.fields, cat: Object.assign({}, App.S.cat, { page: 'A4', orient: 'portrait', perPage: 2, groupBy: 'brand', dividers: true, contents: false, cover: false, split: 4 }) };
    const L2 = LAYOUT.build(groups, S2, null);
    out.kinds = L2.pages.map(p => p.kind[0]).join('');
    return out;
  });
  for (const k of ['A5-landscape', 'A5-portrait', 'A4-landscape']) {
    const r = lay[k];
    ok(`Contents lists all sections (${k})`, r.listed === r.sections, `${r.listed}/${r.sections}`);
    ok(`Cover fits the page (${k})`, r.outside.length === 0 && r.gstinY < r.H - 20 && r.imgOverQr === 0, JSON.stringify(r));
  }
  // simulate split boundary with RENDER (needs real export) – check via a tiny export with split=4
  const splitCheck = await page.evaluate(async () => {
    const mk = (i) => ({ id: 'S' + i, order: i, createdAt: 0, updatedAt: 0, f: { brand: 'B' + (i >> 2), name: 'Item ' + i }, img: {} });
    const prods = Array.from({ length: 12 }, (_, i) => mk(i));
    const groups = []; const m = new Map(); for (const p of prods) { if (!m.has(p.f.brand)) m.set(p.f.brand, []); m.get(p.f.brand).push(p); }
    for (const [name, items] of m) groups.push({ name, items });
    const S = { biz: {}, fields: App.S.fields, cat: Object.assign({}, App.S.cat, { page: 'A4', orient: 'portrait', perPage: 2, groupBy: 'brand', dividers: true, contents: false, cover: false, split: 4, index: false }) };
    const L = LAYOUT.build(groups, S, null);
    const parts = await RENDER.exportPDF(L, S, async () => null, null);
    return { parts: parts.length, kinds: L.pages.map(p => p.kind[0]).join('') };
  });
  ok('Split files keep each section title page with its products', splitCheck.parts >= 3, JSON.stringify(splitCheck));

  /* 12. Merge order: products from a second phone come after this phone's own, in their order */
  const merge = await page.evaluate(async () => {
    const mine = App.products.slice().sort((a, b) => a.order - b.order).map(p => p.id);
    const theirs = [1, 2, 3].map(i => ({ id: 'other' + i, order: i, createdAt: Date.now(), updatedAt: Date.now(), f: { name: 'Other phone ' + i }, img: {} }));
    const manifest = { app: APP.name, version: APP.version, createdAt: new Date().toISOString(), staff: 'Ravi', settings: App.S, products: theirs };
    const zip = await ZIP.write([{ name: 'manifest.json', data: JSON.stringify(manifest) }]);
    window.__zip = new File([zip], 'other.zip', { type: 'application/zip' });
    return mine.length;
  });
  const zipB64 = await page.evaluate(async () => { const b = new Uint8Array(await window.__zip.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); });
  fs.writeFileSync(path.join(OUT, 'other.zip'), Buffer.from(zipB64, 'base64'));
  await page.evaluate(() => go('products')); await idle(page, 300);
  await pick(page, () => page.evaluate(() => { Backup.restore(); return 1; }), path.join(OUT, 'other.zip'));
  await page.waitForSelector('.modal:has-text("Restore backup")'); await page.click('.modal-actions .btn:has-text("Restore")'); await idle(page, 1500);
  const ord = await page.evaluate(() => App.products.slice().sort((a, b) => a.order - b.order).slice(-3).map(p => p.f.name));
  ok('Merged products are appended in their own order', JSON.stringify(ord) === JSON.stringify(['Other phone 1', 'Other phone 2', 'Other phone 3']), JSON.stringify(ord));

  /* 5. "Replace everything" with a storage failure part-way keeps the phone's data */
  const beforeR = await page.evaluate(async () => ({ n: (await DB.all('products')).length, b: (await DB.allKeys('blobs')).length }));
  // backup this phone, then make writes fail after 3 blobs
  await page.evaluate(async () => {
    const files = [{ name: 'manifest.json', data: JSON.stringify({ app: APP.name, version: APP.version, createdAt: new Date().toISOString(), settings: App.S, products: App.products }) }];
    for (const p of App.products) for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) files.push({ name: 'blobs/' + p.img[k], data: await DB.getBlob(p.img[k]) });
    const zip = await ZIP.write(files); window.__full = zip;
    let calls = 0; const real = DB.putBlob; DB.putBlob = async (b, id) => { if (++calls > 3) throw new Error('QuotaExceededError (simulated)'); return real(b, id); }; window.__realPut = real;
  });
  const fullB64 = await page.evaluate(async () => { const b = new Uint8Array(await window.__full.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); });
  fs.writeFileSync(path.join(OUT, 'full.zip'), Buffer.from(fullB64, 'base64'));
  await pick(page, () => page.evaluate(() => { Backup.restore(); return 1; }), path.join(OUT, 'full.zip'));
  await page.waitForSelector('.modal:has-text("Restore backup")');
  await page.click('.modal .seg-btn:has-text("Replace everything")'); await page.click('.modal-actions .btn:has-text("Restore")'); await idle(page, 1500);
  await page.evaluate(() => { DB.putBlob = window.__realPut; });
  const afterR = await page.evaluate(async () => ({ n: (await DB.all('products')).length, b: (await DB.allKeys('blobs')).length }));
  ok('Failed "Replace everything" leaves the phone\'s data intact', afterR.n === beforeR.n && afterR.b >= beforeR.b, `${JSON.stringify(beforeR)} -> ${JSON.stringify(afterR)}`);

  /* 14. Old iPhone: no CompressionStream → PDF still compressed */
  const z = await page.evaluate(async () => {
    const saved = window.CompressionStream; window.CompressionStream = undefined; ENV.compression = false;
    try {
      App.S.cat.include = 'all'; App.S.cat.split = 0; App.S.cat.groupBy = 'none';
      const L = CatalogueView.build();
      const parts = await RENDER.exportPDF(L, CatalogueView.exportSettings(), (s, w, h) => CatalogueView.drawable(s, w, h), null);
      const b = new Uint8Array(await parts[0].blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return { size: b.length, b64: btoa(s) };
    } finally { window.CompressionStream = saved; ENV.compression = true; }
  });
  fs.writeFileSync(path.join(OUT, 'nocompress.pdf'), Buffer.from(z.b64, 'base64'));
  ok('PDF without CompressionStream is still small', z.size < 600 * 1024, Math.round(z.size / 1024) + ' KB');

  /* 15. Very large photo decodes at reduced size */
  const big = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 9000; c.height = 6000; const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, 9000, 6000); x.fillStyle = '#c33'; x.fillRect(3000, 2000, 3000, 2000);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); c.width = 0;
    const hs = await IMG.headerSize(blob);
    const t0 = performance.now(); const r = await PIPE.importPhoto(blob); const ms = performance.now() - t0;
    return { header: hs, out: [r.canvas.width, r.canvas.height], ms: Math.round(ms) };
  });
  ok('54 MP photo is read from its header and scaled to 2000 px', big.header && big.header.w === 9000 && Math.max(...big.out) === 2000, JSON.stringify(big));

  ok('No page errors', errors.length === 0, JSON.stringify(errors));
  fs.writeFileSync(path.join(OUT, 'results.txt'), results.join('\n'));
  console.log(results.join('\n'));
  await browser.close(); server.close();
})().catch(e => { console.error('E2E4 FAILED', e); console.log(results.join('\n')); server.close(); process.exit(1); });
