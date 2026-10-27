const toB64 = async (blob) => { const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
window.runTest = async function () {
  await Fonts.init();
  const settings = { photo: { bg: 'quick', aiQuality: 'fast' } };
  const files = ['box-showroom.jpg', 'bottle-wall.jpg', 'pan-wood.jpg', 'coffee.jpg'];
  const res = { items: [] };
  const products = [];
  const outs = {};
  for (const f of files) {
    const blob = await (await fetch('img/' + f)).blob();
    const t0 = performance.now();
    const r = await PIPE.autoProcess(blob, settings);
    const ms = Math.round(performance.now() - t0);
    const png = await IMG.toBlob(r.out, 'image/png');
    // preview of cut-out over a checker for inspection
    const c = IMG.canvas(r.out.width, r.out.height), x = c.getContext('2d');
    for (let yy = 0; yy < c.height; yy += 24) for (let xx = 0; xx < c.width; xx += 24) { x.fillStyle = ((xx + yy) / 24) % 2 ? '#d9d9d9' : '#ffffff'; x.fillRect(xx, yy, 24, 24); }
    x.drawImage(r.out, 0, 0);
    const prev = await IMG.toBlob(c, 'image/jpeg', 0.85);
    res.items.push({ f, ms, quad: r.edit.quad.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]), persp: r.edit.persp, out: [r.out.width, r.out.height], q: r.quality, preview: await toB64(prev) });
    const id = 'p' + products.length;
    outs[id] = r.out;
    products.push({ id, img: { out: 'x', ow: r.out.width, oh: r.out.height }, f: {} });
  }
  // manual quad for the box (true corners) – perspective straighten test
  {
    const blob = await (await fetch('img/box-showroom.jpg')).blob();
    const { canvas } = await PIPE.importPhoto(blob);
    const W = 1600, H = 1200;
    const quad = [[520, 180], [1090, 250], [1060, 1010], [480, 930]].map(([a, b]) => ({ x: a / W, y: b / H }));
    const edit = PIPE.defaultEdit(settings); edit.quad = quad; edit.persp = true;
    const t0 = performance.now();
    const mask = await PIPE.mask(canvas, 'quick', quad, 35, null);
    const sd = IMG.data(canvas);
    const ap = PIPE.autoParamsFor(sd, mask);
    const out = PIPE.render(canvas, sd, mask, edit, ap);
    res.manualMs = Math.round(performance.now() - t0);
    const outNoBg = PIPE.render(canvas, sd, null, edit, ap);
    res.manualBox = await toB64(await IMG.toBlob(out, 'image/png'));
    res.manualBoxNoBg = await toB64(await IMG.toBlob(outNoBg, 'image/jpeg', 0.9));
    outs.pbox = out; products.unshift({ id: 'pbox', img: { out: 'x', ow: out.width, oh: out.height }, f: {} });
  }
  // logo
  const logoBlob = await (await fetch('img/logo.jpg')).blob();
  const logo = await IMG.processLogo(logoBlob);
  const logoImg = await IMG.decode(logo.blob);
  res.logo = { w: logo.w, h: logo.h, removed: logo.removed, png: await toB64(logo.blob) };
  // product details
  const det = [
    { brand: 'Prestige', size: '5 L', name: 'Svachh Deluxe Pressure Cooker', mrp: '2499', product: 'Cooker', badge: 'New' },
    { brand: 'Prestige', size: '', name: 'Svachh Pressure Cooker', mrp: '2,199', product: '' },
    { brand: 'Vatika', size: '500 ml', name: 'Amla Hair Oil', mrp: '245.50', product: 'Hair care' },
    { brand: 'Hawkins', size: '28 cm', name: 'Futura Non-stick Tawa with a long handle and induction base', mrp: '1850', product: 'Tawa', badge: '15% off' },
    { brand: '', size: '90 ml', name: 'Espresso Cup & Saucer', mrp: '', product: 'Crockery' },
  ];
  products.forEach((p, i) => { p.f = Object.assign({}, det[i % det.length]); });
  const fields = [
    { key: 'brand', label: 'Brand', on: true, showLabel: false, style: 'brand' },
    { key: 'size', label: 'Size', on: true, showLabel: true, style: 'meta' },
    { key: 'name', label: 'Name', on: true, showLabel: false, style: 'title' },
    { key: 'mrp', label: 'MRP', on: true, showLabel: true, style: 'price' },
    { key: 'product', label: 'Product', on: true, showLabel: false, style: 'meta' }
  ];
  const biz = { name: 'Sharma Traders', tagline: 'Kitchenware & home essentials since 1987', phone: '+91 98765 43210', whatsapp: '9876543210', email: 'sales@sharmatraders.in', website: 'sharmatraders.in', address: '12, Station Road, Jaipur 302006' };
  const many = [];
  for (let i = 0; i < 23; i++) { const p = products[i % products.length]; many.push(Object.assign({}, p, { id: p.id + '_' + i, srcId: p.id, f: Object.assign({}, p.f) })); }
  const getFull = async (src) => src === 'logo' ? logoImg : outs[(src.id || '').split('_')[0]] || null;
  res.pdfs = {};
  const variants = [
    { key: 'p6-classic', cat: { perPage: 6, theme: 'classic' } },
    { key: 'p1-ivory-serif', cat: { perPage: 1, theme: 'ivory', font: 'serif' } },
    { key: 'p10-midnight', cat: { perPage: 10, theme: 'midnight' } },
    { key: 'p4-grouped', cat: { perPage: 4, theme: 'emerald', groupBy: 'brand', index: true } },
    { key: 'p3-festive', cat: { perPage: 3, theme: 'festive', card: 'outline' } },
  ];
  for (const v of variants) {
    const cat = Object.assign({ title: 'Kitchen & Home Catalogue', subtitle: 'Festive Collection 2026', page: 'A4', orient: 'portrait', perPage: 6, theme: 'classic', card: 'soft', shadow: true, cover: true, qr: true, waLinks: true, note: 'Prices are MRP, inclusive of all taxes.', quality: 'standard' }, v.cat);
    const S = { cat, biz, fields };
    let groups;
    if (cat.groupBy === 'brand') {
      const m = new Map(); for (const p of many) { const k = p.f.brand || 'Other'; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
      groups = Array.from(m, ([name, items]) => ({ name, items }));
    } else groups = [{ name: null, items: many }];
    const t0 = performance.now();
    const L = LAYOUT.build(groups, S, { w: logo.w, h: logo.h });
    const tl = performance.now();
    const parts = await RENDER.exportPDF(L, S, getFull, null);
    res.pdfs[v.key] = { pages: L.pages.length, grid: { rows: L.grid.rows, cols: L.grid.cols, rowCounts: L.grid.rowCounts, s: +L.grid.s.toFixed(2) }, layoutMs: Math.round(tl - t0), pdfMs: Math.round(performance.now() - tl), size: parts[0].blob.size, b64: await toB64(parts[0].blob) };
    // preview canvas render of page 2 for comparison
    const pg = L.pages[Math.min(1, L.pages.length - 1)], sc = 1.2, c = IMG.canvas(pg.w * sc, pg.h * sc);
    await RENDER.drawPage(c.getContext('2d'), pg, sc, getFull);
    res.pdfs[v.key].preview = await toB64(await IMG.toBlob(c, 'image/png'));
  }
  return res;
};
