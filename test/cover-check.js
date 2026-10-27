// Renders covers with "Prepared for" and "Prices valid until" (portrait and landscape) to PDF for a visual check.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'build', 'catalogue-maker.html'), OUT = path.join(__dirname, 'cover-check');
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(APP)); }).listen(0);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/`); await page.waitForTimeout(900);
  for (const orient of ['portrait', 'landscape']) {
    const r = await page.evaluate(async (orient) => {
      const S = { biz: { name: 'GPB Group', tagline: 'Kitchenware and home essentials', phone: '+91 98765 43210', whatsapp: '9876543210', website: 'gpbgroup.co.in', address: 'Jaipur, Rajasthan' }, fields: App.S.fields,
        cat: Object.assign({}, App.S.cat, { orient, title: 'Diwali Price List', subtitle: 'Cookware and kitchen tools', forWho: 'Sharma Electricals, Malviya Nagar', validTill: '2026-11-30', cover: true, contents: false, dividers: false, perPage: 4 }) };
      const prods = [1, 2, 3, 4].map(i => ({ id: 'p' + i, order: i, f: { brand: 'Prestige', name: 'Item ' + i, mrp: String(999 * i) }, img: {} }));
      const L = LAYOUT.build([{ name: '', items: prods }], S, null);
      const texts = L.pages.flatMap(p => p.ops.filter(o => o.t === 'text').map(o => o.str));
      const parts = await RENDER.exportPDF(L, S, async () => null, null);
      const b = new Uint8Array(await parts[0].blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return { name: parts[0].name, b64: btoa(s), hasFor: texts.includes('PREPARED FOR') && texts.some(t => /Sharma Electricals/.test(t)), validCover: texts.some(t => /Prices valid until 30 Nov 2026$/.test(t)), validFoot: texts.some(t => /Prices valid until 30 Nov 2026\./.test(t)) };
    }, orient);
    fs.writeFileSync(path.join(OUT, orient + '.pdf'), Buffer.from(r.b64, 'base64'));
    console.log(orient, JSON.stringify({ file: r.name, hasFor: r.hasFor, validCover: r.validCover, validFoot: r.validFoot }));
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close(); server.close();
})();
