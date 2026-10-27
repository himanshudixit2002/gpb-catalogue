/* ===================== 21 · Products view, adding, batch, CSV ===================== */
const STATUS_LABEL = { ready: 'Ready', review: 'Check cut-out', nodetails: 'Add details', nophoto: 'No photo' };

const ProductsView = {
  el: null, grid: null, items: [], cols: 2, rowH: 252, sort: 'newest',
  render(main) {
    const S = App.S;
    const total = App.products.length;
    const counts = { all: total, ready: 0, review: 0, nodetails: 0, nophoto: 0 };
    for (const p of App.products) counts[App.status(p)]++;
    const brands = App.brands();
    const head = h('header', { class: 'top' },
      h('div', { class: 'top-row' },
        App.logo ? h('img', { class: 'top-logo', alt: S.biz.name || 'Logo', src: App.logoURL() }) : h('span', { class: 'top-mark' }, icon('tag')),
        h('div', { class: 'top-title' }, h('h1', null, App.logo || !S.biz.name ? 'Products' : S.biz.name), h('span', { id: 'savestate', class: 'savestate' })),
        h('button', { class: 'icon-btn phone-only', 'aria-label': 'Settings', onclick: () => go('settings') }, icon('gear')),
        h('button', { class: 'icon-btn', 'aria-label': 'More', onclick: () => ProductsView.menu() }, icon('more'))),
      Banners.render(),
      total ? StatsStrip.render() : null,
      total ? h('div', { class: 'searchbar' }, icon('search'),
        h('input', { type: 'search', placeholder: 'Search name, brand, size…', value: App.filter.q, 'aria-label': 'Search products', oninput: debounce(e => { App.filter.q = e.target.value; ProductsView.refresh(); }, 120) }),
        brands.length > 1 ? h('select', { class: 'brandsel', 'aria-label': 'Filter by brand', onchange: e => { App.filter.brand = e.target.value; ProductsView.refresh(); } },
          h('option', { value: '' }, 'All brands'), brands.map(b => h('option', { value: b, selected: App.filter.brand === b }, b))) : null) : null,
      total ? h('div', { class: 'chips', role: 'tablist' },
        [['all', 'All'], ['ready', 'Ready'], ['review', 'Check'], ['nodetails', 'No details'], ['nophoto', 'No photo']].filter(([k]) => k === 'all' || counts[k]).map(([k, l]) =>
          h('button', { class: 'chip' + (App.filter.status === k ? ' on' : '') + (k === 'review' ? ' warn' : ''), role: 'tab', dataset: { k }, 'aria-selected': String(App.filter.status === k), onclick: () => { App.filter.status = k; ProductsView.refresh(true); } }, l, h('b', null, String(counts[k]))))) : null
    );
    const sel = App.selecting ? ProductsView.selectionBar() : null;
    const grid = h('div', { class: 'pgrid', role: 'list' });
    const body = total ? [h('div', { class: 'list-head' }, h('span', { class: 'muted small', id: 'shown-count' }), h('button', { class: 'linkish small', onclick: () => { ProductsView.sort = ProductsView.sort === 'newest' ? 'order' : 'newest'; ProductsView.refresh(true); } }, ProductsView.sort === 'newest' ? 'Newest first' : 'Catalogue order')), grid] : [Onboarding.render()];
    this.sig = ProductsView.statusSig();
    clear(main).append(head, sel || '', ...body);
    renderSaveState($('#savestate'));
    this.el = main; this.grid = grid;
    if (total) this.refresh(true);
  },
  statusSig() { const seen = new Set(); for (const p of App.products) seen.add(App.status(p)); return ['ready', 'review', 'nodetails', 'nophoto'].filter(k => seen.has(k)).join(','); },
  filtered() {
    const f = App.filter, q = f.q.trim().toLowerCase();
    let list = App.products.filter(p => {
      if (f.status !== 'all' && App.status(p) !== f.status) return false;
      if (f.brand && (p.f.brand || '').trim().toLowerCase() !== f.brand.toLowerCase()) return false;
      if (q) { const hay = Object.values(p.f || {}).join(' ').toLowerCase(); if (!q.split(/\s+/).every(t => hay.includes(t))) return false; }
      return true;
    });
    if (this.sort === 'newest') list = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    return list;
  },
  refresh(resetScroll) {
    if (!this.grid || !document.body.contains(this.grid)) return;
    this.items = this.filtered();
    const sc = $('#shown-count'); if (sc) sc.textContent = this.items.length === App.products.length ? `${this.items.length} product${this.items.length === 1 ? '' : 's'}` : `${this.items.length} of ${App.products.length} shown`;
    const counts = { all: App.products.length, ready: 0, review: 0, nodetails: 0, nophoto: 0 };
    for (const p of App.products) counts[App.status(p)]++;
    $$('.chips .chip[data-k]').forEach(c => { const k = c.dataset.k, on = App.filter.status === k; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); const b = c.querySelector('b'); if (b) b.textContent = String(counts[k]); });
    const w = this.grid.clientWidth || window.innerWidth - 32;
    this.cols = Math.max(2, Math.floor((w + 12) / 172));
    const tileW = (w - (this.cols - 1) * 12) / this.cols;
    this.rowH = Math.round(tileW * 0.86 + 96 + 12);
    const rows = Math.ceil(this.items.length / this.cols);
    this.grid.style.height = Math.max(0, rows * this.rowH - 12) + 'px';
    this.grid.style.setProperty('--cols', this.cols);
    this.rendered = new Map();
    clear(this.grid);
    if (!this.items.length) this.grid.appendChild(h('div', { class: 'empty-filter' }, h('p', null, 'No products match.'), h('button', { class: 'btn ghost', onclick: () => { App.filter = { q: '', status: 'all', brand: '' }; ProductsView.render(ProductsView.el); } }, 'Clear filters')));
    if (resetScroll && window.scrollY > (this.grid.offsetTop || 0)) window.scrollTo(0, Math.max(0, this.grid.offsetTop - 80));
    this.paint();
  },
  paint() {
    if (!this.grid || !this.items.length) return;
    const rect = this.grid.getBoundingClientRect();
    const top = -rect.top, vh = window.innerHeight;
    const r0 = Math.max(0, Math.floor((top - 400) / this.rowH)), r1 = Math.min(Math.ceil(this.items.length / this.cols), Math.ceil((top + vh + 400) / this.rowH));
    const keep = new Set();
    for (let r = r0; r < r1; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c; if (i >= this.items.length) break;
      const p = this.items[i]; keep.add(p.id);
      if (this.rendered.has(p.id)) { const t = this.rendered.get(p.id); t.style.transform = `translate(${c * 100}%, ${r * this.rowH}px)`; t.style.left = `calc(${c} * 12px)`; continue; }
      const t = this.tile(p); t.style.transform = `translate(${c * 100}%, ${r * this.rowH}px)`; t.style.left = `calc(${c} * 12px)`;
      this.grid.appendChild(t); this.rendered.set(p.id, t);
    }
    for (const [id, t] of this.rendered) if (!keep.has(id)) { t.remove(); this.rendered.delete(id); }
  },
  tile(p) {
    const st = App.status(p), sel = App.selected.has(p.id);
    const img = h('img', { alt: '', decoding: 'async' });
    App.thumbURL(p).then(u => { if (u) img.src = u; else img.replaceWith(h('div', { class: 't-noimg' }, icon('camera'), h('span', null, 'Add photo'))); });
    const mrp = p.f.mrp ? fmtMoney(p.f.mrp) : '';
    const t = h('div', { class: 'tile' + (sel ? ' sel' : ''), role: 'listitem', tabindex: '0', dataset: { id: p.id } },
      h('div', { class: 't-img' }, img),
      h('div', { class: 't-body' },
        p.f.brand ? h('div', { class: 't-brand' }, p.f.brand) : null,
        h('div', { class: 't-name' + (p.f.name ? '' : ' muted') }, p.f.name || p.f.product || 'No name yet'),
        h('div', { class: 't-row' }, mrp ? h('span', { class: 'tag' }, mrp) : null, p.f.size ? h('span', { class: 't-size' }, p.f.size) : null)),
      st !== 'ready' ? h('span', { class: 't-status ' + st }, p.draft ? 'Unfinished' : STATUS_LABEL[st]) : null,
      App.selecting ? h('span', { class: 't-check' + (sel ? ' on' : '') }, icon('check')) : null);
    let pressT = 0, pressed = false;
    t.addEventListener('pointerdown', () => { pressed = false; pressT = setTimeout(() => { pressed = true; if (!App.selecting) { App.selecting = true; App.selected.add(p.id); if (navigator.vibrate) navigator.vibrate(12); ProductsView.render(ProductsView.el); } }, 480); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => t.addEventListener(ev, () => clearTimeout(pressT)));
    t.addEventListener('click', () => {
      if (pressed) return;
      if (App.selecting) { if (App.selected.has(p.id)) App.selected.delete(p.id); else App.selected.add(p.id); t.classList.toggle('sel'); const c = t.querySelector('.t-check'); if (c) c.classList.toggle('on'); ProductsView.updateSelCount(); return; }
      Editor.open({ product: p });
    });
    t.addEventListener('keydown', e => { if (e.key === 'Enter') t.click(); });
    t.addEventListener('contextmenu', e => e.preventDefault());
    return t;
  },
  selectionBar() {
    const n = App.selected.size;
    return h('div', { class: 'selbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Done selecting', onclick: () => { App.selecting = false; App.selected.clear(); ProductsView.render(ProductsView.el); } }, icon('x')),
      h('b', { id: 'selcount' }, n + ' selected'),
      h('button', { class: 'btn small ghost', onclick: () => { for (const p of ProductsView.items) App.selected.add(p.id); ProductsView.render(ProductsView.el); } }, 'Select all shown'),
      h('div', { class: 'selbar-acts' },
        h('button', { class: 'btn small', onclick: () => BulkEdit.open() }, icon('edit'), 'Edit'),
        h('button', { class: 'btn small', onclick: () => ProductsView.selMenu() }, icon('more'), 'More')));
  },
  updateSelCount() { const b = $('#selcount'); if (b) b.textContent = App.selected.size + ' selected'; },
  selMenu() {
    const ids = Array.from(App.selected);
    if (!ids.length) { UI.toast('Select products first'); return; }
    UI.sheet(ids.length + ' selected', [
      { icon: 'book', label: 'Make a catalogue of these', sub: 'Opens the catalogue with only these products', onClick: () => { App.S.cat.include = 'selected'; App.saveSettings(); go('catalogue'); } },
      { icon: 'up', label: 'Move to start of catalogue', onClick: async () => { const min = Math.min(...App.products.map(p => p.order || 0)); ids.forEach((id, i) => { App.byId.get(id).order = min - ids.length + i; }); await App.renumber(); UI.toast('Moved to the start'); ProductsView.refresh(); } },
      { icon: 'down', label: 'Move to end of catalogue', onClick: async () => { const max = Math.max(...App.products.map(p => p.order || 0)); ids.forEach((id, i) => { App.byId.get(id).order = max + 1 + i; }); await App.renumber(); UI.toast('Moved to the end'); ProductsView.refresh(); } },
      { icon: 'copy', label: 'Duplicate', sub: 'For size or colour variants', onClick: async () => { for (const id of ids) await App.duplicateProduct(App.byId.get(id)); UI.toast(`Duplicated ${ids.length}`); } },
      { sep: true },
      { icon: 'trash', label: 'Delete', sub: 'Removes photos and details from this phone', onClick: async () => { if (await UI.confirm(`Delete ${ids.length} product${ids.length > 1 ? 's' : ''}?`, 'This removes them from this phone. If you have a backup you can restore them.', 'Delete', true)) { await App.deleteProducts(ids); App.selecting = false; UI.toast('Deleted'); ProductsView.render(ProductsView.el); } } }
    ]);
  },
  menu() {
    UI.sheet('More', [
      { icon: 'file', label: 'Import product list (CSV)', sub: 'From Excel: File → Save as → CSV', onClick: () => CsvImport.run() },
      { icon: 'download', label: 'Export product list (CSV)', onClick: () => CsvImport.exportCSV() },
      { icon: 'shield', label: 'Back up everything', sub: 'One file with photos and details', onClick: () => Backup.create() },
      { icon: 'cloud', label: 'Restore or merge a backup', sub: 'Also used to combine work from several phones', onClick: () => Backup.restore() },
      { icon: 'check', label: 'Select products', onClick: () => { App.selecting = true; ProductsView.render(ProductsView.el); } },
      { icon: 'info', label: 'How to take good product photos', onClick: () => Help.photoTips() }
    ]);
  }
};
window.addEventListener('scroll', () => { if (App.view === 'products') requestAnimationFrame(() => ProductsView.paint()); }, { passive: true });
window.addEventListener('resize', debounce(() => { if (App.view === 'products') ProductsView.refresh(); }, 150));

