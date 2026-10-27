/* ===================== 08 · Catalogue layout engine (one page model → preview & PDF) ===================== */
const THEMES = {
  classic:  { name: 'Classic',  page: '#FFFFFF', card: '#F6F5F1', ink: '#17171C', muted: '#6A6A73', accent: '#C2410C', rule: '#E6E3DC', line: '#E9E6DF', dark: false },
  ivory:    { name: 'Ivory & Gold', page: '#FBF7EE', card: '#FFFFFF', ink: '#2A2418', muted: '#7C705B', accent: '#9E7417', rule: '#E8DCC2', line: '#EADFC8', dark: false },
  midnight: { name: 'Midnight', page: '#111218', card: '#1B1D26', ink: '#F4F2EC', muted: '#A3A6B4', accent: '#F2B53D', rule: '#2A2D3A', line: '#2C2F3C', dark: true },
  emerald:  { name: 'Emerald',  page: '#FFFFFF', card: '#EEF5F0', ink: '#0E2A1F', muted: '#56725F', accent: '#0F7B53', rule: '#D7E6DD', line: '#D7E6DD', dark: false },
  royal:    { name: 'Royal',    page: '#FFFFFF', card: '#F0F3FB', ink: '#0D1A3A', muted: '#5A6688', accent: '#1F4FD8', rule: '#DCE3F3', line: '#DCE3F3', dark: false },
  festive:  { name: 'Festive',  page: '#FFF8F2', card: '#FFFFFF', ink: '#3A0C12', muted: '#875A5F', accent: '#B0123A', rule: '#F1DCD3', line: '#F1DCD3', dark: false },
  mono:     { name: 'Mono',     page: '#FFFFFF', card: '#FFFFFF', ink: '#111111', muted: '#6B6B6B', accent: '#111111', rule: '#DDDDDD', line: '#E2E2E2', dark: false }
};
const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28] };

