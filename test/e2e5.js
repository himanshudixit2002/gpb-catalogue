// One working copy at a time: newest copy works silently, older copies pause with "Use here".
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const APP = process.env.APP_FILE || path.join(__dirname, '..', 'build', 'catalogue-maker.html');
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(APP)); }).listen(0);
const URL_ = `http://localhost:${server.address().port}/`;
const results = []; const ok = (n, p, i) => results.push((p ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
const state = (pg) => pg.evaluate(() => ({
  paused: !!document.querySelector('.paused'),
  active: Presence.active,
  warnToast: Array.from(document.querySelectorAll('.toast')).some(t => /another tab|another window/i.test(t.textContent)),
  inertMain: !!(document.querySelector('#main') && document.querySelector('#main').inert)
}));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  const open = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL_); await p.waitForTimeout(900); return p; };
  const A = await open();
  let a = await state(A);
  ok('First copy works, no warning', !a.paused && a.active && !a.warnToast, JSON.stringify(a));
  const B = await open();
  await A.waitForTimeout(400);
  a = await state(A); let b = await state(B);
  ok('Newly opened copy works with no warning', !b.paused && b.active && !b.warnToast, JSON.stringify(b));
  ok('Older copy pauses with "Use here" and blocks its screen', a.paused && !a.active && a.inertMain && !a.warnToast, JSON.stringify(a));
  await A.screenshot({ path: path.join(__dirname, 'e2e5-paused.png') });
  // data typed in B is visible in A after taking over
  await B.evaluate(async () => { const p = App.newProduct(); p.f.name = 'Made in tab B'; p.draft = false; await App.saveProduct(p); });
  await A.click('.paused .btn:has-text("Use here")'); await A.waitForTimeout(500);
  a = await state(A); b = await state(B);
  ok('"Use here" swaps which copy works', !a.paused && a.active && b.paused && !b.active, `A=${JSON.stringify(a)} B=${JSON.stringify(b)}`);
  const seen = await A.evaluate(() => App.products.some(p => p.f.name === 'Made in tab B'));
  ok('Work done in the other copy shows up after taking over', seen);
  await A.close(); await B.waitForTimeout(700);
  b = await state(B);
  ok('Paused copy resumes by itself when the working copy closes', !b.paused && b.active, JSON.stringify(b));
  // reload keeps a single working copy
  await B.reload(); await B.waitForTimeout(900);
  b = await state(B);
  ok('Reloading keeps it working, no warning', !b.paused && b.active && !b.warnToast, JSON.stringify(b));
  ok('No page errors', errors.length === 0, JSON.stringify(errors));
  console.log(results.join('\n'));
  await browser.close(); server.close();
})().catch(e => { console.error(e); console.log(results.join('\n')); server.close(); process.exit(1); });
