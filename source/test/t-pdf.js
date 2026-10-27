window.runTest = async function () {
  await Fonts.init();
  const out = {};
  const sans = Fonts.face('sans', 'regular'), bold = Fonts.face('sans', 'bold'), serifB = Fonts.face('serif', 'bold');
  out.upem = sans.upem; out.glyphs = sans.numGlyphs; out.rupeeGid = sans.gid(0x20B9);
  out.widthHello = sans.width('Hello ₹1,299', 12);
  // kerning check vs fontTools reference (Lora Bold)
  const pairs = ['AV', 'AT', 'AY', 'Ao', 'Ay', 'AA', 'To', 'Ty', 'Yo', 'LT', 'Wa', 'Fo', 'P.', 'r.', 'y,'];
  out.kern = {};
  for (const p of pairs) out.kern[p] = serifB.kern(serifB.gid(p.charCodeAt(0)), serifB.gid(p.charCodeAt(1)));
  // make a PDF
  const doc = new PDFWriter({ title: 'Test – ₹ catalogue', author: 'QA' });
  doc.reservePages(2);
  const pg = doc.page(595.28, 841.89);
  pg.rect(0, 0, 595.28, 841.89, { fill: '#FBF8F1' });
  pg.rect(40, 40, 515, 120, { fill: '#FFFFFF', stroke: '#E5DCC8', lw: 0.8, r: 14 });
  pg.text(bold, 28, 60, 100, 'PRESTIGE Svachh ₹2,499', { color: '#1B1B1F' });
  pg.text(sans, 12, 60, 130, 'Size 1.5 L · Pressure Cooker – “quoted” ½ ×', { color: '#6B6B76', tracking: 0.05 });
  pg.text(serifB, 30, 60, 220, 'AVATAR Typography Wave', { color: '#A47A1E' });
  pg.circle(500, 300, 40, { fill: '#C2410C', alpha: 0.35 });
  pg.line(40, 250, 555, 250, '#C2410C', 1.2);
  // RGBA image with alpha: gradient disc
  const W = 200, H = 160, rgb = new Uint8Array(W * H * 3), a = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = Math.hypot(x - W / 2, y - H / 2);
    rgb[i * 3] = 30 + x; rgb[i * 3 + 1] = 90 + y / 2; rgb[i * 3 + 2] = 200;
    a[i] = d < 60 ? 255 : d < 70 ? Math.round(255 * (70 - d) / 10) : 0;
  }
  const im = await doc.addRGB(rgb, W, H, a);
  pg.image(im, 60, 300, 200, 160);
  // JPEG via canvas
  const c = document.createElement('canvas'); c.width = 300; c.height = 200; const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 300, 200); g.addColorStop(0, '#0F7B53'); g.addColorStop(1, '#F5B942'); ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 200);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('JPEG', 90, 115);
  const jb = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))).arrayBuffer());
  const jim = await doc.addJPEG(jb, 300, 200, null);
  pg.image(jim, 300, 320, 240, 160, { clipR: 16 });
  pg.link(60, 300, 200, 160, 'https://wa.me/919999999999?text=' + encodeURIComponent('Hi, I want ₹ item'));
  pg.goto(300, 320, 240, 160, 1);
  await pg.end();
  const p2 = doc.page(595.28, 841.89);
  p2.text(sans, 14, 40, 60, 'Page two — internal link target', {});
  await p2.end();
  doc.addBookmark('First page', 0); doc.addBookmark('Second – ₹', 1);
  const blob = await doc.finish();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  out.pdf = btoa(bin); out.size = buf.length;
  return out;
};
