// Generic Playwright runner: node run.js <html> <outJson> [pdfOut]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [, , html, outJson, pdfOut] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + html);
  const res = await page.evaluate(async () => { try { return await window.runTest(); } catch (e) { return { error: e.message, stack: e.stack }; } });
  if (res && res.pdf && pdfOut) { fs.writeFileSync(pdfOut, Buffer.from(res.pdf, 'base64')); delete res.pdf; }
  res.logs = logs;
  fs.writeFileSync(outJson, JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2).slice(0, 4000));
  await browser.close();
})();