const StatsStrip = {
  render() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const done = App.products.filter(p => p.createdAt >= today.getTime());
    const timed = done.filter(p => p.t > 0 && p.t < 15 * 60000);
    const avg = timed.length ? Math.round(timed.reduce((a, p) => a + p.t, 0) / timed.length / 1000) : 0;
    const ready = App.products.filter(p => App.status(p) === 'ready').length;
    return h('div', { class: 'stats' },
      h('div', null, h('b', null, String(App.products.length)), h('span', null, 'products')),
      h('div', null, h('b', null, String(ready)), h('span', null, 'ready for PDF')),
      h('div', null, h('b', null, String(done.length)), h('span', null, 'added today')),
      avg ? h('div', null, h('b', null, avg + 's'), h('span', null, 'per product')) : null);
  }
};

const Banners = {
  dismissed: new Set(),
  render() {
    const out = [];
    const add = (key, kind, text, actLabel, act) => { if (this.dismissed.has(key)) return; out.push(h('div', { class: 'banner ' + kind }, icon(kind === 'bad' ? 'alert' : 'info'), h('p', null, text), actLabel ? h('button', { class: 'btn small', onclick: act }, actLabel) : null, h('button', { class: 'icon-btn small', 'aria-label': 'Dismiss', onclick: (e) => { this.dismissed.add(key); e.target.closest('.banner').remove(); } }, icon('x')))); };
    if (ENV.isFile || ENV.contentUri) add('file', 'bad', 'You opened a saved copy of this page (for example from WhatsApp). Work saved here may disappear and sharing can fail. Open the website link in Chrome or Safari instead.', App.S.appUrl ? 'Copy link' : null, () => { navigator.clipboard && navigator.clipboard.writeText(App.S.appUrl); UI.toast('Link copied'); });
    else if (ENV.inApp) add('inapp', 'bad', 'You are inside another app\'s browser. Open this page in Chrome or Safari so your products are saved in one place.', null);
    if (!App.persistentOK) add('nostore', 'bad', 'This browser is not letting the app save your work. Use Chrome or Safari (not private mode).', null);
    const n = App.products.length, last = App.S.lastBackup || 0;
    if (n >= 15 && Date.now() - last > 7 * 864e5) add('backup', 'warn', last ? `Last backup ${Math.round((Date.now() - last) / 864e5)} days ago. Back up your ${n} products.` : `Your ${n} products are only on this phone. Make a backup file.`, 'Back up', () => Backup.create());
    if (Banners.storageLow) add('storage', 'warn', 'This phone is running low on space for the app. Back up, then remove old products.', 'Back up', () => Backup.create());
    return out.length ? h('div', { class: 'banners' }, out) : null;
  }
};

