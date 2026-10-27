// End-to-end test of the built app on a phone-sized touch browser.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build'), IMGS = path.join(__dirname, 'img'), OUT = path.join(__dirname, 'e2e');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/catalogue-maker.html'));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); });
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/catalogue-maker.html`;
const log = [];
let shot = 0;
async function snap(page, name) { const f = path.join(OUT, String(++shot).padStart(2, '0') + '-' + name + '.png'); await page.screenshot({ path: f }); log.push('shot ' + path.basename(f)); }
async function pick(page, trigger, files) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), trigger()]);
  await fc.setFiles(files);
}
async function idle(page, ms = 400) { await page.waitForTimeout(ms); }
async function waitNotBusy(page, timeout = 60000) { await page.waitForFunction(() => !document.querySelector('#ed-busy.on'), null, { timeout }); }
(async () => {
  const userDir = path.join(OUT, 'profile');
  const ctx = await chromium.launchPersistentContext(userDir, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
  await page.goto(URL_); await idle(page, 900);
  await snap(page, 'onboarding');

  // --- settings: business + logo
  await page.click('button[aria-label="Settings"]'); await idle(page);
  const fill = async (label, v) => { const loc = page.locator('label.field', { hasText: label }).locator('input').first(); await loc.fill(v); };
  await fill('Shop or company name', 'Sharma Traders');
  await fill('One line about you', 'Kitchenware & home essentials since 1987');
  await fill('Phone', '+91 98765 43210');
  await fill('WhatsApp number', '9876543210');
  await fill('Website', 'sharmatraders.in');
  await fill('Address', '12, Station Road, Jaipur 302006');
  await pick(page, () => page.click('text=Add logo'), path.join(IMGS, 'logo.jpg'));
  await page.waitForSelector('.lp.light img'); await idle(page, 500);
  await snap(page, 'settings-logo');
  await page.locator('.lp').first().scrollIntoViewIfNeeded();
  await snap(page, 'settings-logo-view');

  // --- add a product from the camera (showroom box)
  await page.click('.nav-btn[data-view=products]'); await idle(page);
  await page.click('.snap'); await idle(page, 300);
  await snap(page, 'add-sheet');
  await pick(page, () => page.click('.sheet-item:has-text("Take photo")'), path.join(IMGS, 'box-showroom.jpg'));
  await page.waitForSelector('.editor'); await waitNotBusy(page); await idle(page, 600);
  await snap(page, 'editor-frame-auto');
  // drag the bottom-left handle to the true corner (480,930 of 1600x1200)
  const geo = await page.evaluate(() => { const st = Editor.st, v = document.querySelector('#ed-view').getBoundingClientRect(); return { left: v.left, top: v.top, w: st.disp.w, h: st.disp.h, quad: st.edit.quad }; });
  const target = [[520, 180], [1090, 250], [1060, 1010], [480, 930]].map(([x, y]) => ({ x: geo.left + x / 1600 * geo.w, y: geo.top + y / 1200 * geo.h }));
  for (let i = 0; i < 4; i++) {
    const from = { x: geo.left + geo.quad[i].x * geo.w, y: geo.top + geo.quad[i].y * geo.h };
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    const steps = 8;
    for (let s = 1; s <= steps; s++) await page.mouse.move(from.x + (target[i].x - from.x) * s / steps, from.y + (target[i].y - from.y) * s / steps);
    if (i === 3) await snap(page, 'editor-drag-loupe');
    await page.mouse.up(); await idle(page, 150);
  }
  await snap(page, 'editor-frame-manual');
  const quadAfter = await page.evaluate(() => Editor.st.edit.quad.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]));
  log.push('quad after drag ' + JSON.stringify(quadAfter));
  await page.click('.tray-next .btn:has-text("Next: cut-out")'); await idle(page, 200); await waitNotBusy(page); await idle(page, 400);
  await snap(page, 'editor-cutout');
  // brush: erase a stroke then undo
  await page.click('.seg-btn:has-text("Erase")');
  const v2 = await page.evaluate(() => { const r = document.querySelector('#ed-view').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(v2.l + v2.w * 0.45, v2.t + v2.h * 0.45); await page.mouse.down();
  await page.mouse.move(v2.l + v2.w * 0.55, v2.t + v2.h * 0.5, { steps: 6 }); await page.mouse.up(); await idle(page, 200);
  await snap(page, 'editor-brush-erase');
  await page.click('.tool:has-text("Undo")'); await idle(page, 200);
  await page.click('.seg-btn:has-text("Off")');
  await page.click('.tray-next .btn:has-text("Next: look")'); await idle(page, 200); await waitNotBusy(page); await idle(page, 700);
  await snap(page, 'editor-look');
  await page.click('.tray-next .btn:has-text("Next: details")'); await idle(page, 600);
  const typeField = async (key, v) => { await page.fill('#fld-' + key, v); };
  await typeField('brand', 'Prestige'); await typeField('size', '5 L'); await typeField('name', 'Svachh Deluxe Pressure Cooker'); await typeField('mrp', '2499'); await typeField('product', 'Cooker');
  await page.click('.chip.small:has-text("New")'); await idle(page, 700);
  await snap(page, 'editor-details');
  await page.click('.tray-next .btn:has-text("Save"):not(:has-text("next"))'); await idle(page, 1500);
  await snap(page, 'products-1');

  // --- batch: three photos at once
  await page.click('.snap'); await idle(page, 300);
  await pick(page, () => page.click('.sheet-item:has-text("Choose photos")'), ['bottle-wall.jpg', 'pan-wood.jpg', 'coffee.jpg'].map(f => path.join(IMGS, f)));
  await page.waitForFunction(() => !Batch.running && App.products.length >= 4, null, { timeout: 120000 }); await idle(page, 1200);
  await snap(page, 'products-batch');
  // fill details for batch products via evaluate (fast), then open one in the editor to check flow
  await page.evaluate(async () => {
    const det = [{ brand: 'Vatika', size: '500 ml', name: 'Amla Hair Oil', mrp: '245.50', product: 'Hair care' }, { brand: 'Hawkins', size: '28 cm', name: 'Futura Non-stick Tawa with induction base', mrp: '1850', product: 'Tawa', badge: '15% off' }, { brand: '', size: '90 ml', name: 'Espresso Cup & Saucer', mrp: '', product: 'Crockery' }];
    const batch = App.products.filter(p => !p.f.name).sort((a, b) => a.createdAt - b.createdAt);
    batch.forEach((p, i) => { Object.assign(p.f, det[i % 3]); p.review = false; });
    for (const p of batch) await App.saveProduct(p);
  });
  await idle(page, 600);
  await snap(page, 'products-filled');
  // open the bottle product in the editor (existing product → Look step)
  await page.click('.tile:has-text("Amla Hair Oil")'); await page.waitForSelector('.editor'); await waitNotBusy(page); await idle(page, 900);
  await snap(page, 'editor-existing-look');
  await page.click('.ed-step[data-step=frame]'); await idle(page, 500);
  await snap(page, 'editor-existing-frame');
  await page.click('button[aria-label="Close editor"]'); await idle(page, 600);
  if (await page.locator('.modal').count()) { await page.click('.modal-actions .btn:has-text("Leave")'); await idle(page, 400); }

  // --- duplicate products to make a bigger catalogue (simulate 40 products)
  await page.evaluate(async () => { const base = App.products.slice(); for (let r = 0; r < 9; r++) for (const p of base) await App.duplicateProduct(p); });
  await idle(page, 800);
  log.push('products: ' + await page.evaluate(() => App.products.length));
  await snap(page, 'products-many');

  // --- catalogue
  await page.click('.nav-btn[data-view=catalogue]'); await idle(page, 1800);
  await snap(page, 'catalogue');
  await page.click('.pp:has-text("4")'); await idle(page, 1500);
  await snap(page, 'catalogue-4pp');
  await page.locator('.perpage').scrollIntoViewIfNeeded(); await snap(page, 'catalogue-controls');
  await page.click('.sw:has-text("Midnight")'); await idle(page, 1500);
  await page.evaluate(() => document.querySelector('#pv-strip').scrollIntoView()); await snap(page, 'catalogue-midnight');
  await page.click('.sw:has-text("Classic")'); await page.click('.pp:has-text("6")'); await idle(page, 1200);
  // create PDF
  await page.click('.cta .btn:has-text("Create PDF")');
  await page.waitForSelector('.modal:has-text("PDF created")', { timeout: 180000 }); await idle(page, 300);
  await snap(page, 'pdf-result');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.res-file button[aria-label^="Download"]')]);
  await dl.saveAs(path.join(OUT, 'catalogue.pdf'));
  log.push('pdf ' + dl.suggestedFilename());
  await page.click('.modal-head button[aria-label="Close"]'); await idle(page, 300);

  // --- reload: autosave check
  await page.reload(); await idle(page, 1500);
  const after = await page.evaluate(() => ({ n: App.products.length, biz: App.S.biz.name, logo: !!App.logo, perPage: App.S.cat.perPage }));
  log.push('after reload ' + JSON.stringify(after));
  await snap(page, 'after-reload');

  // --- backup
  await page.click('button[aria-label="More"]'); await idle(page, 300);
  await page.click('.sheet-item:has-text("Back up everything")');
  await page.waitForSelector('.modal:has-text("Backup ready")', { timeout: 120000 });
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('.modal-actions .btn:has-text("Download")')]);
  await bk.saveAs(path.join(OUT, 'backup.zip')); log.push('backup ' + bk.suggestedFilename());
  await page.keyboard.press('Escape'); await idle(page, 300);

  // --- desktop layout screenshot
  await page.setViewportSize({ width: 1280, height: 800 }); await idle(page, 600);
  await page.click('.nav-btn[data-view=catalogue]'); await idle(page, 1800);
  await snap(page, 'desktop-catalogue');
  await page.click('.nav-btn[data-view=products]'); await idle(page, 800);
  await snap(page, 'desktop-products');

  log.push('errors: ' + JSON.stringify(errors, null, 1));
  const diag = await page.evaluate(() => LOG.text());
  fs.writeFileSync(path.join(OUT, 'applog.txt'), diag);
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  console.log(log.join('\n'));
  await ctx.close(); server.close();
})().catch(e => { console.error('E2E FAILED', e); fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\nFAILED ' + e.stack); server.close(); process.exit(1); });