const LAYOUT = (() => {
  const lum = hex => { const m = /^#?(..)(..)(..)$/.exec(hex) || [0, 'ff', 'ff', 'ff']; const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onColor = hex => lum(hex) > 0.42 ? '#111111' : '#FFFFFF';
  let _rc = null;
  const rasterMeasure = (str, size, wt) => {
    if (!_rc) _rc = document.createElement('canvas').getContext('2d');
    _rc.font = `${wt === 'bold' ? 700 : wt === 'medium' ? 500 : 400} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif`;
    return _rc.measureText(str).width;
  };
  function theme(cat) {
    const t = Object.assign({}, THEMES[cat.theme] || THEMES.classic);
    if (cat.accent && /^#[0-9a-f]{6}$/i.test(cat.accent)) t.accent = cat.accent;
    t.onAccent = onColor(t.accent);
    return t;
  }
  /** Measure + build a single text op. */
  function line(str, fam, wt, s, color, tracking = 0) {
    const face = Fonts.face(fam, wt);
    let raster = !face.covers(str);
    if (raster && fam !== 'sans' && Fonts.face('sans', wt).covers(str)) { fam = 'sans'; raster = false; }
    const w = raster ? rasterMeasure(str, s, wt) : Fonts.face(fam, wt).width(str, s, tracking);
    return { str, fam, wt, s, color, tracking, w, raster };
  }
  function measurer(fam, wt, s, tracking) {
    return (t) => { const f = Fonts.face(fam, wt); return f.covers(t) ? f.width(t, s, tracking) : rasterMeasure(t, s, wt); };
  }
  function wrapped(str, fam, wt, s, color, maxW, maxLines, tracking = 0) {
    return wrapLines(measurer(fam, wt, s, tracking), str, maxW, maxLines).map(l => line(l, fam, wt, s, color, tracking));
  }
  function textOp(l, x, baseline, align) {
    const left = align === 'center' ? x - l.w / 2 : align === 'right' ? x - l.w : x;
    return { t: 'text', x: left, y: baseline, w: l.w, str: l.str, fam: l.fam, wt: l.wt, s: l.s, color: l.color, tracking: l.tracking, raster: l.raster };
  }
  function capH(fam, wt) { const f = Fonts.face(fam, wt); return (f.capHeight || f.ascender * 0.7) / f.upem; }
  function fit(w, h, bw, bh) { const s = Math.min(bw / w, bh / h); return { w: w * s, h: h * s }; }
  function waNumber(n) { let d = String(n || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1); return d; }
  function waLink(num, text) { const n = waNumber(num); if (!n) return null; return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function fieldValue(p, key) { const v = p.f && p.f[key]; return v === undefined || v === null ? '' : String(v).trim(); }
  function enquiryText(p, S) {
    const name = fieldValue(p, 'name') || fieldValue(p, 'product') || 'this product';
    const bits = [];
    const brand = fieldValue(p, 'brand'); if (brand && name.toLowerCase().indexOf(brand.toLowerCase()) < 0) bits.push(brand);
    bits.push(name);
    const size = fieldValue(p, 'size'); if (size) bits.push('(' + size + ')');
    const mrp = fieldValue(p, 'mrp'); const price = mrp ? ' – MRP ' + fmtMoney(mrp) : '';
    const tpl = (S.cat.waMsg || 'Hi{biz}! I am interested in {item}. Please share details.');
    return tpl.replace('{biz}', S.biz.name ? ' ' + S.biz.name : '').replace('{item}', bits.join(' ') + price);
  }

  /* ---------- the text block under each product ---------- */
  function productLines(p, S, s, maxW, T, dense) {
    const out = [];
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    let metaBuf = [];
    const flushMeta = () => {
      if (!metaBuf.length) return;
      const str = metaBuf.join('  ·  ');
      wrapped(str, 'sans', 'regular', s * 0.8, T.muted, maxW, dense ? 1 : 2).forEach(l => out.push(Object.assign(l, { lh: s * 0.8 * 1.42, kind: 'meta' })));
      metaBuf = [];
    };
    for (const f of S.fields) {
      if (!f.on) continue;
      const v = fieldValue(p, f.key);
      if (!v) continue;                                   // empty fields are left out
      const label = f.showLabel && f.label ? f.label : '';
      if (f.style === 'meta' || f.style === 'custom') {
        const txt = label ? label + ': ' + v : v;
        if (dense) { metaBuf.push(txt); continue; }
        flushMeta();
        wrapped(txt, 'sans', 'regular', s * 0.8, T.muted, maxW, 2).forEach(l => out.push(Object.assign(l, { lh: s * 0.8 * 1.42, kind: 'meta' })));
        continue;
      }
      flushMeta();
      if (f.style === 'brand') {
        const txt = (label ? label + ': ' : '') + v.toUpperCase();
        // tracking kept under ~0.1em so PDF readers still find the brand name when searching
        wrapped(txt, 'sans', 'medium', s * 0.7, T.accent, maxW, 1, 0.09).forEach(l => out.push(Object.assign(l, { lh: s * 0.7 * 1.6, kind: 'brand' })));
      } else if (f.style === 'title') {
        const txt = label ? label + ': ' + v : v;
        wrapped(txt, fam, 'bold', s * (fam === 'serif' ? 1.08 : 1.0), T.ink, maxW, 2).forEach(l => out.push(Object.assign(l, { lh: s * 1.24, kind: 'title' })));
      } else if (f.style === 'price') {
        const money = fmtMoney(v);
        const txt = (label ? label + ' ' : '') + money;
        out.push(Object.assign(line(txt, 'sans', 'bold', s * 1.04, T.accent), { lh: s * 1.04 * 1.42, kind: 'price', gapBefore: s * 0.18 }));
      }
    }
    flushMeta();
    let h = 0; for (const l of out) h += l.lh + (l.gapBefore || 0);
    return { lines: out, h };
  }

  /* ---------- grid: balanced rows for 1–10 per page ---------- */
  function grid(n, W, H, gap, textEst) {
    let best = null;
    for (let rows = 1; rows <= n; rows++) {
      const cols = Math.ceil(n / rows);
      if (cols * (rows - 1) >= n && rows > 1) continue;
      const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
      const s = clamp(Math.sqrt(cw * ch) / 22, 7, 20);
      const pad = clamp(cw * 0.055, 6, 18);
      const side = Math.min(cw - pad * 2, ch - pad * 2 - textEst(s) - s * 0.4);
      const score = side - (rows * cols - n) * 0.5;
      if (!best || score > best.score + 0.5) best = { rows, cols, cw, ch, s, pad, score };
    }
    const base = Math.floor(n / best.rows), extra = n % best.rows;
    best.rowCounts = Array.from({ length: best.rows }, (_, i) => base + (i < extra ? 1 : 0));
    return best;
  }

  function header(ops, P, S, T, title, sub, hasLogo, logo) {
    const M = P.m, top = M * 0.62, HH = P.hh;
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    // logo top-right, full logo (contain), on a light plate for dark themes
    let logoW = 0;
    if (hasLogo && logo && logo.w) {
      const box = { w: Math.min(170, P.w * 0.32), h: HH - 12 };
      const f = fit(logo.w, logo.h, box.w, box.h);
      const x = P.w - M - f.w, y = top + (HH - f.h) / 2 - 2;
      if (T.dark) ops.push({ t: 'rect', x: x - 8, y: y - 6, w: f.w + 16, h: f.h + 12, r: 8, fill: '#FFFFFF' });
      ops.push({ t: 'img', src: 'logo', x, y, w: f.w, h: f.h });
      logoW = f.w + (T.dark ? 16 : 0);
    } else if (S.biz.name) {
      const l = line(S.biz.name, fam, 'bold', 13, T.ink);
      ops.push(textOp(l, P.w - M, top + HH / 2 + 4.5, 'right')); logoW = l.w;
    }
    const maxW = P.w - M * 2 - logoW - 24;
    const tl = wrapped(title || '', fam, 'bold', 15, T.ink, maxW, 1)[0];
    if (tl) ops.push(textOp(tl, M, top + HH / 2 + (sub ? 0 : 5), 'left'));
    if (sub) { const sl = wrapped(sub, 'sans', 'regular', 8.5, T.muted, maxW, 1)[0]; if (sl) ops.push(textOp(sl, M, top + HH / 2 + 13, 'left')); }
    ops.push({ t: 'rect', x: M, y: top + HH + 2, w: 34, h: 2.2, r: 1.1, fill: T.accent });
    ops.push({ t: 'line', x1: M + 40, y1: top + HH + 3.1, x2: P.w - M, y2: top + HH + 3.1, color: T.rule, lw: 0.6 });
  }
  /** "Prices valid until 30 Nov 2026" when a date is set */
  function validText(S) {
    const v = S.cat.validTill;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const d = new Date(v + 'T12:00:00');
    return isNaN(d) ? '' : 'Prices valid until ' + niceDate(d) + '.';
  }

  function footer(ops, P, S, T, pageNo, total) {
    const M = P.m, y = P.h - M * 0.55;
    const contact = [S.biz.name, S.biz.phone, S.biz.website || S.biz.email].filter(Boolean).join('   ·   ');
    ops.push({ t: 'line', x1: M, y1: y - 15, x2: P.w - M, y2: y - 15, color: T.rule, lw: 0.5 });
    if (S.cat.footContact !== false && contact) { const l = wrapped(contact, 'sans', 'regular', 7.5, T.muted, P.w * 0.62, 1)[0]; if (l) ops.push(textOp(l, M, y - 3, 'left')); }
    if (S.cat.pageNo !== false) ops.push(textOp(line(pageNo + ' / ' + total, 'sans', 'medium', 7.5, T.muted), P.w - M, y - 3, 'right'));
    const note = [S.cat.note, validText(S), S.cat.waLinks && S.biz.whatsapp ? 'Tap any product to enquire on WhatsApp.' : ''].filter(Boolean).join('  ');
    if (note) { const l = wrapped(note, 'sans', 'regular', 6.5, T.muted, P.w - M * 2, 1)[0]; if (l) ops.push(textOp(l, M, y + 7, 'left')); }
  }

  function productCard(ops, p, x, y, cw, ch, s, pad, textH, S, T, dense) {
    const style = S.cat.card || 'soft';
    const r = Math.min(14, cw * 0.05);
    if (style === 'soft') ops.push({ t: 'rect', x, y, w: cw, h: ch, r, fill: T.card });
    else if (style === 'outline') ops.push({ t: 'rect', x, y, w: cw, h: ch, r, stroke: T.line, lw: 0.8 });
    const innerW = cw - pad * 2;
    const imgBox = { x: x + pad, y: y + pad, w: innerW, h: ch - pad * 2 - textH - s * 0.45 };
    const ow = (p.img && p.img.ow) || 1, oh = (p.img && p.img.oh) || 1;
    if (p.img && p.img.out && imgBox.h > 4) {
      const f = fit(ow, oh, imgBox.w * 0.96, imgBox.h * 0.97);
      const ix = imgBox.x + (imgBox.w - f.w) / 2, iy = imgBox.y + imgBox.h - f.h;      // bottom-anchored: no gap above the text
      if (S.cat.shadow !== false) {
        const sw = f.w * 0.86, sh = Math.max(3, Math.min(f.h * 0.07, s * 1.1));
        ops.push({ t: 'shadow', x: ix + (f.w - sw) / 2, y: iy + f.h - sh * 0.55, w: sw, h: sh, alpha: T.dark ? 0.9 : 0.75 });
      }
      ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
    } else if (imgBox.h > 4) {
      ops.push({ t: 'rect', x: imgBox.x + imgBox.w * 0.2, y: imgBox.y + imgBox.h * 0.2, w: imgBox.w * 0.6, h: imgBox.h * 0.6, r: 8, stroke: T.line, lw: 0.8 });
      ops.push(textOp(line('No photo', 'sans', 'regular', s * 0.7, T.muted), x + cw / 2, imgBox.y + imgBox.h / 2 + s * 0.25, 'center'));
    }
    // badge (e.g. NEW, 20% OFF)
    const badge = fieldValue(p, 'badge');
    if (badge && S.cat.badges !== false) {
      const bl = line(badge.toUpperCase(), 'sans', 'bold', Math.max(5.5, s * 0.58), T.onAccent, 0.08);
      const bh = bl.s * 1.9, bw = bl.w + bl.s * 1.6;
      ops.push({ t: 'rect', x: x + pad * 0.7, y: y + pad * 0.7, w: bw, h: bh, r: bh / 2, fill: T.accent });
      ops.push(textOp(bl, x + pad * 0.7 + bw / 2, y + pad * 0.7 + bh / 2 + bl.s * 0.36, 'center'));
    }
    // details: centred, immediately below the image
    const block = productLines(p, S, s, innerW, T, dense);
    let ty = imgBox.y + imgBox.h + s * 0.45;
    for (const l of block.lines) {
      ty += (l.gapBefore || 0);
      const base = ty + l.lh / 2 + capH(l.fam, l.wt) * l.s / 2;
      ops.push(textOp(l, x + cw / 2, base, 'center'));
      ty += l.lh;
    }
    if (S.cat.waLinks && S.biz.whatsapp) {
      const url = waLink(S.biz.whatsapp, enquiryText(p, S));
      if (url) ops.push({ t: 'link', x, y, w: cw, h: ch, url });
    }
  }

  function coverPage(P, S, T, products, total, hasLogo, logo, sectionsCount) {
    const ops = [], M = P.m, W = P.w, H = P.h, land = W > H;
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    const sc = Math.min(1, (land ? H : W) / 595);       // A5 and small pages scale everything down
    const b = S.biz;
    const site = b.website ? (/^https?:/i.test(b.website) ? b.website : 'https://' + b.website) : '';
    const qrData = S.cat.qr !== false ? (waLink(b.whatsapp, '') || site) : '';
    const rows = [['Phone', b.phone], ['WhatsApp', b.whatsapp], ['Email', b.email], ['Website', b.website], ['Address', b.address], ['GSTIN', b.gstin]].filter(r => r[1]);
    /** contact block; returns its height. dry = measure only */
    const contact = (x, y0, maxW, k, dry) => {
      let y = y0;
      const out = (op) => { if (!dry) ops.push(op); };
      if (b.name) { const l = wrapped(b.name, fam, 'bold', 18 * k, T.ink, maxW, 1)[0]; out(textOp(l, x, y, 'left')); y += 20 * k; }
      if (b.tagline) { wrapped(b.tagline, 'sans', 'regular', 10 * k, T.muted, maxW, 2).forEach(l => { out(textOp(l, x, y, 'left')); y += 14 * k; }); }
      y += 10 * k;
      const lab = 64 * k;
      for (const [key, v] of rows) {
        out(textOp(line(key.toUpperCase(), 'sans', 'medium', 6.8 * k, T.accent, 0.12), x, y, 'left'));
        const vl = wrapped(v, 'sans', 'regular', 9.5 * k, T.ink, maxW - lab, 2);
        vl.forEach((l, i) => out(textOp(l, x + lab, y + i * 12.5 * k, 'left')));
        y += Math.max(1, vl.length) * 12.5 * k + 6 * k;
      }
      if (!dry && site) ops.push({ t: 'link', x, y: y0 - 16 * k, w: maxW, h: y - y0 + 16 * k, url: site });
      return y - y0;
    };
    const logoPlate = (x, y, maxW, maxH) => {
      if (hasLogo && logo && logo.w) {
        const f = fit(logo.w, logo.h, maxW, maxH);
        ops.push({ t: 'rect', x, y, w: f.w + 28 * sc, h: f.h + 22 * sc, r: 12 * sc, fill: '#FFFFFF' });
        ops.push({ t: 'img', src: 'logo', x: x + 14 * sc, y: y + 11 * sc, w: f.w, h: f.h });
        return f.h + 22 * sc;
      }
      if (b.name) { ops.push(textOp(wrapped(b.name.toUpperCase(), 'sans', 'bold', 12 * sc, T.onAccent, maxW, 1, 0.12)[0], x, y + 20 * sc, 'left')); return 28 * sc; }
      return 0;
    };
    const titleBlock = (x, y, maxW) => {
      const tSize = (fam === 'serif' ? 44 : 40) * sc * (land ? 0.9 : 1);
      const kicker = line((S.cat.edition || monthYear()).toUpperCase(), 'sans', 'medium', 9 * sc, T.onAccent, 0.2);
      ops.push(Object.assign(textOp(kicker, x, y, 'left'), { alpha: 0.85 }));
      y += 16 * sc;
      for (const l of wrapped(S.cat.title || 'Product Catalogue', fam, 'bold', tSize, T.onAccent, maxW, 3)) { ops.push(textOp(l, x, y + l.s * 0.82, 'left')); y += l.s * 1.1; }
      y += 8 * sc;
      if (S.cat.subtitle) for (const l of wrapped(S.cat.subtitle, 'sans', 'regular', 14 * sc, T.onAccent, maxW, 2)) { ops.push(Object.assign(textOp(l, x, y + 12 * sc, 'left'), { alpha: 0.9 })); y += 20 * sc; }
      if (S.cat.forWho && S.cat.forWho.trim()) {
        // a catalogue made for one customer
        y += 10 * sc;
        ops.push(Object.assign(textOp(line('PREPARED FOR', 'sans', 'medium', 7.5 * sc, T.onAccent, 0.16), x, y + 8 * sc, 'left'), { alpha: 0.75 }));
        y += 14 * sc;
        for (const l of wrapped(S.cat.forWho.trim(), fam, 'bold', 16 * sc, T.onAccent, maxW, 2)) { ops.push(textOp(l, x, y + 12 * sc, 'left')); y += 20 * sc; }
      }
      ops.push({ t: 'rect', x, y: y + 18 * sc, w: 46 * sc, h: 3 * sc, r: 1.5, fill: T.onAccent, alpha: 0.85 });
      return y + 24 * sc;
    };
    const card = (p, x, y, cw, ch) => {
      ops.push({ t: 'rect', x, y, w: cw, h: ch, r: 14 * sc, fill: T.dark ? T.card : '#FFFFFF' });
      const f = fit(p.img.ow, p.img.oh, cw - 24 * sc, ch - 30 * sc);
      const ix = x + (cw - f.w) / 2, iy = y + ch - 14 * sc - f.h;
      ops.push({ t: 'shadow', x: ix + f.w * 0.07, y: iy + f.h - 4, w: f.w * 0.86, h: 7 * sc, alpha: 0.7 });
      ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
    };
    const qrPlate = (qx, qy, qs, onBand) => {
      ops.push({ t: 'rect', x: qx - 10 * sc, y: qy - 10 * sc, w: qs + 20 * sc, h: qs + 20 * sc, r: 10 * sc, fill: '#FFFFFF', stroke: T.dark || onBand ? null : T.rule, lw: 0.6 });
      ops.push({ t: 'qr', x: qx, y: qy, size: qs, data: qrData, color: '#111111' });
      const cap = line(waLink(b.whatsapp, '') ? 'Scan to chat on WhatsApp' : 'Scan to visit our website', 'sans', 'medium', 7.5 * sc, onBand ? T.onAccent : T.muted);
      ops.push(textOp(cap, qx + qs / 2, qy + qs + 24 * sc, 'center'));
      ops.push({ t: 'link', x: qx - 10 * sc, y: qy - 10 * sc, w: qs + 20 * sc, h: qs + 20 * sc, url: qrData });
    };
    const feat = products.filter(p => p.img && p.img.out).slice(0, 3);
    const meta = [total + (total === 1 ? ' product' : ' products'), sectionsCount > 1 ? sectionsCount + ' sections' : '', niceDate(), validText(S).replace(/\.$/, '')].filter(Boolean).join('   ·   ');
    ops.push({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: T.page });

    if (land) {
      /* landscape: accent band on the left (logo, title, QR); products and contact details on the right */
      const bw = W * 0.46;
      ops.push({ t: 'rect', x: 0, y: 0, w: bw, h: H, fill: T.accent });
      ops.push({ t: 'circle', cx: bw * 0.72, cy: H * 0.2, r: bw * 0.26, fill: T.onAccent, alpha: 0.07 });
      ops.push({ t: 'circle', cx: bw * 0.18, cy: H * 0.98, r: bw * 0.2, fill: T.onAccent, alpha: 0.05 });
      const lh = logoPlate(M, M, bw * 0.6, 54 * sc);
      titleBlock(M, M + lh + 34 * sc, bw - M * 2);
      if (qrData) { const qs = Math.min(80 * sc, H * 0.2); qrPlate(M + 10 * sc, H - M - qs - 30 * sc, qs, true); }
      const x0 = bw + M, rw = W - x0 - M;
      let y = M;
      const cH = contact(x0, 0, rw, sc, true);
      if (feat.length) {
        const gap = 10 * sc, cw = Math.min((rw - gap * 2) / 3, (H - M * 2 - cH - 60 * sc) / 1.16), ch = cw * 1.16;
        if (cw > 50) { feat.forEach((p, i) => card(p, x0 + i * (cw + gap), y, cw, ch)); y += ch + 34 * sc; }
      }
      contact(x0, y + 12 * sc, rw, sc, false);
      ops.push(textOp(line(meta, 'sans', 'regular', 7.5 * sc, T.muted), x0, H - M + 2, 'left'));
      return { w: W, h: H, bg: T.page, ops, kind: 'cover' };
    }

    /* portrait: accent band on top, product strip on its edge, contact details and QR below */
    const qs = qrData ? 92 * sc : 0;
    let k = sc, cH = contact(M, 0, W - M * 2 - (qs ? qs + 34 * sc : 0), k, true);
    let bandH = Math.min(H * 0.6, H - M - 26 * sc - cH - 70 * sc);
    if (bandH < H * 0.44) { k = sc * 0.85; cH = contact(M, 0, W - M * 2 - (qs ? qs + 34 * sc : 0), k, true); bandH = Math.max(H * 0.42, Math.min(H * 0.6, H - M - 26 * sc - cH - 60 * sc)); }
    ops.push({ t: 'rect', x: 0, y: 0, w: W, h: bandH, fill: T.accent });
    ops.push({ t: 'circle', cx: W * 0.92, cy: bandH * 0.18, r: W * 0.36, fill: T.onAccent, alpha: 0.07 });
    ops.push({ t: 'circle', cx: W * 0.78, cy: bandH * 0.62, r: W * 0.2, fill: T.onAccent, alpha: 0.06 });
    ops.push({ t: 'circle', cx: W * 0.06, cy: bandH * 0.98, r: W * 0.13, fill: T.onAccent, alpha: 0.05 });
    const lh = logoPlate(M, M, W * 0.36, 62 * sc);
    const ty = titleBlock(M, M + lh + 30 * sc + Math.max(0, (bandH - 470 * sc) * 0.35), W - M * 2 - 20);
    let overhang = 0;
    if (feat.length) {
      const gap = 12 * sc, cw = Math.min(W * 0.2, (W - M * 2 - gap * (feat.length - 1)) / feat.length), ch = cw * 1.16;
      const startX = W - M - (cw * feat.length + gap * (feat.length - 1));
      const cy = Math.max(ty + 10 * sc, bandH - ch * 0.6);
      feat.forEach((p, i) => card(p, startX + i * (cw + gap), cy, cw, ch));
      overhang = Math.max(0, cy + ch - bandH);
    }
    const cTop = bandH + Math.max(70 * sc, overhang + 30 * sc);
    contact(M, cTop, W - M * 2 - (qs ? qs + 34 * sc : 0), k, false);
    if (qrData) {
      let q = qs, qy = H - M - q - 30 * sc;
      if (qy < bandH + overhang + 16 * sc) { q = Math.max(56 * sc, H - M - 30 * sc - bandH - overhang - 16 * sc); qy = H - M - q - 30 * sc; }
      qrPlate(W - M - q, qy, q, false);
    }
    ops.push(textOp(line(meta, 'sans', 'regular', 7.5 * sc, T.muted), M, H - M + 2, 'left'));
    return { w: W, h: H, bg: T.page, ops, kind: 'cover' };
  }

  function dividerPage(P, S, T, group, firstProducts, pageNo, total, hasLogo, logo) {
    const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    header(ops, P, S, T, S.cat.title, S.biz.name, hasLogo, logo);
    const M = P.m, cy = P.h * 0.36;
    ops.push({ t: 'circle', cx: P.w - M - 40, cy: cy - 40, r: 120, fill: T.accent, alpha: 0.07 });
    ops.push(textOp(line(((S.cat.groupBy === 'brand' ? 'Brand' : S.cat.groupBy === 'product' ? 'Range' : 'Section')).toUpperCase(), 'sans', 'medium', 9, T.accent, 0.22), M, cy - 52, 'left'));
    wrapped(group.name, fam, 'bold', 40, T.ink, P.w - M * 2, 2).forEach((l, i) => ops.push(textOp(l, M, cy + i * 46, 'left')));
    ops.push({ t: 'rect', x: M, y: cy + 22 + (group.name.length > 18 ? 46 : 0), w: 56, h: 3, r: 1.5, fill: T.accent });
    ops.push(textOp(line(group.items.length + (group.items.length === 1 ? ' product' : ' products'), 'sans', 'regular', 11, T.muted), M, cy + 50 + (group.name.length > 18 ? 46 : 0), 'left'));
    const feat = firstProducts.filter(p => p.img && p.img.out).slice(0, 4);
    if (feat.length) {
      const gap = 12, area = P.w - M * 2, cw = (area - gap * 3) / 4, ch = cw * 1.15, y0 = P.h * 0.58;
      feat.forEach((p, i) => {
        const x = M + i * (cw + gap);
        ops.push({ t: 'rect', x, y: y0, w: cw, h: ch, r: 12, fill: T.card });
        const f = fit(p.img.ow, p.img.oh, cw - 20, ch - 24);
        const ix = x + (cw - f.w) / 2, iy = y0 + ch - 12 - f.h;
        ops.push({ t: 'shadow', x: ix + f.w * 0.07, y: iy + f.h - 4, w: f.w * 0.86, h: 6, alpha: 0.7 });
        ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
      });
    }
    footer(ops, P, S, T, pageNo, total);
    return { w: P.w, h: P.h, bg: T.page, ops, kind: 'divider', section: group.name };
  }

  /** How many list rows fit on one contents (cols 1) or index (cols 2) page. */
  function listCapacity(P, cols, roomy) {
    const top = P.m * 0.62 + P.hh + 30, rowH = cols === 1 ? (roomy ? 38 : 24) : 15.5;
    return Math.max(1, Math.floor((P.h - top - P.fh - P.m * 0.6) / rowH)) * cols;
  }
  function listPage(P, S, T, title, entries, pageNo, total, hasLogo, logo, cols, roomy) {
    // entries: [{label, sub, page}]
    const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
    header(ops, P, S, T, title, S.cat.title, hasLogo, logo);
    const M = P.m, top = P.m * 0.62 + P.hh + 30, colGap = 22;
    roomy = !!roomy && cols === 1;
    const colW = (P.w - M * 2 - colGap * (cols - 1)) / cols, rowH = cols === 1 ? (roomy ? 38 : 24) : 15.5;
    const perCol = Math.max(1, Math.floor((P.h - top - P.fh - M * 0.6) / rowH));
    entries.forEach((e, i) => {
      const c = Math.floor(i / perCol), r = i % perCol; if (c >= cols) return;
      const x = M + c * (colW + colGap), y = top + r * rowH;
      const sz = cols === 1 ? (roomy ? 14 : 11.5) : 8.2;
      const num = line(String(e.page), 'sans', cols === 1 ? 'bold' : 'medium', sz, cols === 1 ? T.accent : T.ink);
      const lab = wrapped(e.label, 'sans', cols === 1 ? 'medium' : 'regular', sz, T.ink, colW - num.w - 30, 1)[0];
      if (lab) ops.push(textOp(lab, x, y + sz, 'left'));
      ops.push(textOp(num, x + colW, y + sz, 'right'));
      const lx0 = x + (lab ? lab.w : 0) + 6, lx1 = x + colW - num.w - 6;
      if (lx1 > lx0) ops.push({ t: 'line', x1: lx0, y1: y + sz + 1, x2: lx1, y2: y + sz + 1, color: T.rule, lw: 0.6, dash: true });
      if (e.sub && cols === 1) { const sl = line(e.sub, 'sans', 'regular', roomy ? 9 : 8, T.muted); ops.push(textOp(sl, x, y + sz + (roomy ? 14 : 11), 'left')); }
      ops.push({ t: 'goto', x, y, w: colW, h: rowH, page: e.page - 1 });
    });
    footer(ops, P, S, T, pageNo, total);
    return { w: P.w, h: P.h, bg: T.page, ops, kind: 'list' };
  }

  /**
   * Build all pages. groups: [{name|null, items:[product]}]
   * logo: {w,h} or null.
   */
  function build(groups, S, logo) {
    const cat = S.cat, T = theme(cat);
    let [pw, ph] = PAGE_SIZES[cat.page] || PAGE_SIZES.A4;
    if (cat.orient === 'landscape') [pw, ph] = [ph, pw];
    const P = { w: pw, h: ph, m: Math.round(Math.min(pw, ph) * 0.05), hh: 40, fh: 30 };
    const hasLogo = !!logo;
    const n = clamp(parseInt(cat.perPage, 10) || 6, 1, 10);
    const all = groups.flatMap(g => g.items);
    const grouped = groups.length > 1 || (groups[0] && groups[0].name);
    const dense = n >= 7 || cat.compact === true;
    const contentTop = P.m * 0.62 + P.hh + 16, contentBottom = P.h - P.m * 0.55 - 22;
    const CW = P.w - P.m * 2, CH = contentBottom - contentTop;
    const gap = clamp(Math.min(CW, CH) * 0.022, 6, 14);
    // estimate text height (max over all products) for a given base size
    const textEst = (s) => {
      const cols = 1; const innerW = Math.max(60, CW / Math.ceil(Math.sqrt(n)) - s * 2);
      let mx = 0; const sample = all.length > 400 ? all.filter((_, i) => i % Math.ceil(all.length / 400) === 0) : all;
      for (const p of sample) mx = Math.max(mx, productLines(p, S, s, innerW, T, dense).h);
      return mx || s * 3.2;
    };
    const G = grid(n, CW, CH, gap, textEst);
    const innerW = G.cw - G.pad * 2;
    let textH = 0; for (const p of all) textH = Math.max(textH, productLines(p, S, G.s, innerW, T, dense).h);
    // pages
    const pages = [];
    const cover = cat.cover !== false;
    const useDividers = grouped && cat.dividers !== false;
    const useContents = grouped && cat.contents !== false && groups.length > 1;
    const roomyContents = groups.length <= listCapacity(P, 1, true);
    const perContents = listCapacity(P, 1, roomyContents);
    const contentsPages = useContents ? Math.ceil(groups.length / perContents) : 0;
    let pageNo = (cover ? 1 : 0) + contentsPages;
    const plan = []; // product page plan
    const bookmarks = [];
    for (const g of groups) {
      const startPage = pageNo + 1;
      if (useDividers && g.name) { plan.push({ kind: 'divider', group: g }); pageNo++; }
      for (let i = 0; i < g.items.length; i += n) { plan.push({ kind: 'products', group: g, items: g.items.slice(i, i + n), first: i === 0 }); pageNo++; }
      g.startPage = startPage;
      if (g.name) bookmarks.push({ title: g.name, page: startPage - 1 });
    }
    const indexEntries = cat.index ? all.map(p => ({ label: [fieldValue(p, 'name') || fieldValue(p, 'product') || 'Untitled', fieldValue(p, 'size')].filter(Boolean).join(' · '), page: 0, id: p.id })) : [];
    const perIndexPage = listCapacity(P, 2, false);
    const indexPages = cat.index && indexEntries.length ? Math.ceil(indexEntries.length / perIndexPage) : 0;
    const total = pageNo + indexPages;
    if (cover) pages.push(coverPage(P, S, T, all, all.length, hasLogo, logo, groups.filter(g => g.name).length));
    for (let c = 0; c < contentsPages; c++) {
      const ents = groups.slice(c * perContents, (c + 1) * perContents).map(g => ({ label: g.name || 'Products', sub: g.items.length + (g.items.length === 1 ? ' product' : ' products'), page: g.startPage }));
      pages.push(listPage(P, S, T, 'Contents', ents, pages.length + 1, total, hasLogo, logo, 1, roomyContents));
    }
    const productPage = new Map();
    for (const pl of plan) {
      const no = pages.length + 1;
      if (pl.kind === 'divider') { pages.push(dividerPage(P, S, T, pl.group, pl.group.items, no, total, hasLogo, logo)); continue; }
      const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
      const title = pl.group.name || cat.title || 'Catalogue';
      const sub = pl.group.name ? (cat.title || '') : (cat.subtitle || S.biz.name || '');
      header(ops, P, S, T, title, sub, hasLogo, logo);
      // cells
      let k = 0;
      const rowsUsed = G.rowCounts;
      for (let r = 0; r < G.rows && k < pl.items.length; r++) {
        const cap = rowsUsed[r], cnt = Math.min(cap, pl.items.length - k);
        const rowW = cnt * G.cw + (cnt - 1) * gap;
        const x0 = P.m + (CW - rowW) / 2, y = contentTop + r * (G.ch + gap);
        for (let c = 0; c < cnt; c++, k++) {
          const p = pl.items[k];
          productCard(ops, p, x0 + c * (G.cw + gap), y, G.cw, G.ch, G.s, G.pad, textH, S, T, dense);
          productPage.set(p.id, no);
        }
      }
      footer(ops, P, S, T, no, total);
      pages.push({ w: P.w, h: P.h, bg: T.page, ops, kind: 'products', section: pl.group.name, ids: pl.items.map(p => p.id) });
    }
    if (indexPages) {
      for (const e of indexEntries) e.page = productPage.get(e.id) || 1;
      indexEntries.sort((a, b) => a.label.localeCompare(b.label));
      for (let c = 0; c < indexPages; c++) pages.push(listPage(P, S, T, 'Index', indexEntries.slice(c * perIndexPage, (c + 1) * perIndexPage), pages.length + 1, total, hasLogo, logo, 2));
    }
    return { pages, theme: T, grid: G, total: pages.length, bookmarks, products: all.length };
  }
  /** A single product card, sized exactly as it will be in the catalogue (for the editor preview). */
  function cardPreview(p, S, others) {
    const cat = S.cat, T = theme(cat);
    let [pw, ph] = PAGE_SIZES[cat.page] || PAGE_SIZES.A4;
    if (cat.orient === 'landscape') [pw, ph] = [ph, pw];
    const m = Math.round(Math.min(pw, ph) * 0.05);
    const n = clamp(parseInt(cat.perPage, 10) || 6, 1, 10), dense = n >= 7 || cat.compact === true;
    const CW = pw - m * 2, CH = (ph - m * 0.55 - 22) - (m * 0.62 + 40 + 16);
    const gap = clamp(Math.min(CW, CH) * 0.022, 6, 14);
    const all = [p].concat(others || []);
    const G = grid(n, CW, CH, gap, (s) => { let mx = 0; for (const q of all) mx = Math.max(mx, productLines(q, S, s, CW / Math.ceil(Math.sqrt(n)) - s * 2, T, dense).h); return mx || s * 3.2; });
    let textH = 0; for (const q of all) textH = Math.max(textH, productLines(q, S, G.s, G.cw - G.pad * 2, T, dense).h);
    const pad = 8;
    const ops = [{ t: 'rect', x: 0, y: 0, w: G.cw + pad * 2, h: G.ch + pad * 2, fill: T.page }];
    productCard(ops, p, pad, pad, G.cw, G.ch, G.s, G.pad, textH, S, T, dense);
    return { w: G.cw + pad * 2, h: G.ch + pad * 2, bg: T.page, ops: ops.filter(o => o.t !== 'link') };
  }
  return { build, theme, waLink, waNumber, enquiryText, productLines, grid, line, wrapped, cardPreview };
})();