const Onboarding = {
  render() {
    const S = App.S;
    const step = (done, title, text, btn, fn) => h('li', { class: done ? 'done' : '' }, h('span', { class: 'ob-dot' }, done ? icon('check') : null), h('div', null, h('b', null, title), h('p', { class: 'muted' }, text), btn ? h('button', { class: 'btn ' + (done ? 'ghost' : 'primary') + ' small', onclick: fn }, btn) : null));
    return h('section', { class: 'onboard' },
      h('div', { class: 'ob-hero' },
        h('div', { class: 'ob-tag' }, h('span', { class: 'tag big' }, '₹ MRP')),
        h('h2', null, 'Photograph a product, get a catalogue page.'),
        h('p', { class: 'muted' }, 'Straighten the photo with four corners, remove the background, add the details. Everything stays on this phone until you share the PDF.')),
      h('ol', { class: 'ob-steps' },
        step(!!(S.biz.name && App.logo), 'Add your shop name and logo', 'Shown on every page. The logo goes top right, background removed.', 'Set up', () => go('settings')),
        step(false, 'Add your first product', 'Take a photo against a plain wall or sheet for the cleanest cut-out.', 'Take photo', () => Add.photo()),
        step(false, 'Create the PDF', 'Choose 1 to 10 products per page and share it on WhatsApp.', null)),
      h('div', { class: 'ob-more' },
        h('button', { class: 'btn ghost', onclick: () => Add.choose() }, icon('images'), 'Choose photos'),
        h('button', { class: 'btn ghost', onclick: () => CsvImport.run() }, icon('file'), 'Import product list'),
        h('button', { class: 'btn ghost', onclick: () => Backup.restore() }, icon('cloud'), 'Restore a backup')));
  }
};

