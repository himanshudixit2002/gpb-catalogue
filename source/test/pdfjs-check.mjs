import { getDocument } from '/home/claude/.npm-global/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const files = process.argv.slice(2);
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(f));
  const warnings = [];
  const doc = await getDocument({ data, verbosity: 0, isEvalSupported: false, useSystemFonts: false }).promise;
  let chars = 0, ops = 0, imgs = 0, links = 0, sample = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const txt = tc.items.map(it => it.str).join(' ');
    chars += txt.length; if (i === 2) sample = txt.slice(0, 160);
    const ol = await page.getOperatorList();
    ops += ol.fnArray.length;
    imgs += ol.fnArray.filter(fn => fn === 85 || fn === 86).length;
    const ann = await page.getAnnotations(); links += ann.filter(a => a.subtype === 'Link').length;
  }
  const outline = await doc.getOutline();
  const meta = await doc.getMetadata();
  console.log(f.split('/').pop(), '| pages', doc.numPages, '| text chars', chars, '| ops', ops, '| images', imgs, '| links', links, '| bookmarks', outline ? outline.length : 0, '| title', meta.info.Title);
  console.log('   sample p2:', sample);
}
