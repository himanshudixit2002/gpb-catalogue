/* ===================== 24 · Settings, backup/restore, help ===================== */
const SettingsView = {
  async render(main) {
    const S = App.S, b = S.biz;
    const save = () => App.saveSettings();
    const bizField = (k, label, attrs = {}) => UI.field(label, h('input', Object.assign({ type: 'text', value: b[k] || '', oninput: e => { b[k] = e.target.value.trim(); save(); } }, attrs)));
    const logoBox = h('div', { class: 'logo-prev' });
    const drawLogo = () => {
      clear(logoBox);
      if (!App.logo) { logoBox.append(h('div', { class: 'logo-empty' }, icon('image'), h('span', null, 'No logo yet'))); return; }
      const u = URL.createObjectURL(App.logo.blob);
      logoBox.append(h('div', { class: 'lp light' }, h('img', { src: u, alt: 'Logo on light page' })), h('div', { class: 'lp dark' }, h('img', { src: u, alt: 'Logo on dark page' })));
    };
    drawLogo();
    const uploadLogo = async (fileOrNull) => {
      const f = fileOrNull || (await UI.pickFiles({ accept: 'image/*' }))[0];
      if (!f) return;
      try {
        const orig = f instanceof Blob ? f : null;
        if (orig && !fileOrNull) await DB.putBlob(orig, 'logo-orig');
        const r = await IMG.processLogo(f, S.logoMode);
        await App.setLogoBlob(r.blob);
        drawLogo();
        UI.toast(r.removed ? 'Logo added, background removed' : 'Logo added', { icon: 'check' });
      } catch (e) { UI.toast(e.message || 'Could not use that image', { type: 'bad' }); }
    };
    const fieldsBox = h('div', { class: 'fields-list' });
    const drawFields = () => {
      clear(fieldsBox);
      S.fields.forEach((f, i) => {
        fieldsBox.appendChild(h('div', { class: 'frow' + (f.on ? '' : ' off') },
          h('div', { class: 'fr-move' },
            h('button', { class: 'icon-btn small', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [S.fields[i - 1], S.fields[i]] = [S.fields[i], S.fields[i - 1]]; save(); drawFields(); } }, icon('up')),
            h('button', { class: 'icon-btn small', 'aria-label': 'Move down', disabled: i === S.fields.length - 1, onclick: () => { [S.fields[i + 1], S.fields[i]] = [S.fields[i], S.fields[i + 1]]; save(); drawFields(); } }, icon('down'))),
          h('div', { class: 'fr-main' },
            h('input', { type: 'text', class: 'fr-label', value: f.label, 'aria-label': 'Field name', oninput: e => { f.label = e.target.value; save(); } }),
            h('div', { class: 'fr-opts' },
              h('select', { 'aria-label': 'Look', onchange: e => { f.style = e.target.value; save(); } }, [['title', 'Big and bold'], ['brand', 'Small capitals'], ['meta', 'Normal'], ['price', 'Price'], ['custom', 'Normal with name']].map(([v, l]) => h('option', { value: v, selected: f.style === v }, l))),
              h('label', { class: 'mini' }, h('input', { type: 'checkbox', checked: f.showLabel, onchange: e => { f.showLabel = e.target.checked; save(); } }), ' Show "' + (f.label || 'name') + '"'))),
          h('div', { class: 'fr-side' },
            h('label', { class: 'switch-sm', title: f.on ? 'Shown in PDF' : 'Hidden in PDF' }, h('input', { type: 'checkbox', checked: f.on, 'aria-label': 'Show in PDF', onchange: e => { f.on = e.target.checked; save(); drawFields(); } }), h('i')),
            f.builtin ? null : h('button', { class: 'icon-btn small', 'aria-label': 'Delete field', onclick: async () => { if (await UI.confirm('Delete this field?', 'Values already typed stay in your products but are no longer shown.', 'Delete', true)) { S.fields.splice(i, 1); save(); drawFields(); } } }, icon('trash')))));
      });
      fieldsBox.appendChild(h('button', { class: 'btn ghost small', onclick: () => { const label = 'New detail'; S.fields.push({ key: 'c_' + uid().slice(0, 6), label, on: true, showLabel: true, style: 'custom' }); save(); drawFields(); } }, icon('plus'), 'Add a detail field'));
    };
    drawFields();
    const storage = h('div', { class: 'storage' });
    const drawStorage = async () => {
      const est = await DB.estimate(), persisted = await DB.isPersisted();
      clear(storage);
      if (est && est.quota) {
        const frac = est.usage / est.quota;
        storage.append(h('div', { class: 'pbar' + (frac > 0.8 ? ' warn' : '') }, h('i', { style: { width: Math.max(2, Math.round(frac * 100)) + '%' } })),
          h('p', { class: 'small muted' }, `${bytesFmt(est.usage)} used of about ${bytesFmt(est.quota)} this browser allows.`));
        Banners.storageLow = frac > 0.85;
      }
      appendKids(storage, [h('p', { class: 'small ' + (persisted ? 'okline' : 'muted') }, persisted ? 'Protected: the browser will not clear this data on its own.' : 'Not protected yet: if the phone runs out of space, the browser may clear it.'),
        persisted ? null : h('button', { class: 'btn small ghost', onclick: async () => { const ok = await DB.askPersist(); UI.toast(ok ? 'Data protected' : 'The browser said no. Installing the app to the home screen usually helps.'); drawStorage(); } }, icon('shield'), 'Protect my data')]);
    };
    drawStorage();

    const content = h('div', { class: 'settings' },
      h('section', { class: 'panel' }, h('h3', null, 'Your business'),
        h('p', { class: 'small muted' }, 'Shown on the cover and at the foot of every page. Leave out anything you do not want printed.'),
        bizField('name', 'Shop or company name', { autocomplete: 'organization' }),
        bizField('tagline', 'One line about you', { placeholder: 'e.g. Kitchenware wholesale since 1987' }),
        h('div', { class: 'row2' }, bizField('phone', 'Phone', { inputmode: 'tel', autocomplete: 'tel' }), bizField('whatsapp', 'WhatsApp number', { inputmode: 'tel', placeholder: '10-digit mobile' })),
        h('div', { class: 'row2' }, bizField('email', 'Email', { inputmode: 'email', autocomplete: 'email' }), bizField('website', 'Website', { inputmode: 'url', placeholder: 'yourshop.in' })),
        bizField('address', 'Address', { autocomplete: 'street-address' }),
        bizField('gstin', 'GSTIN (optional)')),
      h('section', { class: 'panel' }, h('h3', null, 'Logo'),
        h('p', { class: 'small muted' }, 'Printed whole at the top right of every page. A logo on a white or plain background has that background removed.'),
        logoBox,
        UI.field('Background', UI.seg([{ value: 'global', label: 'Remove' }, { value: 'connected', label: 'Only outside' }, { value: 'keep', label: 'Keep' }], S.logoMode, async v => { S.logoMode = v; save(); const o = await DB.getBlob('logo-orig'); if (o) await uploadLogo(o); }), '"Only outside" keeps white parts inside the logo.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary small', onclick: () => uploadLogo() }, icon('image'), App.logo ? 'Change logo' : 'Add logo'),
          App.logo ? h('button', { class: 'btn ghost small', onclick: async () => { await App.setLogoBlob(null); await DB.delBlob('logo-orig'); drawLogo(); } }, 'Remove') : null)),
      h('section', { class: 'panel' }, h('h3', null, 'Product details'),
        h('p', { class: 'small muted' }, 'These appear under each photo, centred, in this order. Empty ones are skipped for that product.'),
        fieldsBox),
      h('section', { class: 'panel' }, h('h3', null, 'Photos'),
        UI.field('Background removal for new photos', UI.seg([{ value: 'quick', label: 'Quick' }, { value: 'ai', label: 'AI' }, { value: 'none', label: 'Keep' }], S.photo.bg, v => { S.photo.bg = v; save(); }), 'Quick is instant. AI is better on busy shelves and downloads once.'),
        UI.field('AI download', UI.seg([{ value: 'fast', label: 'Smaller, about 40 MB' }, { value: 'best', label: 'Best, about 80 MB' }], S.photo.aiQuality, v => { S.photo.aiQuality = v; save(); })),
        h('button', { class: 'btn ghost small', onclick: async () => { const pg = UI.progress('Getting AI ready'); try { await AI.load(x => pg.set(null, x.text)); const c = IMG.canvas(64, 64); c.getContext('2d').fillRect(16, 16, 32, 32); await AI.mask(c, S.photo.aiQuality, x => pg.set(x.total ? x.cur / x.total : null, x.text)); pg.close(); UI.toast('AI is ready on this phone', { icon: 'check' }); } catch (e) { pg.close(); UI.toast('AI could not load: ' + e.message, { type: 'bad', ms: 8000 }); } } }, icon('cloud'), 'Download AI now (use Wi-Fi)'),
        UI.toggle('Keep original photos', S.photo.keepSource, v => { S.photo.keepSource = v; save(); }, 'Needed to re-frame later. Turn off to save space.')),
      h('section', { class: 'panel' }, h('h3', null, 'This phone'),
        UI.field('Your name (optional)', h('input', { type: 'text', value: S.staff || '', placeholder: 'Shown in backups so the owner knows who sent them', oninput: e => { S.staff = e.target.value; save(); } })),
        UI.field('App link', h('input', { type: 'url', value: S.appUrl || '', placeholder: 'https://yourshop.in/catalogue.html', oninput: e => { S.appUrl = e.target.value.trim(); save(); } }), 'The web address staff should open. Shown if someone opens a saved copy by mistake.'),
        h('button', { class: 'btn ghost small', onclick: async () => {
          const url = S.appUrl || (location.protocol.startsWith('http') ? location.href.split('#')[0] : '');
          if (!url) { UI.toast('Open the app from your website first, then send the link.'); return; }
          const text = 'Open our catalogue app here, then add it to your home screen: ' + url;
          try { if (navigator.share) { await navigator.share({ title: 'Catalogue Maker', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(url); UI.toast('Link copied. Paste it in WhatsApp.'); } catch (e) { UI.toast(url, { ms: 9000 }); }
        } }, icon('share'), 'Send the app link to staff'),
        h('p', { class: 'small muted' }, 'Always send the link, never the file itself: a forwarded file opens without saving or sharing.'),
        storage,
        h('div', { class: 'btn-row wrap' },
          h('button', { class: 'btn primary small', onclick: () => Backup.create() }, icon('shield'), 'Back up everything'),
          h('button', { class: 'btn ghost small', onclick: () => Backup.restore() }, icon('cloud'), 'Restore or merge'),
          h('button', { class: 'btn ghost small', onclick: () => CsvImport.exportCSV() }, icon('download'), 'Product list (CSV)'),
          h('button', { class: 'btn ghost small', onclick: () => CsvImport.run() }, icon('file'), 'Import CSV')),
        h('p', { class: 'small muted' }, App.S.lastBackup ? 'Last backup: ' + niceDate(new Date(App.S.lastBackup)) : 'No backup yet.')),
      h('section', { class: 'panel' }, h('h3', null, 'Help'),
        h('div', { class: 'help-links' },
          h('button', { class: 'hl', onclick: () => Help.photoTips() }, icon('camera'), 'Taking good product photos'),
          h('button', { class: 'hl', onclick: () => Help.install() }, icon('grid'), 'Put the app on the home screen'),
          h('button', { class: 'hl', onclick: () => Help.sharing() }, icon('whatsapp'), 'Sharing PDFs and opening the app'),
          h('button', { class: 'hl', onclick: () => Help.team() }, icon('layers'), 'Working with several staff phones'),
          h('button', { class: 'hl', onclick: () => Help.diagnostics() }, icon('info'), 'Diagnostics')),
        h('p', { class: 'small muted' }, `${APP.name} ${APP.version}. Works offline; photos never leave this phone unless you share them.`)),
      h('section', { class: 'panel danger-zone' }, h('h3', null, 'Start over'),
        h('button', { class: 'btn danger small', onclick: async () => {
          if (!(await UI.confirm('Delete everything on this phone?', `All ${App.products.length} products, photos, logo and settings will be removed. Make a backup first if you might need them.`, 'Delete everything', true))) return;
          await DB.clear('products'); await DB.clear('blobs'); await DB.clear('kv');
          location.reload();
        } }, icon('trash'), 'Delete all data')));
    clear(main).append(h('header', { class: 'top' }, h('div', { class: 'top-row' }, h('span', { class: 'top-mark' }, icon('gear')), h('div', { class: 'top-title' }, h('h1', null, 'Settings'), h('span', { id: 'savestate', class: 'savestate' })))), content);
    renderSaveState($('#savestate'));
  }
};

