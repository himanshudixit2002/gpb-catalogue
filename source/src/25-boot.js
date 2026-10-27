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
  go('products');
  if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 400); }
  // protect data once there is something worth protecting
  if (App.products.length) DB.askPersist();
  const est = await DB.estimate(); if (est && est.quota && est.usage / est.quota > 0.85) { Banners.storageLow = true; }
  // web app manifest (inline) so "Add to Home screen" gets a proper name and icon
  try {
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
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.deferredInstall = e; });
  // optional offline support when sw.js is uploaded next to this file
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then(() => LOG.add('info', 'offline cache on')).catch(() => { });
  }
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
