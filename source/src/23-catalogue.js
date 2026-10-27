/* ===================== 23 · Catalogue builder: live preview, settings, export ===================== */
const CatalogueView = {
  L: null, el: null, io: null, renderGen: 0, lastExport: null,

  products() {
    const c = App.S.cat;
    const money = (p, dflt) => { const v = parseMoney(p.f.mrp); return v === null ? dflt : v; };
    let list = App.products.filter(p => !p.draft);
    if (c.include === 'ready') list = list.filter(p => App.status(p) === 'ready' || App.status(p) === 'nodetails');
    else if (c.include === 'photos') list = list.filter(p => p.img && p.img.out);
    else if (c.include === 'selected') list = list.filter(p => App.selected.has(p.id));
    if (c.brand) list = list.filter(p => (p.f.brand || '').trim().toLowerCase() === c.brand.toLowerCase());
    if (c.product) list = list.filter(p => (p.f.product || '').trim().toLowerCase() === c.product.toLowerCase());
    const by = {
      manual: (a, b) => (a.order || 0) - (b.order || 0),
      name: (a, b) => (a.f.name || '').localeCompare(b.f.name || ''),
      brand: (a, b) => (a.f.brand || '').localeCompare(b.f.brand || '') || (a.f.name || '').localeCompare(b.f.name || ''),
      mrpAsc: (a, b) => money(a, 1e12) - money(b, 1e12),
      mrpDesc: (a, b) => money(b, -1) - money(a, -1),
      newest: (a, b) => b.createdAt - a.createdAt
    }[c.sortBy] || ((a, b) => (a.order || 0) - (b.order || 0));
    return list.slice().sort(by);
  },
  groups(list) {
    const c = App.S.cat;
    if (c.groupBy !== 'brand' && c.groupBy !== 'product') return [{ name: null, items: list }];
    const m = new Map();
    for (const p of list) { const raw = (p.f[c.groupBy] || '').trim(); const k = raw.toLowerCase() || '~'; if (!m.has(k)) m.set(k, { name: raw || 'Other', items: [] }); m.get(k).items.push(p); }
    return Array.from(m.entries()).sort((a, b) => a[0] === '~' ? 1 : b[0] === '~' ? -1 : a[1].name.localeCompare(b[1].name)).map(e => e[1]);
  },
  build() {
    const list = this.products();
    const logo = App.logo ? { w: App.logo.w, h: App.logo.h } : null;
    const S = this.exportSettings();
    this.L = list.length ? LAYOUT.build(this.groups(list), S, logo) : null;
    this.count = list.length;
    return this.L;
  },
  exportSettings() { const S = App.S; return { cat: S.cat, biz: S.biz, fields: S.fields }; },

  render(main) {
    this.el = main;
    const c = App.S.cat;
    const set = (k, v, rebuild = true) => { c[k] = v; App.saveSettings(); if (rebuild) this.refresh(); };
    const t0 = performance.now();
    this.build();
    const empty = !this.L;
    const head = h('header', { class: 'top' },
      h('div', { class: 'top-row' }, h('span', { class: 'top-mark' }, icon('book')),
        h('div', { class: 'top-title' }, h('h1', null, 'Catalogue'), h('span', { class: 'muted small', id: 'cat-sum' })),
        h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => go('settings') }, icon('gear'))));
    const preview = h('section', { class: 'pv' },
      h('div', { class: 'pv-strip', id: 'pv-strip', tabindex: '0', 'aria-label': 'Page preview' }),
      h('div', { class: 'pv-foot' }, h('span', { id: 'pv-pos', class: 'small muted' }), h('label', { class: 'small linkish-label' }, h('input', { type: 'checkbox', onchange: e => { this.showLinks = e.target.checked; this.paintAll(); } }), ' Show tap areas')),
      h('p', { class: 'small excl', id: 'excl' }));

    const perPage = h('div', { class: 'perpage', role: 'radiogroup', 'aria-label': 'Products per page' },
      Array.from({ length: 10 }, (_, i) => i + 1).map(n => h('button', { class: 'pp' + (c.perPage === n ? ' on' : ''), role: 'radio', 'aria-checked': String(c.perPage === n), onclick: (e) => { $$('.pp', perPage).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); set('perPage', n); } }, this.gridGlyph(n), h('b', null, String(n)))));

    const themes = h('div', { class: 'swatches' }, Object.entries(THEMES).map(([k, t]) => h('button', { class: 'sw' + (c.theme === k ? ' on' : ''), title: t.name, onclick: (e) => { $$('.sw', themes).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); c.accent = ''; set('theme', k); const ac = $('#accent'); if (ac) ac.value = (THEMES[k].accent); } },
      h('span', { class: 'sw-page', style: { background: t.page, borderColor: t.dark ? t.page : '#0002' } }, h('i', { style: { background: t.accent } }), h('em', { style: { background: t.card } })), h('small', null, t.name))));

    const brands = App.brands(), prods = App.values('product');
    const panels = [
      h('section', { class: 'panel' },
        h('h3', null, 'Products per page'), perPage,
        h('h3', null, 'Style'), themes,
        h('div', { class: 'row2' },
          UI.field('Accent colour', h('input', { type: 'color', id: 'accent', value: c.accent || (THEMES[c.theme] || THEMES.classic).accent, onchange: e => set('accent', e.target.value) })),
          UI.field('Headings', UI.seg([{ value: 'sans', label: 'Modern' }, { value: 'serif', label: 'Elegant' }], c.font, v => set('font', v)))),
        UI.field('Catalogue title', h('input', { type: 'text', value: c.title, maxlength: 80, oninput: e => set('title', e.target.value) })),
        UI.field('Subtitle', h('input', { type: 'text', value: c.subtitle, placeholder: 'e.g. Festive collection 2026', maxlength: 120, oninput: e => set('subtitle', e.target.value) }))),
      h('details', { class: 'panel', open: c.include === 'selected' || undefined },
        h('summary', null, h('h3', null, 'Which products'), h('span', { class: 'small muted', id: 'which-sum' })),
        UI.field('Include', h('select', { onchange: e => set('include', e.target.value) },
          [['ready', 'Checked products with a photo'], ['photos', 'All products with a photo'], ['all', 'Everything, including no photo'], ['selected', `Only selected (${App.selected.size})`]].map(([v, l]) => h('option', { value: v, selected: c.include === v }, l)))),
        h('div', { class: 'row2' },
          UI.field('Brand', h('select', { onchange: e => set('brand', e.target.value) }, h('option', { value: '' }, 'All brands'), brands.map(b => h('option', { value: b, selected: c.brand === b }, b)))),
          UI.field('Product', h('select', { onchange: e => set('product', e.target.value) }, h('option', { value: '' }, 'All products'), prods.map(b => h('option', { value: b, selected: c.product === b }, b))))),
        h('div', { class: 'row2' },
          UI.field('Order', h('select', { onchange: e => set('sortBy', e.target.value) }, [['manual', 'As added'], ['brand', 'Brand, then name'], ['name', 'Name A–Z'], ['mrpAsc', 'MRP low to high'], ['mrpDesc', 'MRP high to low'], ['newest', 'Newest first']].map(([v, l]) => h('option', { value: v, selected: c.sortBy === v }, l)))),
          UI.field('Sections', h('select', { onchange: e => set('groupBy', e.target.value) }, [['none', 'No sections'], ['brand', 'One per brand'], ['product', 'One per product type']].map(([v, l]) => h('option', { value: v, selected: c.groupBy === v }, l)))))),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'Pages')),
        h('div', { class: 'row2' },
          UI.field('Paper', h('select', { onchange: e => set('page', e.target.value) }, ['A4', 'Letter', 'A5'].map(v => h('option', { value: v, selected: c.page === v }, v)))),
          UI.field('Direction', UI.seg([{ value: 'portrait', label: 'Upright' }, { value: 'landscape', label: 'Sideways' }], c.orient, v => set('orient', v)))),
        UI.field('Product card', UI.seg([{ value: 'soft', label: 'Soft' }, { value: 'outline', label: 'Outline' }, { value: 'minimal', label: 'None' }], c.card, v => set('card', v))),
        UI.toggle('Cover page', c.cover, v => set('cover', v), 'Logo, title, contact details and a WhatsApp QR code'),
        UI.toggle('Section pages', c.dividers, v => set('dividers', v), 'A title page before each brand or type'),
        UI.toggle('Contents page', c.contents, v => set('contents', v), 'Lists sections with page numbers'),
        UI.toggle('Index at the end', c.index, v => set('index', v), 'Every product A–Z with its page number'),
        UI.toggle('Soft shadow under products', c.shadow, v => set('shadow', v)),
        UI.toggle('Badges (New, Offer…)', c.badges, v => set('badges', v)),
        UI.toggle('Compact text', c.compact, v => set('compact', v), 'Puts size and type on one line. On automatically at 7+ per page'),
        UI.toggle('Page numbers', c.pageNo, v => set('pageNo', v)),
        UI.toggle('Shop contact in the footer', c.footContact, v => set('footContact', v)),
        UI.field('Note under every page', h('input', { type: 'text', value: c.note, maxlength: 140, oninput: e => set('note', e.target.value) }))),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'WhatsApp enquiries')),
        App.S.biz.whatsapp ? null : h('p', { class: 'warnline' }, icon('info'), 'Add your WhatsApp number in Settings to turn these on.'),
        UI.toggle('Tap a product to enquire', c.waLinks, v => set('waLinks', v), 'Opens WhatsApp with the product name and MRP filled in'),
        UI.toggle('QR code on the cover', c.qr, v => set('qr', v)),
        UI.field('Enquiry message', h('textarea', { rows: 2, placeholder: 'Hi{biz}! I am interested in {item}. Please share details.', oninput: e => set('waMsg', e.target.value) }, c.waMsg || ''), '{item} becomes the product name, size and MRP. {biz} becomes your shop name.')),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'File')),
        UI.field('Quality', h('select', { onchange: e => set('quality', e.target.value) }, Object.entries(RENDER.QUALITY).map(([k, q]) => h('option', { value: k, selected: c.quality === k }, q.label)))),
        UI.field('Split into files of', h('select', { onchange: e => set('split', +e.target.value) }, [[0, 'One file'], [100, '100 products each'], [250, '250 products each'], [500, '500 products each'], [1000, '1,000 products each']].map(([v, l]) => h('option', { value: String(v), selected: +c.split === v }, l))), 'Big catalogues are easier to send and open in parts.'),
        h('p', { class: 'small muted', id: 'size-est' }))
    ];
    const cta = h('div', { class: 'cta' },
      h('button', { class: 'btn primary big', disabled: empty, onclick: () => this.exportPDF() }, icon('file'), 'Create PDF'),
      h('button', { class: 'btn ghost', disabled: empty, onclick: () => this.exportImages() }, icon('image'), 'Pages as images'),
      this.lastExport ? h('button', { class: 'btn ghost', onclick: () => this.showResult(this.lastExport) }, icon('share'), 'Last PDF') : null);
    clear(main).append(head,
      empty ? h('div', { class: 'empty-cat' }, h('p', null, App.products.length ? 'No products match these choices. Change "Which products" below.' : 'Add products first. Each one becomes a card on the page.'), App.products.length ? null : h('button', { class: 'btn primary', onclick: () => Add.sheet() }, icon('camera'), 'Add products')) : preview,
      h('div', { class: 'cat-panels' }, panels), cta);
    this.afterBuild();
    LOG.add('info', 'catalogue view ' + Math.round(performance.now() - t0) + 'ms');
  },
  gridGlyph(n) {
    const g = LAYOUT.grid(n, 535, 730, 10, s => s * 3.6);
    const W = 26, H = 34, gap = 2, rows = g.rows, cols = g.cols;
    const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
    let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    g.rowCounts.forEach((cnt, r) => { const rowW = cnt * cw + (cnt - 1) * gap, x0 = (W - rowW) / 2; for (let c = 0; c < cnt; c++) svg += `<rect x="${(x0 + c * (cw + gap)).toFixed(1)}" y="${(r * (ch + gap)).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="1.2"/>`; });
    const s = h('span', { class: 'pp-glyph' }); s.innerHTML = svg + '</svg>'; return s;
  },
  refresh: debounce(function () { const self = CatalogueView; if (App.view !== 'catalogue') return; const wasEmpty = !self.L; self.build(); if (!self.L !== wasEmpty || !$('#pv-strip')) { self.render(self.el); return; } self.afterBuild(); }, 220),
  afterBuild() {
    const L = this.L, sum = $('#cat-sum');
    if (sum) sum.textContent = L ? `${this.count} products, ${L.pages.length} pages` : 'No products yet';
    const ws = $('#which-sum'); if (ws) ws.textContent = L ? `${this.count} included` : '';
    const est = $('#size-est'); if (est && L) est.textContent = 'Estimated size: about ' + bytesFmt(this.estimate(L)) + (App.S.cat.split ? `, split into ${Math.ceil(this.count / App.S.cat.split)} files` : '');
    const ex = $('#excl');
    if (ex) {
      const c = App.S.cat; let review = 0, nophoto = 0, drafts = 0;
      for (const p of App.products) { if (p.draft) { drafts++; continue; } const st = App.status(p); if (st === 'review' && c.include === 'ready') review++; else if (st === 'nophoto' && c.include !== 'all') nophoto++; }
      const bits = [review ? `${review} flagged "Check cut-out"` : '', nophoto ? `${nophoto} without a photo` : '', drafts ? `${drafts} unfinished` : ''].filter(Boolean);
      clear(ex);
      if (bits.length && c.include !== 'selected') ex.append('Not included: ' + bits.join(', ') + '. ', h('button', { class: 'linkish small', onclick: () => { App.filter.status = review ? 'review' : nophoto ? 'nophoto' : 'review'; go('products'); } }, 'Show them'));
    }
    const strip = $('#pv-strip'); if (!strip || !L) return;
    const gen = ++this.renderGen;
    if (this.io) this.io.disconnect();
    clear(strip);
    const slots = L.pages.map((pg, i) => { const s = h('div', { class: 'pv-page', dataset: { i: String(i) }, style: { aspectRatio: pg.w + ' / ' + pg.h } }, h('span', { class: 'pv-no' }, String(i + 1))); strip.appendChild(s); return s; });
    this.io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; this.paintSlot(en.target, gen); }
        else if (!en.isIntersecting && en.target.dataset.done) { const cv = en.target.querySelector('canvas'); if (cv) { IMG.release(cv); cv.remove(); } delete en.target.dataset.done; }
      }
      const vis = entries.filter(e => e.isIntersecting).map(e => +e.target.dataset.i);
      if (vis.length) { const pos = $('#pv-pos'); if (pos) pos.textContent = `Page ${Math.min(...vis) + 1} of ${L.pages.length}`; }
    }, { root: strip, rootMargin: '0px 300px', threshold: 0.01 });
    slots.forEach(s => this.io.observe(s));
    const pos = $('#pv-pos'); if (pos) pos.textContent = `Page 1 of ${L.pages.length}`;
  },
  paintAll() { $$('.pv-page').forEach(s => { delete s.dataset.done; if (s.querySelector('canvas')) this.paintSlot(s, this.renderGen); }); },
  async paintSlot(slot, gen) {
    const L = this.L; if (!L) return;
    const pg = L.pages[+slot.dataset.i]; if (!pg) return;
    const w = slot.clientWidth || 220, dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = h('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(w * pg.h / pg.w * dpr);
    await RENDER.drawPage(c.getContext('2d'), pg, c.width / pg.w, async (src, pw) => src === 'logo' ? (App.logo && App.logo.bmp) : App.productBitmap(src.id, pw), { showLinks: this.showLinks });
    if (gen !== this.renderGen) return;
    const old = slot.querySelector('canvas'); if (old) old.remove();
    slot.appendChild(c);
  },
  estimate(L) {
    const Q = RENDER.QUALITY[App.S.cat.quality] || RENDER.QUALITY.standard;
    const bpp = Q.q <= 0.72 ? 0.085 : Q.q <= 0.8 ? 0.12 : 0.2;
    let bytes = 90000 + (App.logo ? 60000 : 0); const seen = new Set();
    for (const pg of L.pages) { bytes += 2500; for (const op of pg.ops) if (op.t === 'img' && op.src !== 'logo') { const key = op.src.id + Math.round(op.w); if (seen.has(key)) continue; seen.add(key); const px = (op.w / 72 * Q.dpi) * (op.h / 72 * Q.dpi); bytes += px * bpp + px * 0.03; } }
    return bytes;
  },
  async drawable(src, w, h) {
    if (src === 'logo') return App.logo && App.logo.bmp;
    const p = App.byId.get(src.id); if (!p || !p.img || !p.img.out) return null;
    const blob = await DB.getBlob(p.img.out); if (!blob) return null;
    const ow = p.img.ow || w, oh = p.img.oh || h;
    if (w && h && window.createImageBitmap && (w < ow * 0.9)) {
      try { return await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(w)), resizeHeight: Math.max(1, Math.round(oh * w / ow)), resizeQuality: 'high' }); } catch (e) { }
    }
    return IMG.decode(blob);
  },
  async checkBeforeExport() {
    const S = App.S;
    if (!S.biz.name && !App.logo) {
      const ok = await UI.confirm('No shop name or logo yet', 'Pages look more professional with your logo at the top. You can add it in Settings in a minute.', 'Create anyway');
      if (!ok) { go('settings'); return false; }
    }
    return true;
  },
  async exportPDF() {
    App.saveSettings.flush();
    this.build(); if (!this.L) { UI.toast('No products to include'); return; }
    if (!(await this.checkBeforeExport())) return;
    this.build();
    const L = this.L, S = this.exportSettings();
    const prog = UI.progress('Creating PDF', true);
    await Wake.on();
    const t0 = performance.now();
    try {
      const parts = await RENDER.exportPDF(L, S, (src, w, h) => this.drawable(src, w, h), (d, n, pi, np) => prog.set(d / n, `Page ${d} of ${n}` + (np > 1 ? ` (file ${pi + 1} of ${np})` : '')), () => prog.cancelled);
      prog.close();
      const res = { parts, pages: L.pages.length, products: this.count, ms: performance.now() - t0, at: Date.now() };
      this.lastExport = res;
      this.showResult(res);
    } catch (e) {
      prog.close();
      if (e.message === 'Cancelled') UI.toast('Stopped');
      else { LOG.add('error', 'PDF failed', e && e.stack); UI.toast('Could not create the PDF: ' + (e.message || e) + '. Try "Small" quality or split into files.', { type: 'bad', ms: 9000 }); }
    } finally { await Wake.off(); }
  },
  showResult(res) {
    const total = res.parts.reduce((a, p) => a + p.blob.size, 0);
    const shareAll = async () => {
      const r = await UI.share(res.parts.map(p => p.file), App.S.cat.title, App.S.biz.name ? `${App.S.cat.title} from ${App.S.biz.name}` : App.S.cat.title);
      if (r === 'unsupported') { UI.toast('Sharing files is not supported in this browser. Downloading instead.'); res.parts.forEach(p => UI.download(p.blob, p.name)); }
    };
    const body = h('div', { class: 'result' },
      h('div', { class: 'res-head' }, h('span', { class: 'res-ic' }, icon('check')), h('div', null, h('b', null, res.parts.length > 1 ? `${res.parts.length} PDF files ready` : 'Your PDF is ready'), h('p', { class: 'small muted' }, `${res.products} products, ${res.pages} pages, ${bytesFmt(total)}`))),
      res.parts.map(p => h('div', { class: 'res-file' }, icon('file'), h('div', { class: 'rf-name' }, h('span', null, p.name), h('small', { class: 'muted' }, bytesFmt(p.blob.size))),
        h('button', { class: 'icon-btn', 'aria-label': 'Download ' + p.name, onclick: () => UI.download(p.blob, p.name) }, icon('download')),
        h('button', { class: 'icon-btn', 'aria-label': 'Open ' + p.name, onclick: () => UI.open(p.blob) }, icon('eye')))),
      ENV.isIOS ? h('p', { class: 'small muted' }, 'On iPhone: Share → Save to Files keeps a copy, or pick WhatsApp to send it.') : null,
      total > 60 * 1048576 ? h('p', { class: 'warnline' }, icon('alert'), 'This is a large file. For WhatsApp, use "Small" quality or split into files.') : null);
    UI.modal({ title: 'PDF created', body, actions: [
      { label: 'Download', icon: 'download', onClick: () => { res.parts.forEach(p => UI.download(p.blob, p.name)); return false; } },
      { label: ENV.canShareFiles ? 'Share' : 'Open', icon: ENV.canShareFiles ? 'share' : 'eye', primary: true, onClick: async () => { if (ENV.canShareFiles) await shareAll(); else UI.open(res.parts[0].blob); return false; } }
    ] });
  },
  async exportImages() {
    App.saveSettings.flush();
    this.build(); if (!this.L) return;
    const L = this.L;
    const prog = UI.progress('Saving pages as images', true);
    await Wake.on();
    try {
      const files = await RENDER.exportImages(L, (src, w, h) => this.drawable(src, w, h), 1240, (d, n) => { if (prog.cancelled) throw new Error('Cancelled'); prog.set(d / n, `Page ${d} of ${n}`); });
      prog.close();
      const zipIt = async () => { if (files.length === 1) { UI.download(files[0], files[0].name); return; } const zip = await ZIP.write(files.map(f => ({ name: f.name, data: f }))); UI.download(zip, safeFileName(App.S.cat.title) + '-pages.zip'); UI.toast(`${files.length} page images saved in one zip file`); };
      // sharing needs a fresh tap, so offer it as a button rather than calling it after the long render
      UI.modal({ title: 'Page images ready', body: h('p', null, `${files.length} image${files.length === 1 ? '' : 's'}, 1240 pixels wide. Share them to WhatsApp Status or a chat, or save them.`),
        actions: [{ label: files.length === 1 ? 'Download' : 'Download zip', icon: 'download', onClick: () => { zipIt(); return false; } },
          ENV.canShareFiles && files.length <= 30 ? { label: 'Share', icon: 'share', primary: true, onClick: async () => { const r = await UI.share(files, App.S.cat.title); if (r === 'unsupported') zipIt(); return false; } } : { label: 'Done', primary: true }] });
    } catch (e) { prog.close(); if (e.message !== 'Cancelled') UI.toast('Could not save images: ' + e.message, { type: 'bad' }); }
    finally { await Wake.off(); }
  }
};
