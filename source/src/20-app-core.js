/* ===================== 20 · App core: state, data, shared UI ===================== */
const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  images: '<rect x="3" y="5" width="14" height="12" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V9"/><path d="m4 15 4-4 4 4 2-2 3 3"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  wand: '<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  brush: '<path d="M14 4 20 10l-7 7-6-6z"/><path d="M7 11c-3 0-4 3-4 6 0 1-.5 2-1 3 4 0 8-1 9-5"/>',
  erase: '<path d="M8 20h12M5 14l8-8 6 6-8 8H8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
  frame: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="m9 9 6 1-1 5-6-1z"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'
};
const icon = (name, cls = '') => { const s = h('span', { class: 'ic ' + cls, 'aria-hidden': 'true' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; return s; };

const DEFAULT_SETTINGS = () => ({
  v: 2,
  biz: { name: '', tagline: '', phone: '', whatsapp: '', email: '', website: '', address: '', gstin: '' },
  fields: [
    { key: 'brand', label: 'Brand', on: true, showLabel: false, style: 'brand', builtin: true },
    { key: 'size', label: 'Size', on: true, showLabel: true, style: 'meta', builtin: true },
    { key: 'name', label: 'Name', on: true, showLabel: false, style: 'title', builtin: true },
    { key: 'mrp', label: 'MRP', on: true, showLabel: true, style: 'price', builtin: true },
    { key: 'product', label: 'Product', on: true, showLabel: false, style: 'meta', builtin: true }
  ],
  cat: {
    title: 'Product Catalogue', subtitle: '', edition: '', page: 'A4', orient: 'portrait', perPage: 6,
    theme: 'classic', accent: '', font: 'sans', card: 'soft', shadow: true, badges: true,
    cover: true, contents: true, dividers: true, index: false,
    groupBy: 'none', sortBy: 'manual', include: 'ready', brand: '', product: '',
    qr: true, waLinks: true, waMsg: '', note: 'Prices are MRP, inclusive of all taxes.',
    quality: 'standard', split: 0, compact: false, pageNo: true, footContact: true
  },
  photo: { bg: 'quick', aiQuality: 'fast', keepSource: true, sticky: ['brand', 'product'] },
  logoMode: 'global', staff: '', appUrl: '', lastBackup: 0, onboarded: false
});

const App = {
  S: null, products: [], byId: new Map(), view: 'products',
  filter: { q: '', status: 'all', brand: '' }, selected: new Set(), selecting: false,
  logo: null, // {blob, w, h, bmp}
  stickyValues: {}, saving: 0, busy: 0, lastSaved: 0, persistentOK: true,
  thumbs: new LRU(500, (url) => URL.revokeObjectURL(url)),
  bitmaps: new LRU(120, (b) => { try { b.close && b.close(); } catch (e) { } }),

  async load() {
    App.persistentOK = await DB.open();
    const saved = await DB.getKV('settings', null);
    App.S = mergeDeep(DEFAULT_SETTINGS(), saved || {});
    App.stickyValues = await DB.getKV('sticky', {}) || {};
    const list = await DB.all('products');
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    App.products = list; App.byId = new Map(list.map(p => [p.id, p]));
    const lb = await DB.getBlob('logo');
    if (lb) await App.setLogoBlob(lb, false);
  },
  saveSettings: debounce(async () => { await DB.setKV('settings', App.S); App.markSaved(); Sync.post({ t: 'settings' }); }, 350),
  /** Re-read products changed in another tab (ids) or everything. */
  async reloadProducts(ids) {
    if (!ids) {
      const list = await DB.all('products'); list.sort((a, b) => (a.order || 0) - (b.order || 0));
      App.products = list; App.byId = new Map(list.map(p => [p.id, p]));
    } else {
      for (const id of ids) {
        const rec = await DB.get('products', id), i = App.products.findIndex(x => x.id === id);
        if (rec) { if (i >= 0) App.products[i] = rec; else App.products.push(rec); App.byId.set(id, rec); }
        else if (i >= 0) { App.products.splice(i, 1); App.byId.delete(id); }
        App.thumbs.delete(id);
      }
      App.products.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    App.changed();
  },
  async reloadSettings() {
    const saved = await DB.getKV('settings', null);
    if (saved) App.S = mergeDeep(DEFAULT_SETTINGS(), saved);
    const lb = await DB.getBlob('logo');
    if (lb && (!App.logo || App.logo.blob.size !== lb.size)) await App.setLogoBlob(lb, false);
    App.changed();
  },
  async setLogoBlob(blob, persist = true) {
    if (App.logo && App.logo.bmp && App.logo.bmp.close) App.logo.bmp.close();
    if (App.logo && App.logo.url) URL.revokeObjectURL(App.logo.url);
    if (!blob) { App.logo = null; if (persist) await DB.delBlob('logo'); return; }
    const bmp = await IMG.decode(blob); const d = IMG.dims(bmp);
    App.logo = { blob, w: d.w, h: d.h, bmp };
    if (persist) { await DB.putBlob(blob, 'logo'); App.markSaved(); }
  },
  logoURL() { if (!App.logo) return ''; if (!App.logo.url) App.logo.url = URL.createObjectURL(App.logo.blob); return App.logo.url; },
  markSaved() { App.lastSaved = Date.now(); const el = $('#savestate'); if (el) renderSaveState(el); },

  /* ---- products ---- */
  newProduct() {
    const maxOrder = App.products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    return { id: 'p' + uid(), createdAt: Date.now(), updatedAt: Date.now(), order: maxOrder + 1, f: {}, img: {}, edit: null, review: false, q: null, t: 0 };
  },
  async saveProduct(p) {
    p.updatedAt = Date.now();
    App.saving++;
    try { await DB.put('products', p); }
    finally { App.saving--; }
    if (!App.byId.has(p.id)) { App.products.push(p); }
    else { const i = App.products.findIndex(x => x.id === p.id); if (i >= 0) App.products[i] = p; }
    App.byId.set(p.id, p);
    App.thumbs.delete(p.id); for (const k of Array.from(App.bitmaps.map.keys())) if (k.startsWith(p.id + '@')) App.bitmaps.delete(k);
    App.markSaved();
    Sync.post({ t: 'products', ids: [p.id] });
    App.changed();
  },
  async deleteProducts(ids) {
    const blobs = [];
    for (const id of ids) { const p = App.byId.get(id); if (!p) continue; for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) blobs.push(p.img[k]); }
    await DB.delMany('blobs', blobs); await DB.delMany('products', ids);
    const set = new Set(ids);
    App.products = App.products.filter(p => !set.has(p.id));
    for (const id of ids) { App.byId.delete(id); App.thumbs.delete(id); App.selected.delete(id); }
    Sync.post({ t: 'products', ids });
    App.markSaved(); App.changed();
  },
  async duplicateProduct(p) {
    const q = JSON.parse(JSON.stringify(p));
    q.id = 'p' + uid(); q.createdAt = q.updatedAt = Date.now(); q.order = (p.order || 0) + 0.5;
    q.img = Object.assign({}, p.img);
    for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) { const b = await DB.getBlob(p.img[k]); q.img[k] = b ? await DB.putBlob(b) : null; }
    await App.saveProduct(q); await App.renumber();
    return q;
  },
  /** Close gaps in the manual order; writes only the products whose position changed. */
  async renumber() {
    App.products.sort((a, b) => (a.order || 0) - (b.order || 0));
    const changed = [];
    App.products.forEach((p, i) => { if (p.order !== i + 1) { p.order = i + 1; changed.push(p); } });
    await DB.putMany('products', changed);
    if (changed.length) Sync.post({ t: 'products', ids: changed.map(p => p.id) });
  },
  status(p) {
    if (p.draft) return 'review';
    if (!p.img || !p.img.out) return 'nophoto';
    if (p.review) return 'review';
    if (!(p.f && (p.f.name || p.f.product || p.f.brand))) return 'nodetails';
    return 'ready';
  },
  brands() { const s = new Map(); for (const p of App.products) { const b = (p.f.brand || '').trim(); if (b) s.set(b.toLowerCase(), b); } return Array.from(s.values()).sort((a, b) => a.localeCompare(b)); },
  values(key) { const s = new Map(); for (const p of App.products) { const b = String(p.f[key] || '').trim(); if (b) s.set(b.toLowerCase(), b); } return Array.from(s.values()).sort((a, b) => a.localeCompare(b)).slice(0, 300); },
  async thumbURL(p) {
    let u = App.thumbs.get(p.id); if (u) return u;
    if (!p.img || !p.img.thumb) return null;
    const b = await DB.getBlob(p.img.thumb); if (!b) return null;
    u = URL.createObjectURL(b); App.thumbs.set(p.id, u); return u;
  },
  /** Decoded cut-out for previews/PDF (cached at a size bucket) */
  async productBitmap(id, maxPx) {
    const p = App.byId.get(id); if (!p || !p.img || !p.img.out) return null;
    const bucket = maxPx ? Math.min(1400, Math.pow(2, Math.ceil(Math.log2(Math.max(64, maxPx))))) : 0;
    const key = id + '@' + bucket + '@' + p.updatedAt;
    let b = App.bitmaps.get(key); if (b) return b;
    const blob = await DB.getBlob(p.img.out); if (!blob) return null;
    try {
      if (bucket && window.createImageBitmap) {
        const s = Math.min(1, bucket / Math.max(p.img.ow || bucket, p.img.oh || bucket));
        b = await createImageBitmap(blob, s < 1 ? { resizeWidth: Math.max(1, Math.round((p.img.ow || bucket) * s)), resizeHeight: Math.max(1, Math.round((p.img.oh || bucket) * s)), resizeQuality: 'high' } : {});
      } else b = await IMG.decode(blob);
    } catch (e) { b = await IMG.decode(blob); }
    if (bucket) App.bitmaps.set(key, b);
    return b;
  },
  listeners: new Set(),
  changed: debounce(() => { for (const fn of App.listeners) try { fn(); } catch (e) { LOG.add('error', e); } }, 60)
};
function mergeDeep(base, extra) {
  for (const k in extra) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

/* ---------- keep two open copies (tab + home-screen app) from overwriting each other ---------- */
const Sync = {
  ch: null, id: uid(), warned: false,
  init() {
    if (!('BroadcastChannel' in window)) return;
    try { this.ch = new BroadcastChannel('catalogue-maker-v2'); } catch (e) { return; }
    this.ch.onmessage = (e) => this.receive(e.data);
    this.post({ t: 'hello' });
  },
  post(m) { if (this.ch) try { this.ch.postMessage(Object.assign({ from: this.id }, m)); } catch (e) { } },
  async receive(m) {
    if (!m || m.from === this.id) return;
    if (m.t === 'hello') { this.post({ t: 'here' }); this.warn(); }
    else if (m.t === 'here') this.warn();
    else if (m.t === 'products') {
      if (Editor.st && m.ids && m.ids.indexOf(Editor.st.p.id) >= 0 && !Editor.st.isNew) UI.toast('This product was just changed in another window. Saving here will replace that change.', { type: 'bad', ms: 7000 });
      await App.reloadProducts(m.ids);
    }
    else if (m.t === 'reload') await App.reloadProducts();
    else if (m.t === 'settings') await App.reloadSettings();
  },
  warn() { if (this.warned) return; this.warned = true; UI.toast('The app is also open in another tab or window. Use one at a time so work isn\'t mixed up.', { type: 'bad', ms: 9000 }); }
};

/* ---------- shared UI components ---------- */
const UI = {
  toast(msg, o = {}) {
    let wrap = $('#toasts'); if (!wrap) { wrap = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(wrap); }
    const t = h('div', { class: 'toast ' + (o.type || '') }, o.icon ? icon(o.icon) : null, h('span', null, msg),
      o.action ? h('button', { class: 'toast-act', onclick: () => { o.action.fn(); t.remove(); } }, o.action.label) : null);
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, o.ms || (o.action ? 6000 : 3200));
  },
  modal({ title, body, actions = [], wide = false, onClose, dismissible = true, cls = '' }) {
    const back = h('div', { class: 'modal-back' });
    const close = (v) => { back.classList.add('out'); setTimeout(() => back.remove(), 180); document.removeEventListener('keydown', onKey); onClose && onClose(v); };
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
    const box = h('div', { class: 'modal ' + (wide ? 'wide ' : '') + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
      title ? h('div', { class: 'modal-head' }, h('h2', null, title), dismissible ? h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, icon('x')) : null) : null,
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' }, actions.map(a => h('button', { class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'), onclick: async () => { const r = a.onClick ? await a.onClick() : undefined; if (r !== false) close(a.value); } }, a.icon ? icon(a.icon) : null, a.label))) : null);
    back.appendChild(box);
    back.addEventListener('click', (e) => { if (e.target === back && dismissible) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    setTimeout(() => { const f = box.querySelector('input,select,textarea,button.primary'); if (f && !ENV.touch) f.focus(); }, 30);
    return { close, el: box };
  },
  confirm(title, text, okLabel = 'OK', danger = false) {
    return new Promise(res => {
      UI.modal({ title, body: h('p', { class: 'muted' }, text), onClose: (v) => res(v === true),
        actions: [{ label: 'Cancel', value: false }, { label: okLabel, primary: !danger, danger, value: true }] });
    });
  },
  sheet(title, items) {
    const back = h('div', { class: 'sheet-back' });
    const close = () => { back.classList.add('out'); setTimeout(() => back.remove(), 200); };
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-grip' }), title ? h('h3', null, title) : null,
      items.map(it => it.sep ? h('div', { class: 'sheet-sep' }) : h('button', { class: 'sheet-item' + (it.primary ? ' primary' : ''), onclick: () => { close(); it.onClick && it.onClick(); } },
        h('span', { class: 'si-ic' }, icon(it.icon || 'chev')), h('span', { class: 'si-txt' }, h('b', null, it.label), it.sub ? h('small', null, it.sub) : null))));
    back.appendChild(sheet);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.appendChild(back);
    return { close };
  },
  progress(title, cancellable = false) {
    let cancelled = false;
    const bar = h('div', { class: 'pbar' }, h('i'));
    const txt = h('p', { class: 'muted small' }, 'Starting…');
    const m = UI.modal({ title, dismissible: false, body: h('div', { class: 'progress-body' }, bar, txt),
      actions: cancellable ? [{ label: 'Cancel', onClick: () => { cancelled = true; txt.textContent = 'Stopping…'; return false; } }] : [] });
    return {
      set(frac, text) { if (frac !== null && frac !== undefined) { bar.firstChild.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; bar.classList.remove('indet'); } else bar.classList.add('indet'); if (text) txt.textContent = text; },
      close: () => m.close(), get cancelled() { return cancelled; }
    };
  },
  field(label, input, hint) { return h('label', { class: 'field' }, h('span', { class: 'f-label' }, label), input, hint ? h('small', { class: 'f-hint' }, hint) : null); },
  toggle(label, checked, onChange, hint) {
    const inp = h('input', { type: 'checkbox', role: 'switch', checked, onchange: e => onChange(e.target.checked) });
    return h('label', { class: 'toggle' }, h('span', { class: 'tg-txt' }, h('span', null, label), hint ? h('small', null, hint) : null), inp, h('i', { class: 'tg-ui', 'aria-hidden': 'true' }));
  },
  seg(options, value, onChange, cls = '') {
    const wrap = h('div', { class: 'seg ' + cls, role: 'radiogroup' });
    const draw = (v) => { clear(wrap); options.forEach(o => wrap.appendChild(h('button', { class: 'seg-btn' + (o.value === v ? ' on' : ''), role: 'radio', 'aria-checked': String(o.value === v), title: o.title || '', onclick: () => { draw(o.value); onChange(o.value); } }, o.icon ? icon(o.icon) : null, o.label))); };
    draw(value);
    wrap.set = draw;
    return wrap;
  },
  slider(label, value, min, max, onInput, fmt) {
    const out = h('output', null, fmt ? fmt(value) : String(value));
    const inp = h('input', { type: 'range', min, max, value, step: 1, oninput: e => { out.textContent = fmt ? fmt(+e.target.value) : e.target.value; onInput(+e.target.value, false); }, onchange: e => onInput(+e.target.value, true) });
    return h('label', { class: 'slider' }, h('span', { class: 'sl-head' }, h('span', null, label), out), inp);
  },
  async share(files, title, text) {
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title, text }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'aborted'; LOG.add('warn', 'share failed', e && e.message); }
    return 'unsupported';
  },
  download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
  },
  open(blob) { const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) UI.download(blob, 'catalogue.pdf'); setTimeout(() => URL.revokeObjectURL(url), 120000); },
  pickFiles({ accept = 'image/*', multiple = false, capture = false } = {}) {
    return new Promise(res => {
      const inp = h('input', { type: 'file', accept, style: 'position:fixed;left:-999px;top:0;opacity:0' });
      if (multiple) inp.multiple = true;
      if (capture) inp.setAttribute('capture', 'environment');
      // Never guess "cancelled" from focus changes: on Android the camera can hand the photo back late.
      inp.onchange = () => { res(Array.from(inp.files || [])); setTimeout(() => inp.remove(), 1000); };
      inp.addEventListener('cancel', () => { res([]); setTimeout(() => inp.remove(), 1000); });
      document.body.appendChild(inp); inp.click();
    });
  }
};
function renderSaveState(el) {
  clear(el);
  if (!App.persistentOK) { el.className = 'savestate bad'; el.append(icon('alert'), 'Not saving on this phone'); el.title = 'This browser is not letting the app save. Open the website link in Chrome or Safari.'; return; }
  el.className = 'savestate ok'; el.append(h('i', { class: 'dot' }), App.products.length ? 'Saved on this phone' : 'Ready');
}