/* ---------- adding products ---------- */
const Add = {
  sheet() {
    UI.sheet('Add products', [
      { icon: 'camera', label: 'Take photo', sub: 'Opens the camera', primary: true, onClick: () => Add.photo() },
      { icon: 'images', label: 'Choose photos', sub: 'Pick one to edit, or many to process automatically', onClick: () => Add.choose() },
      { icon: 'file', label: 'Import product list (CSV)', sub: 'Brand, size, name, MRP from Excel', onClick: () => CsvImport.run() },
      { icon: 'edit', label: 'Add details only', sub: 'Photo can be added later', onClick: () => Editor.open({ noPhoto: true }) },
      { sep: true },
      { icon: 'info', label: 'Photo tips', sub: 'Get clean cut-outs first time', onClick: () => Help.photoTips() }
    ]);
  },
  async photo(product) {
    const files = await UI.pickFiles({ capture: true });
    if (files[0]) Editor.open({ file: files[0], product });
  },
  async choose() {
    const files = await UI.pickFiles({ multiple: true });
    if (!files.length) return;
    if (files.length === 1) { Editor.open({ file: files[0] }); return; }
    Batch.add(files);
  }
};

const Batch = {
  queue: [], running: false, done: 0, total: 0, failed: 0, panel: null,
  add(files) {
    this.queue.push(...files); this.total += files.length;
    UI.toast(`Processing ${files.length} photos. You can keep working.`, { icon: 'zap' });
    this.ensurePanel();
    if (!this.running) this.run();
  },
  ensurePanel() {
    if (this.panel && document.body.contains(this.panel)) return;
    this.panel = h('div', { class: 'batch', role: 'status' }, h('div', { class: 'pbar' }, h('i')), h('span', { class: 'b-txt' }, 'Preparing…'));
    document.body.appendChild(this.panel);
  },
  update(text) {
    if (!this.panel) return;
    this.panel.querySelector('.pbar i').style.width = Math.round(this.done / Math.max(1, this.total) * 100) + '%';
    this.panel.querySelector('.b-txt').textContent = text || `Processing photo ${Math.min(this.done + 1, this.total)} of ${this.total}`;
  },
  matchByName(fileName) {
    const base = codeKey(String(fileName).replace(/\.[a-z0-9]+$/i, ''));
    if (!base) return null;
    for (const p of App.products) {
      if ((p.imageName && codeKey(String(p.imageName).replace(/\.[a-z0-9]+$/i, '')) === base) || (p.f.code && codeKey(p.f.code) === base)) return (!p.img || !p.img.out) ? p : null;
    }
    return null;
  },
  async run() {
    this.running = true; await Wake.on();
    while (this.queue.length) {
      const file = this.queue.shift();
      this.update();
      try {
        const r = await PIPE.autoProcess(file, App.S);
        const match = this.matchByName(file.name);
        const p = match || App.newProduct();
        p.edit = r.edit; p.autoParams = r.autoParams; p.q = r.quality;
        p.review = !!(r.review || r.quality.warnings.length);
        p.srcName = file.name;
        const stale = await PIPE.store(p, { srcBlob: r.srcBlob, srcW: r.srcW, srcH: r.srcH, mask: r.mask, out: r.out }, App.S.photo.keepSource);
        IMG.release(r.out);
        await PIPE.commit(p, stale);
      } catch (e) { this.failed++; LOG.add('error', 'Batch photo failed: ' + file.name, e && e.message); }
      this.done++;
      await yieldUI();
    }
    this.running = false; await Wake.off();
    const ok = this.done - this.failed;
    this.update(`Done: ${ok} added${this.failed ? `, ${this.failed} could not be opened` : ''}`);
    setTimeout(() => { if (!this.running && this.panel) { this.panel.remove(); this.panel = null; } }, 4000);
    UI.toast(`${ok} products added. Check the ones marked "Check cut-out".`, { icon: 'check', action: { label: 'Show', fn: () => { App.filter.status = 'review'; go('products'); } } });
    this.done = 0; this.total = 0; this.failed = 0;
  }
};

