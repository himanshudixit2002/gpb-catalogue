const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'build');
const types = { '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/img/') ? path.join(__dirname, u) : path.join(ROOT, 'catalogue-maker.html');
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/html' }); res.end(d); });
}).listen(0);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${server.address().port}/`); await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const run = async (rate) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    return p.evaluate(async () => {
      const files = ['box-showroom.jpg', 'bottle-wall.jpg', 'pan-wood.jpg'], per = [];
      for (const f of files) {
        const blob = await (await fetch('/img/' + f)).blob();
        const t0 = performance.now();
        const r = await PIPE.autoProcess(blob, App.S);
        const t1 = performance.now();
        const p = App.newProduct(); p.edit = r.edit; p.f = { name: f, brand: 'Test', mrp: '999' };
        await PIPE.store(p, { srcBlob: r.srcBlob, srcW: r.srcW, srcH: r.srcH, mask: r.mask, out: r.out }, true);
        const t2 = performance.now();
        await App.saveProduct(p);
        per.push({ f, process: Math.round(t1 - t0), store: Math.round(t2 - t1) });
      }
      // 40-product PDF
      const base = App.products.slice(-3);
      for (let i = 0; i < 37; i++) { const s = base[i % 3]; const q = JSON.parse(JSON.stringify(s)); q.id = 'tq' + Date.now() + i; App.products.push(q); App.byId.set(q.id, q); }
      Object.assign(App.S.cat, { include: 'all', perPage: 6, quality: 'standard', split: 0 });
      const t3 = performance.now();
      const L = CatalogueView.build();
      const parts = await RENDER.exportPDF(L, CatalogueView.exportSettings(), (src, w, h) => CatalogueView.drawable(src, w, h), null);
      const pdfMs = Math.round(performance.now() - t3);
      App.products = App.products.filter(x => !String(x.id).startsWith('tq')); 
      return { per, pdf40: { ms: pdfMs, pages: L.pages.length, kb: Math.round(parts[0].blob.size / 1024) } };
    });
  };
  console.log('no throttle', JSON.stringify(await run(1)));
  console.log('4x throttle', JSON.stringify(await run(4)));
  await b.close(); server.close();
})();
