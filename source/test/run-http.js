// node run-http.js <page.html> <outDir>  (serves test dir over http so fetch() works)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.csv': 'text/csv', '.zip': 'application/zip' };
(async () => {
  const [, , pageName, outDir] = process.argv;
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
  }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.goto(`http://localhost:${port}/${pageName}`);
  const t0 = Date.now();
  const res = await page.evaluate(async () => { try { return await window.runTest(); } catch (e) { return { error: e.message, stack: e.stack }; } });
  fs.mkdirSync(outDir, { recursive: true });
  const dump = (obj, prefix) => {
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (typeof v === 'string' && v.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200))) {
        const ext = v.startsWith('JVBER') ? '.pdf' : v.startsWith('iVBOR') ? '.png' : '.jpg';
        fs.writeFileSync(path.join(outDir, prefix + k + ext), Buffer.from(v, 'base64')); obj[k] = '[saved ' + prefix + k + ext + ']';
      } else if (v && typeof v === 'object') dump(v, prefix + k + '-');
    }
  };
  dump(res, '');
  res.logs = logs; res.totalMs = Date.now() - t0;
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 1).slice(0, 6000));
  await browser.close(); server.close();
})();