const Backup = {
  async create() {
    if (!App.products.length && !App.logo) { UI.toast('Nothing to back up yet'); return; }
    const prog = UI.progress('Making a backup');
    await Wake.on();
    try {
      const files = [];
      const blobIds = [];
      for (const p of App.products) for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) blobIds.push(p.img[k]);
      for (const k of ['logo', 'logo-orig']) blobIds.push(k);
      const manifest = { app: APP.name, version: APP.version, createdAt: new Date().toISOString(), staff: App.S.staff || '', settings: App.S, sticky: App.stickyValues, products: App.products };
      files.push({ name: 'manifest.json', data: JSON.stringify(manifest) });
      let i = 0;
      for (const id of blobIds) {
        const b = await DB.getBlob(id);
        if (b) files.push({ name: 'blobs/' + id, data: b });
        if (++i % 20 === 0) { prog.set(i / blobIds.length * 0.5, `Collecting photos ${i} of ${blobIds.length}`); await yieldUI(); }
      }
      const zip = await ZIP.write(files, (d, n) => prog.set(0.5 + d / n * 0.5, `Packing ${d} of ${n}`));
      const name = `catalogue-backup-${safeFileName(App.S.staff || App.S.biz.name || 'phone')}-${fileStamp()}-${App.products.length}-products.zip`;
      prog.close();
      const file = new File([zip], name, { type: 'application/zip' });
      const done = () => { App.S.lastBackup = Date.now(); App.saveSettings(); Banners.dismissed.add('backup'); };
      UI.modal({ title: 'Backup ready', body: h('div', null, h('p', null, `${App.products.length} products, ${bytesFmt(zip.size)}.`), h('p', { class: 'small muted' }, 'Keep it somewhere other than this phone: Google Drive, email to yourself, or send it to the owner on WhatsApp. To restore or combine, open Settings → Restore or merge on any phone.')),
        actions: [{ label: 'Download', icon: 'download', onClick: () => { UI.download(zip, name); done(); return false; } }, ENV.canShareFiles ? { label: 'Share', icon: 'share', primary: true, onClick: async () => { const r = await UI.share([file], 'Catalogue backup'); if (r === 'shared') done(); else if (r === 'unsupported') { UI.download(zip, name); done(); } return false; } } : { label: 'Done', primary: true }] });
    } catch (e) { prog.close(); LOG.add('error', 'backup failed', e && e.message); UI.toast('Backup failed: ' + e.message, { type: 'bad', ms: 8000 }); }
    finally { await Wake.off(); }
  },
  async restore() {
    const [f] = await UI.pickFiles({ accept: '.zip,application/zip,application/x-zip-compressed' });
    if (!f) return;
    let entries, manifest;
    try {
      entries = await ZIP.read(f);
      const m = entries.find(e => e.name === 'manifest.json');
      if (!m) throw new Error('This zip is not a catalogue backup');
      manifest = JSON.parse(await m.text());
    } catch (e) { UI.toast(e.message || 'Could not read the backup', { type: 'bad' }); return; }
    const n = (manifest.products || []).length;
    let mode = 'merge';
    const ok = await new Promise(res => UI.modal({ title: 'Restore backup', onClose: v => res(v === true),
      body: h('div', null, h('p', null, `${n} products${manifest.staff ? ' from ' + manifest.staff : ''}, made ${manifest.createdAt ? niceDate(new Date(manifest.createdAt)) : 'earlier'}.`),
        UI.seg([{ value: 'merge', label: 'Add to this phone' }, { value: 'replace', label: 'Replace everything' }], 'merge', v => { mode = v; }),
        h('p', { class: 'small muted' }, 'Add keeps your products and adds new ones; where the same product exists, the newer version wins. Use this to combine work from several staff phones.')),
      actions: [{ label: 'Cancel', value: false }, { label: 'Restore', primary: true, value: true }] }));
    if (!ok) return;
    const prog = UI.progress('Restoring');
    App.busy++;
    await Wake.on();
    try {
      // 1) write everything from the backup first; nothing on this phone is removed until that has succeeded
      const blobs = new Map(entries.filter(e => e.name.startsWith('blobs/')).map(e => [e.name.slice(6), e]));
      const incoming = (manifest.products || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const localMax = mode === 'merge' ? App.products.reduce((m, p) => Math.max(m, p.order || 0), 0) : 0;
      const replacedBlobs = [];
      let added = 0, updated = 0, i = 0, nextOrder = localMax;
      for (const p of incoming) {
        const local = mode === 'merge' ? App.byId.get(p.id) : null;
        if (local && (local.updatedAt || 0) >= (p.updatedAt || 0)) { i++; continue; }
        for (const k of ['src', 'mask', 'out', 'thumb']) {
          const id = p.img && p.img[k]; if (!id) continue;
          const e = blobs.get(id); if (!e) { p.img[k] = null; continue; }
          await DB.putBlob(await e.blob(k === 'thumb' ? 'image/jpeg' : ''), id);
        }
        if (local) {
          p.order = local.order; // keep its place on this phone
          for (const k of ['src', 'mask', 'out', 'thumb']) if (local.img && local.img[k] && local.img[k] !== (p.img && p.img[k])) replacedBlobs.push(local.img[k]);
          updated++;
        } else {
          if (mode === 'merge') p.order = ++nextOrder; // new products go after this phone's own, in their original order
          added++;
        }
        await DB.put('products', p);
        if (++i % 10 === 0) { prog.set(i / Math.max(1, n), `Product ${i} of ${n}`); await yieldUI(); }
      }
      if (mode === 'replace' || !App.logo) for (const k of ['logo', 'logo-orig']) { const e = blobs.get(k); if (e) await DB.putBlob(await e.blob('image/png'), k); }
      if (mode === 'replace' && manifest.settings) await DB.setKV('settings', manifest.settings);
      else if (manifest.settings && manifest.settings.fields) {
        for (const f of manifest.settings.fields) if (!App.S.fields.find(x => x.key === f.key)) App.S.fields.push(f);
        if (!App.S.biz.name && manifest.settings.biz) App.S.biz = manifest.settings.biz;
        await DB.setKV('settings', App.S);
      }
      // 2) only now clean up: replaced photos, and (for "Replace everything") whatever the backup doesn't contain
      prog.set(null, 'Tidying up…');
      if (replacedBlobs.length) await DB.delMany('blobs', replacedBlobs);
      if (mode === 'replace') {
        const keepIds = new Set(incoming.map(p => p.id));
        const allProducts = await DB.all('products');
        await DB.delMany('products', allProducts.filter(p => !keepIds.has(p.id)).map(p => p.id));
        const used = new Set(['logo', 'logo-orig']);
        for (const p of incoming) for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) used.add(p.img[k]);
        const keys = await DB.allKeys('blobs');
        await DB.delMany('blobs', keys.filter(k => !used.has(k)));
      }
      prog.close();
      await App.load();
      Sync.post({ t: 'reload' }); Sync.post({ t: 'settings' });
      go('products');
      UI.toast(mode === 'replace' ? `Restored ${n} products` : `Added ${added}, updated ${updated}`, { icon: 'check', ms: 5000 });
    } catch (e) {
      prog.close(); LOG.add('error', 'restore failed', e && e.message);
      UI.toast('Restore stopped: ' + e.message + '. Nothing on this phone was removed.', { type: 'bad', ms: 9000 });
      try { await App.load(); go('products'); } catch (e2) { }
    }
    finally { App.busy = Math.max(0, App.busy - 1); await Wake.off(); }
  }
};

