const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build');
const server = http.createServer((req, res) => { fs.readFile(path.join(ROOT, 'catalogue-maker.html'), (e, d) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); }); }).listen(0);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${server.address().port}/`); await p.waitForTimeout(800);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { Add.photo(); return 1; })]);
  await fc.setFiles(path.join(__dirname, 'img', 'box-showroom.jpg'));
  await p.waitForSelector('.editor'); await p.waitForFunction(() => !document.querySelector('#ed-busy.on')); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, 'desk-editor-frame.png') });
  await p.click('.ed-step[data-step=details]'); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(__dirname, 'desk-editor-details.png') });
  console.log('errors', JSON.stringify(errs)); await b.close(); server.close();
})();
