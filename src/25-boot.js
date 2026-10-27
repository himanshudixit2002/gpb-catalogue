/* ===================== 25 · Shell, navigation, start-up ===================== */
function go(view) {
  if (Editor.st && view) { /* editor overlays everything; switching views closes nothing */ }
  App.view = view;
  const main = $('#main');
  $$('.nav-btn').forEach(b => { const on = b.dataset.view === view; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  if (view === 'products') ProductsView.render(main);
  else if (view === 'catalogue') CatalogueView.render(main);
  else if (view === 'settings') SettingsView.render(main);
  main.focus({ preventScroll: true });
}

function buildShell() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' },
    h('div', { class: 'nav-brand' }, h('span', { class: 'tag' }, '₹'), h('b', null, 'Catalogue Maker')),
    h('button', { class: 'nav-btn', dataset: { view: 'products' }, onclick: () => go('products') }, icon('grid'), h('span', null, 'Products')),
    h('button', { class: 'snap', 'aria-label': 'Add products', onclick: () => Add.sheet() }, icon('camera'), h('span', { class: 'snap-label' }, 'Add')),
    h('button', { class: 'nav-btn', dataset: { view: 'catalogue' }, onclick: () => go('catalogue') }, icon('book'), h('span', null, 'Catalogue')),
    h('button', { class: 'nav-btn side-only', dataset: { view: 'settings' }, onclick: () => go('settings') }, icon('gear'), h('span', null, 'Settings')));
  document.body.append(h('a', { class: 'skip', href: '#main' }, 'Skip to content'), h('main', { id: 'main', tabindex: '-1' }), nav);
}

/* ---------- installing the app on a phone ---------- */
const Install = {
  prompt: null,
  init() {
    // listen from the very start: the browser can offer installing before the app has finished loading
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; App.deferredInstall = e; this.refresh(); });
    window.addEventListener('appinstalled', () => { this.prompt = null; App.deferredInstall = null; if (App.S) UI.toast('Installed. Open the app from your home screen from now on.', { icon: 'check', ms: 6000 }); this.refresh(); });
  },
  refresh() { if (App.S && App.view === 'products' && !Editor.st && $('#main')) ProductsView.render($('#main')); },
  /** Worth offering: not already installed, served from the website, and the phone can install it. */
  can() { return !ENV.standalone && location.protocol === 'https:' && (!!this.prompt || ENV.isIOS); },
  async run() {
    if (!this.prompt) { Help.install(); return; }
    const p = this.prompt; this.prompt = null; App.deferredInstall = null;
    try { p.prompt(); await p.userChoice; } catch (e) { LOG.add('warn', 'install prompt failed', e && e.message); }
    this.refresh();
  }
};
Install.init();

/* ---------- offline support and update notice (service worker from the website) ---------- */
function startServiceWorker() {
  // only the website build has a service worker (the single-file copy works without one)
  if (typeof SITE === 'undefined' || SITE.build !== 'site') return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let told = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version took over: tell the user, let them reload when it suits them
    if (!hadController || told) return;
    told = true;
    UI.toast('A new version of the app is ready.', { icon: 'zap', ms: 15 * 60e3, action: { label: 'Reload', fn: () => location.reload() } });
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    LOG.add('info', 'offline support on');
    let last = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60e3) { last = Date.now(); reg.update().catch(() => { }); }
    });
  }).catch(() => { /* no sw.js next to the page (single-file copy): fine */ });
}

/* ---------- links that open the app: shortcuts (?action=) and shared files (?share=) ---------- */
function handleLaunch() {
  const q = new URLSearchParams(location.search);
  const share = q.get('share'), action = q.get('action');
  if ([...q.keys()].length) history.replaceState(history.state, '', location.pathname + location.hash);
  if (share) {
    Inbox.take(share).then(files => {
      if (files.length) Add.receive(files);
      else UI.toast('Nothing arrived from the other app. Try sharing again.', { type: 'bad' });
    }).catch(e => { LOG.add('error', 'shared files could not be read', e && e.message); UI.toast('Could not read the shared files.', { type: 'bad' }); });
  } else if (action === 'add') Add.sheet();
  else if (action === 'catalogue') go('catalogue');
}

/* ---------- drop photos, a CSV list or a backup onto the window (computers) ---------- */
function enableDrop() {
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
  document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length || Editor.st || !Presence.active) return;
    Add.receive(files);
  });
}

async function boot() {
  const splash = $('#splash');
  try {
    await Fonts.init();
    await App.load();
  } catch (e) {
    LOG.add('error', 'boot failed', e && e.stack);
    if (splash) splash.innerHTML = '<p style="padding:24px;font:15px system-ui">The app could not start: ' + (e && e.message) + '</p>';
    return;
  }
  buildShell();
  Sync.init();
  Presence.init();
  // save pending settings when the app is hidden or closed (phones often kill background tabs)
  const flush = () => { try { App.saveSettings.flush(); } catch (e) { } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  // settings gear on phones lives in the products/catalogue headers; add to products header too
  App.listeners.add(() => {
    if (Editor.st) return;
    if (App.view === 'products') {
      const hasGrid = ProductsView.grid && document.body.contains(ProductsView.grid);
      if (!hasGrid || !App.products.length || ProductsView.statusSig() !== ProductsView.sig) ProductsView.render($('#main'));
      else { ProductsView.refresh(); const st = $('.stats'); if (st) st.replaceWith(StatsStrip.render()); renderSaveState($('#savestate')); }
    } else if (App.view === 'catalogue') CatalogueView.refresh();
  });
  if (location.protocol.startsWith('http') && !App.S.appUrl && !/^(localhost|127\.|192\.168\.)/.test(location.hostname)) { App.S.appUrl = location.href.split('#')[0].split('?')[0]; App.saveSettings(); }
  enableDrop();
  go('products');
  handleLaunch();
  if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 400); }
  // protect data once there is something worth protecting
  if (App.products.length) DB.askPersist();
  const est = await DB.estimate(); if (est && est.quota && est.usage / est.quota > 0.85) { Banners.storageLow = true; }
  // single-file copy only: an inline manifest so "Add to Home screen" gets a name and icon
  // (the website build links a real manifest.webmanifest and icons instead)
  if ($('#manifest')) try {
    const ic = IMG.canvas(192, 192), x = ic.getContext('2d');
    x.fillStyle = '#1D2340'; x.fillRect(0, 0, 192, 192);
    x.fillStyle = '#FFC93C'; x.beginPath(); x.moveTo(60, 50); x.lineTo(150, 50); x.lineTo(150, 142); x.lineTo(60, 142); x.lineTo(34, 96); x.closePath(); x.fill();
    x.fillStyle = '#1D2340'; x.beginPath(); x.arc(58, 96, 8, 0, Math.PI * 2); x.fill();
    x.font = '700 54px "CM Sans"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('₹', 108, 99);
    const iconUrl = ic.toDataURL('image/png');
    const start = location.href.split('#')[0];
    const manifest = { name: 'Catalogue Maker', short_name: 'Catalogue', start_url: start, scope: start.replace(/[^/]*$/, ''), display: 'standalone', background_color: '#EEF0F5', theme_color: '#1D2340', icons: [{ src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' }] };
    if (location.protocol.startsWith('http')) $('#manifest').href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
    $('#appicon').href = iconUrl;
  } catch (e) { }
  startServiceWorker();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