const BulkEdit = {
  open() {
    const ids = Array.from(App.selected);
    if (!ids.length) { UI.toast('Select products first'); return; }
    const inputs = {};
    const keys = App.S.fields.filter(f => f.key !== 'name').map(f => f.key).concat(['badge']);
    const body = h('div', { class: 'form' },
      h('p', { class: 'muted small' }, 'Only the boxes you fill in are changed. Leave a box empty to keep each product\'s own value.'),
      keys.map(k => {
        const f = App.S.fields.find(x => x.key === k) || { label: 'Badge (e.g. New, 10% off)' };
        const inp = h('input', { type: 'text', list: 'dl-' + k, inputmode: k === 'mrp' ? 'decimal' : undefined, autocomplete: 'off' });
        inputs[k] = inp;
        return UI.field(f.label, inp);
      }),
      UI.toggle('Clear the badge on these products', false, v => { inputs._clearBadge = v; }));
    UI.modal({ title: `Edit ${ids.length} products`, body, actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: async () => {
      const changes = {}; for (const k of keys) { const v = inputs[k].value.trim(); if (v) changes[k] = v; }
      if (!Object.keys(changes).length && !inputs._clearBadge) { UI.toast('Nothing to change'); return false; }
      const list = ids.map(id => App.byId.get(id)).filter(Boolean);
      for (const p of list) { Object.assign(p.f, changes); if (inputs._clearBadge) delete p.f.badge; p.updatedAt = Date.now(); }
      await DB.putMany('products', list); Sync.post({ t: 'products', ids: list.map(p => p.id) }); App.markSaved(); App.changed();
      UI.toast(`Updated ${list.length} products`); ProductsView.render(ProductsView.el);
    } }] });
  }
};