const Help = {
  show(title, items, extra) {
    UI.modal({ title, body: h('div', { class: 'help' }, items.map(([t, d]) => h('div', { class: 'help-item' }, h('b', null, t), h('p', null, d))), extra || null), actions: [{ label: 'Got it', primary: true }] });
  },
  photoTips() {
    Help.show('Taking good product photos', [
      ['Use a plain background', 'A wall, a white sheet or chart paper behind the product gives a clean cut-out instantly. Busy shelves need the AI option.'],
      ['Fill the frame', 'The product should take up most of the photo, with a little space around it.'],
      ['Shoot straight on', 'Hold the phone level with the front of the product. If you can\'t, drag the four corners onto the front and the app straightens it.'],
      ['Good light, no glare', 'Daylight from a window is best. Tilt shiny boxes slightly so the light does not reflect into the camera.'],
      ['Hold steady', 'Tap the screen on the product to focus, then take the photo. Blurry photos are flagged.'],
      ['One product per photo', 'For sets, photograph them together and treat them as one product.']
    ]);
  },
  install() {
    Help.show('Put the app on the home screen', [
      ['Android (Chrome)', 'Open the app link in Chrome, tap ⋮ at the top right, then "Add to Home screen" or "Install app".'],
      ['iPhone (Safari)', 'Open the link in Safari, tap the Share button, then "Add to Home Screen".'],
      ['Why it matters', 'The icon always opens the same place, so your products are always there. It also helps protect your data from being cleared.']
    ], App.deferredInstall ? h('button', { class: 'btn primary', onclick: async () => { App.deferredInstall.prompt(); App.deferredInstall = null; } }, 'Install now') : null);
  },
  sharing() {
    Help.show('Sharing PDFs and opening the app', [
      ['Sharing the PDF', 'After "Create PDF", tap Share and pick WhatsApp. On older phones use Download, then attach the file from Downloads in WhatsApp.'],
      ['Big catalogues', 'Choose "Small" quality, or split into files of 250 or 500 products. Each file then opens quickly on any phone.'],
      ['Opening the app', 'Always open the website link (or the home-screen icon). Do not open a copy of the app file saved from WhatsApp: phones open those in a viewer that cannot save work or share files.'],
      ['Same browser every time', 'Products are saved inside the browser you use. Work done in Chrome does not appear in another browser or inside WhatsApp\'s own browser.']
    ]);
  },
  team() {
    Help.show('Working with several staff phones', [
      ['Each phone keeps its own products', 'There is no account or server, so nothing is shared automatically.'],
      ['Combine work', 'Each staff member taps "Back up everything" and sends the file to the owner on WhatsApp. The owner opens Settings → Restore or merge → "Add to this phone" for each file.'],
      ['Same look for everyone', 'Set up logo, business details and fields on one phone, back up, and restore that backup on each staff phone before they start.'],
      ['10,000+ products', 'Import the product list from Excel (CSV) once, then add photos. Name photo files by product code and choose many at once: they attach to the right products automatically.']
    ]);
  },
  diagnostics() {
    const info = [`${APP.name} ${APP.version}`, navigator.userAgent, `Protocol: ${location.protocol}`, `Saving: ${App.persistentOK ? 'yes' : 'NO (memory only)'}`, `Products: ${App.products.length}`, `Share files: ${ENV.canShareFiles}`, `Compression: ${ENV.compression}`, `WebP: ${IMG.supportsWebP}`, `AI: ${AI.mod ? 'loaded ' + AI.url : AI.failed || 'not loaded'}`, '', LOG.text()].join('\n');
    UI.modal({ title: 'Diagnostics', wide: true, body: h('pre', { class: 'pre' }, info), actions: [{ label: 'Copy', primary: true, onClick: async () => { try { await navigator.clipboard.writeText(info); UI.toast('Copied'); } catch (e) { UI.toast('Select the text and copy it'); } return false; } }, { label: 'Close' }] });
  }
};
