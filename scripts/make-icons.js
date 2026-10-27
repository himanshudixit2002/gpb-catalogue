// Draws the app icons (price tag with ₹) into site/icons/. Run once when the design changes:
//   node scripts/make-icons.js      (needs Playwright; the PNGs are committed)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site', 'icons'); fs.mkdirSync(OUT, { recursive: true });
const FONT = fs.readFileSync(path.join(ROOT, 'fonts', 'poppins-700.ttf')).toString('base64');
const NAVY = '#1D2340', TAG = '#FFC93C';

// tag in a 116 × 92 box: point on the left, hole, ₹ on the right part
function tag(cx, cy, width, { hole = true } = {}) {
  const s = width / 116, x0 = cx - 58 * s, y0 = cy - 46 * s;
  return `<g transform="translate(${x0} ${y0}) scale(${s})">
    <path d="M26 0H110a6 6 0 0 1 6 6V86a6 6 0 0 1-6 6H26L0 46Z" fill="${TAG}"/>
    ${hole ? `<circle cx="25" cy="46" r="7.5" fill="${NAVY}"/>` : ''}
    <text x="72" y="50" text-anchor="middle" dominant-baseline="middle" font-family="CM" font-weight="700" font-size="58" fill="${NAVY}">₹</text>
  </g>`;
}
const glyph = (d, size) => `<g transform="translate(${size * 0.24} ${size * 0.24}) scale(${size * 0.52 / 24})" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
const svgs = {
  'icon-512.png': [512, `<rect width="512" height="512" rx="112" fill="${NAVY}"/>${tag(256, 256, 330)}`],
  'icon-192.png': [192, `<rect width="192" height="192" rx="42" fill="${NAVY}"/>${tag(96, 96, 124)}`],
  'maskable-512.png': [512, `<rect width="512" height="512" fill="${NAVY}"/>${tag(256, 256, 272)}`],
  'maskable-192.png': [192, `<rect width="192" height="192" fill="${NAVY}"/>${tag(96, 96, 102)}`],
  'apple-touch-icon.png': [180, `<rect width="180" height="180" fill="${NAVY}"/>${tag(90, 90, 118)}`],
  'favicon-48.png': [48, `<rect width="48" height="48" rx="11" fill="${NAVY}"/>${tag(24, 24, 36, { hole: false })}`],
  'favicon-32.png': [32, `<rect width="32" height="32" rx="7" fill="${NAVY}"/>${tag(16, 16, 26, { hole: false })}`],
  'shortcut-add.png': [96, `<circle cx="48" cy="48" r="48" fill="${TAG}"/>${glyph('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>', 96)}`],
  'shortcut-catalogue.png': [96, `<circle cx="48" cy="48" r="48" fill="${TAG}"/>${glyph('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>', 96)}`]
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, [size, body]] of Object.entries(svgs)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><style>@font-face{font-family:CM;src:url(data:font/ttf;base64,${FONT})}html,body{margin:0;background:transparent}svg{display:block}</style>
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
    console.log('icon', name);
  }
  await browser.close();
})();