const CsvImport = {
  async run() {
    const files = await UI.pickFiles({ accept: '.csv,.tsv,.txt,text/csv,text/plain' });
    if (!files[0]) return;
    if (/\.xlsx?$/i.test(files[0].name)) { UI.toast('Save the Excel sheet as CSV first (File → Save as → CSV)', { type: 'bad', ms: 7000 }); return; }
    let rows;
    try { rows = CSV.parse(await files[0].text()); } catch (e) { UI.toast('Could not read that file', { type: 'bad' }); return; }
    if (rows.length < 2) { UI.toast('The file has no product rows', { type: 'bad' }); return; }
    const headers = rows[0].map(x => String(x).trim()), data = rows.slice(1);
    const guess = CSV.guess(headers);
    const targets = [['name', 'Name'], ['brand', 'Brand'], ['size', 'Size'], ['mrp', 'MRP'], ['product', 'Product'], ['badge', 'Badge'], ['code', 'Code / SKU'], ['image', 'Photo file name']];
    const sels = {};
    const opt = (sel) => [h('option', { value: '-1' }, 'Not in file'), headers.map((hd, i) => h('option', { value: String(i), selected: sel === i }, hd || `Column ${i + 1}`))];
    const extras = Object.keys(guess).filter(k => k.startsWith('x:'));
    const extraOn = {};
    const preview = data.slice(0, 3).map(r => r.join(' | ')).join('\n');
    const body = h('div', { class: 'form' },
      h('p', { class: 'muted small' }, `${data.length} rows found. Match your columns:`),
      h('div', { class: 'map-grid' }, targets.map(([k, l]) => { const s = h('select', null, opt(guess[k])); sels[k] = s; return UI.field(l, s); })),
      extras.length ? h('div', null, h('p', { class: 'small' }, 'Other columns can become extra details on the page:'), extras.map(k => UI.toggle(k.slice(2), false, v => { extraOn[k] = v; }))) : null,
      h('details', null, h('summary', null, 'First rows'), h('pre', { class: 'pre' }, preview)),
      UI.toggle('Update products that already exist', true, v => { sels._update = v; }, 'Matches by code, or by brand + name + size'));
    sels._update = true;
    UI.modal({ title: 'Import product list', wide: true, body, actions: [{ label: 'Cancel' }, { label: `Import ${data.length}`, primary: true, onClick: async () => {
      const idx = {}; for (const [k] of targets) idx[k] = parseInt(sels[k].value, 10);
      if (idx.name < 0 && idx.product < 0 && idx.brand < 0) { UI.toast('Choose at least the Name column', { type: 'bad' }); return false; }
      // new custom fields
      const extraKeys = [];
      for (const k of extras) if (extraOn[k]) {
        const label = k.slice(2), ascii = normKey(label).slice(0, 20);
        const key = 'c_' + (ascii || 'f' + Array.from(label).map(ch => ch.codePointAt(0).toString(36)).join('').slice(0, 18));
        if (!App.S.fields.find(f => f.key === key)) App.S.fields.push({ key, label, on: true, showLabel: true, style: 'custom' });
        extraKeys.push([key, guess[k]]);
      }
      if (idx.code >= 0 && !App.S.fields.find(f => f.key === 'code')) App.S.fields.push({ key: 'code', label: 'Code', on: false, showLabel: true, style: 'custom' });
      App.saveSettings();
      // Match only against products that existed BEFORE this import, by code first, else by brand + name + size.
      // Keys keep Hindi and other scripts intact; a product without a name is never matched.
      const keyOf = p => (p.f.name ? [p.f.brand, p.f.name, p.f.size].map(matchKey).join('\u0001') : '');
      const existing = new Map(), byCode = new Map();
      for (const p of App.products) { const k = keyOf(p); if (k && !existing.has(k)) existing.set(k, p); if (p.f.code) byCode.set(codeKey(p.f.code), p); }
      const touched = new Set();
      let added = 0, updated = 0; const toSave = [];
      let order = App.products.reduce((m, p) => Math.max(m, p.order || 0), 0);
      for (const r of data) {
        const f = {};
        for (const [k] of targets) if (idx[k] >= 0 && k !== 'image') { const v = String(r[idx[k]] || '').trim(); if (v) f[k] = v; }
        for (const [key, col] of extraKeys) { const v = String(r[col] || '').trim(); if (v) f[key] = v; }
        if (!Object.keys(f).length) continue;
        let p = null;
        if (sels._update) { const k = keyOf({ f }); p = (f.code && byCode.get(codeKey(f.code))) || (k && existing.get(k)) || null; }
        if (p && touched.has(p.id)) p = null; // two rows in the file never collapse into one product
        if (p) { Object.assign(p.f, f); p.updatedAt = Date.now(); updated++; }
        else { p = App.newProduct(); p.order = ++order; p.f = f; added++; App.products.push(p); App.byId.set(p.id, p); }
        touched.add(p.id);
        if (idx.image >= 0 && r[idx.image]) p.imageName = String(r[idx.image]).trim();
        toSave.push(p);
      }
      await DB.putMany('products', toSave);
      Sync.post({ t: 'products', ids: toSave.map(p => p.id) });
      App.markSaved(); App.changed();
      UI.toast(`Imported: ${added} new, ${updated} updated. Add photos from the "No photo" filter.`, { icon: 'check', ms: 6000 });
      go('products');
    } }] });
  },
  exportCSV() {
    const fields = App.S.fields;
    const rows = [['id', ...fields.map(f => f.label), 'Badge', 'Status', 'Has photo']];
    for (const p of App.products.slice().sort((a, b) => a.order - b.order)) rows.push([p.id, ...fields.map(f => p.f[f.key] || ''), p.f.badge || '', STATUS_LABEL[App.status(p)], p.img && p.img.out ? 'yes' : 'no']);
    UI.download(new Blob([CSV.stringify(rows)], { type: 'text/csv;charset=utf-8' }), `products-${fileStamp()}.csv`);
    UI.toast('Product list downloaded');
  }
};
