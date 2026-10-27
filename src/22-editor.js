/* ===================== 22 · Product editor: frame (4 corners), cut-out, look, details ===================== */
const Editor = {
  st: null, el: null,
  STEPS: [['frame', 'Frame', 'frame'], ['cutout', 'Cut-out', 'scissors'], ['look', 'Look', 'sun'], ['details', 'Details', 'tag']],

  async open({ file, product, noPhoto } = {}) {
    if (this.st) await this.close(false, true);
    const isNew = !product;
    const p = product ? JSON.parse(JSON.stringify(product)) : App.newProduct();
    if (isNew) {
      p.draft = true; // stays "Unfinished" until Save
      for (const k of App.S.photo.sticky || []) if (App.stickyValues[k]) p.f[k] = App.stickyValues[k];
    }
    const st = this.st = {
      p, isNew, step: 'frame', started: Date.now(), dirty: false,
      src: null, srcData: null, srcBlob: null, srcChanged: false,
      mask: null, maskKey: '', maskDirty: false, undo: [],
      edit: Object.assign(PIPE.defaultEdit(App.S), p.edit || {}),
      preview: null, autoParams: p.autoParams || null,
      view: { z: 1, tx: 0, ty: 0 }, k: 1, brush: { mode: 'off', size: 26 },
      busy: 0, gen: 0, hasPhoto: false, quality: p.q || null
    };
    st.edit.look = Object.assign(PIPE.defaultEdit(App.S).look, (p.edit && p.edit.look) || {});
    this.build();
    if (!(history.state && history.state.editor)) history.pushState({ editor: true }, '');
    try {
      if (file) await this.loadNewPhoto(file);
      else if (p.img && p.img.src) await this.loadExisting();
      else if (p.img && p.img.out) { st.hasPhoto = true; st.outOnly = true; }
      if (noPhoto || !st.hasPhoto) this.go('details');
      else if (product && !p.draft) this.go('look');
      else this.go('frame');
    } catch (e) {
      LOG.add('error', 'Editor open failed', e && e.message);
      UI.toast(e.message || 'Could not open the photo', { type: 'bad', ms: 7000 });
      if (!st.hasPhoto) this.go('details');
    }
  },
  async loadNewPhoto(file) {
    const st = this.st;
    this.setBusy('Opening photo…');
    try {
      const r = await PIPE.importPhoto(file);
      st.gen++;
      if (st.src) IMG.release(st.src);
      st.src = r.canvas; st.srcBlob = r.blob; st.srcChanged = true; st.quality = r.quality; st.hasPhoto = true;
      st.srcData = IMG.data(st.src);
      st.mask = null; st.maskKey = ''; st.undo = []; st.edit.brushed = false; st.outOnly = false;
      if (st.p.draft) {
        // keep a draft so nothing is lost if the phone kills the page
        const oldSrc = st.p.img && st.p.img.src;
        st.p.q = r.quality;
        st.p.img = Object.assign({}, st.p.img, { src: await DB.putBlob(r.blob), sw: r.canvas.width, sh: r.canvas.height });
        st.p.edit = st.edit;
        await App.saveProduct(st.p);
        if (oldSrc && oldSrc !== st.p.img.src) await DB.delBlob(oldSrc);
        st.srcChanged = false;
      }
      this.setBusy('Finding the product…');
      await nextFrame();
      const ac = await PIPE.autoCorners(st.src, null);
      st.edit.quad = ac.quad; st.edit.persp = ac.boxLike;
      st.autoNote = ac.found ? (ac.boxLike ? 'Corners found. Drag them onto the front corners of the product.' : 'Frame set around the product. Drag the corners to adjust.') : 'Drag the four corners onto the product.';
      st.autoParams = null;
    } finally { this.setBusy(null); }
    this.markDirty();
  },
  async loadExisting() {
    const st = this.st, p = st.p;
    this.setBusy('Opening…');
    try {
      const blob = await DB.getBlob(p.img.src);
      if (!blob) { st.hasPhoto = !!(p.img && p.img.out); st.outOnly = true; return; }
      st.src = await PIPE.sourceCanvas(blob, 0); st.srcData = IMG.data(st.src); st.hasPhoto = true;
      if (p.img.mask) { st.mask = await PIPE.blobToMask(await DB.getBlob(p.img.mask)); st.maskKey = this.maskKey(); }
      if (!st.edit.quad) st.edit.quad = GEOM.fullQuad();
    } finally { this.setBusy(null); }
  },
  maskKey() { const e = this.st.edit; return e.bg + '|' + (e.bg === 'quick' ? e.quad.map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(';') : '') + '|' + e.smooth; },

  /* ---------- DOM ---------- */
  build() {
    const st = this.st;
    const steps = h('nav', { class: 'ed-steps', role: 'tablist' }, this.STEPS.map(([k, l, ic]) => h('button', { class: 'ed-step', role: 'tab', dataset: { step: k }, onclick: () => this.go(k) }, icon(ic), h('span', null, l))));
    this.el = h('div', { class: 'editor', role: 'dialog', 'aria-label': 'Edit product' },
      h('header', { class: 'ed-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Close editor', onclick: () => this.requestClose() }, icon('x')),
        steps,
        h('button', { class: 'btn primary small ed-save', onclick: () => this.save(false) }, 'Save')),
      h('div', { class: 'ed-main' },
        h('div', { class: 'ed-stage', id: 'ed-stage' },
          h('div', { class: 'ed-view', id: 'ed-view' }, h('canvas', { class: 'ed-canvas', id: 'ed-canvas' }),
            h('svg', { class: 'ed-svg', id: 'ed-svg', viewBox: '0 0 10 10', preserveAspectRatio: 'none' }),
            h('div', { class: 'ed-handles', id: 'ed-handles' })),
          h('canvas', { class: 'loupe', id: 'loupe', width: 264, height: 264 }),
          h('div', { class: 'brush-dot', id: 'brush-dot' }),
          h('div', { class: 'ed-note', id: 'ed-note' }),
          h('div', { class: 'ed-empty', id: 'ed-empty' }, h('p', null, 'No photo yet'),
            h('button', { class: 'btn primary', onclick: () => this.addPhoto(true) }, icon('camera'), 'Take photo'),
            h('button', { class: 'btn ghost light', onclick: () => this.addPhoto(false) }, icon('images'), 'Choose photo')),
          h('div', { class: 'ed-busy', id: 'ed-busy' }, h('i', { class: 'spin' }), h('span', null, ''))),
        h('div', { class: 'ed-tray', id: 'ed-tray' })));
    document.body.appendChild(this.el);
    document.body.classList.add('noscroll');
    this.bindStage();
    this._resize = debounce(() => this.layoutStage(), 120);
    window.addEventListener('resize', this._resize);
  },
  setBusy(text, frac) {
    const b = $('#ed-busy'); if (!b) return;
    b.classList.toggle('on', !!text);
    if (text) b.querySelector('span').textContent = text + (frac !== undefined && frac !== null ? ' ' + Math.round(frac * 100) + '%' : '');
  },
  note(text, kind) { const n = $('#ed-note'); if (!n) return; clear(n); clearTimeout(this._noteT); n.className = 'ed-note' + (kind ? ' ' + kind : ''); if (text) { n.append(text); this._noteT = setTimeout(() => { if (n.textContent === text) clear(n); }, 4500); } },
  markDirty() { this.st.dirty = true; this.autosave(); },
  autosave: debounce(async function () {
    const st = Editor.st; if (!st || !st.p || st.saving) return;
    if (!st.p.draft || !Editor.hasContent(st)) return; // finished products only change when Save is pressed
    st.p.edit = st.edit;
    try { await App.saveProduct(st.p); } catch (e) { LOG.add('warn', 'draft autosave failed', e.message); }
  }, 900),
  /** A draft is worth keeping if it has a photo or anything typed beyond the pinned values. */
  hasContent(st) {
    if (st.p.img && st.p.img.src) return true;
    const pinned = new Set(App.S.photo.sticky || []);
    return Object.keys(st.p.f || {}).some(k => st.p.f[k] && !(pinned.has(k) && App.stickyValues[k] === st.p.f[k]));
  },

  go(step) {
    const st = this.st; if (!st) return;
    if (!st.hasPhoto && step !== 'details') { UI.toast('Add a photo first'); step = 'details'; }
    if (st.outOnly && (step === 'frame' || step === 'cutout')) { UI.toast('The original photo was not kept, so only details and look can change. Retake to re-frame.'); step = step === 'frame' ? 'look' : 'look'; }
    st.step = step;
    $$('.ed-step', this.el).forEach(b => { const on = b.dataset.step === step; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.disabled = !st.hasPhoto && b.dataset.step !== 'details'; });
    this.el.dataset.step = step;
    st.view = { z: 1, tx: 0, ty: 0 };
    this.note('');
    this.tray();
    this.layoutStage();
    if (step === 'cutout') this.ensureMask();
    if (step === 'look' || step === 'details') this.renderPreview();
  },
  layoutStage() {
    const st = this.st; if (!st) return;
    const stage = $('#ed-stage'), view = $('#ed-view'), cv = $('#ed-canvas');
    if (!stage) return;
    const showPhoto = st.hasPhoto && !st.outOnly && (st.step === 'frame' || st.step === 'cutout');
    stage.classList.toggle('photo', showPhoto);
    stage.classList.toggle('nophoto', !st.hasPhoto);
    const W = stage.clientWidth, H = stage.clientHeight, pad = 22;
    let iw, ih;
    if (showPhoto) { iw = st.src.width; ih = st.src.height; }
    else if (st.preview) { iw = st.preview.w; ih = st.preview.h; }
    else { iw = 300; ih = 300; }
    const k = Math.min((W - pad * 2) / iw, (H - pad * 2) / ih);
    const dw = Math.max(1, Math.round(iw * k)), dh = Math.max(1, Math.round(ih * k));
    st.k = k; st.disp = { w: dw, h: dh, left: Math.round((W - dw) / 2), top: Math.round((H - dh) / 2) };
    Object.assign(view.style, { width: dw + 'px', height: dh + 'px', left: st.disp.left + 'px', top: st.disp.top + 'px' });
    this.applyView();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr);
    cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
    this.draw();
  },
  applyView() {
    const st = this.st, v = st.view, view = $('#ed-view'); if (!view) return;
    view.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.z})`;
    $$('.handle', view).forEach(hd => { hd.style.setProperty('--inv', 1 / v.z); });
    const svg = $('#ed-svg'); if (svg) svg.style.setProperty('--sw', (1.6 / v.z).toFixed(3));
  },
  draw() {
    const st = this.st; if (!st) return;
    const cv = $('#ed-canvas'), ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const sx = cv.width;
    if (st.step === 'frame' && st.src) {
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(st.src, 0, 0, cv.width, cv.height);
      this.drawQuad();
    } else if (st.step === 'cutout' && st.src) {
      ctx.imageSmoothingQuality = 'high';
      if (st.mask) {
        if (!st.maskCanvas || st.maskCanvas.width !== st.mask.w) this.syncMaskCanvas();
        ctx.drawImage(st.src, 0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(st.maskCanvas, 0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = 'source-over';
      } else ctx.drawImage(st.src, 0, 0, cv.width, cv.height);
      this.drawQuad(true);
    } else if (st.preview) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(st.preview.canvas, 0, 0, cv.width, cv.height);
      clear($('#ed-svg')); clear($('#ed-handles'));
    }
  },
  syncMaskCanvas(rect) {
    const st = this.st, m = st.mask;
    if (!st.maskCanvas || st.maskCanvas.width !== m.w || st.maskCanvas.height !== m.h) { st.maskCanvas = IMG.canvas(m.w, m.h); rect = null; }
    const x0 = rect ? Math.max(0, rect.x0) : 0, y0 = rect ? Math.max(0, rect.y0) : 0, x1 = rect ? Math.min(m.w, rect.x1) : m.w, y1 = rect ? Math.min(m.h, rect.y1) : m.h;
    if (x1 <= x0 || y1 <= y0) return;
    const ctx = st.maskCanvas.getContext('2d'), id = ctx.createImageData(x1 - x0, y1 - y0), d = id.data;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const j = ((y - y0) * (x1 - x0) + (x - x0)) * 4; d[j] = d[j + 1] = d[j + 2] = 0; d[j + 3] = m.data[y * m.w + x]; }
    ctx.putImageData(id, x0, y0);
  },
  quadPx() { const st = this.st; return st.edit.quad.map(p => ({ x: p.x * st.disp.w, y: p.y * st.disp.h })); },
  drawQuad(dimOnly) {
    const st = this.st, svg = $('#ed-svg'), hs = $('#ed-handles');
    const W = st.disp.w, H = st.disp.h;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let q = this.quadPx();
    if (!st.edit.persp) { const b = GEOM.bounds(q); q = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]; }
    const pts = q.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const valid = GEOM.convex(q) && GEOM.area(q) > 100;
    svg.innerHTML = `<path class="dim" fill-rule="evenodd" d="M0 0H${W}V${H}H0Z M${q.map(p => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L')}Z"/>` +
      (dimOnly ? '' : `<polygon class="q-shadow" points="${pts}"/><polygon class="q-line${valid ? '' : ' bad'}" points="${pts}"/>` +
        (st.edit.persp ? '' : '') +
        // thirds guide inside the frame
        [1, 2].map(i => { const a = i / 3; const l = (p1, p2) => ({ x: p1.x + (p2.x - p1.x) * a, y: p1.y + (p2.y - p1.y) * a }); const t = l(q[0], q[1]), b = l(q[3], q[2]), le = l(q[0], q[3]), r = l(q[1], q[2]); return `<line class="q-guide" x1="${t.x}" y1="${t.y}" x2="${b.x}" y2="${b.y}"/><line class="q-guide" x1="${le.x}" y1="${le.y}" x2="${r.x}" y2="${r.y}"/>`; }).join(''));
    clear(hs);
    if (dimOnly) return;
    const raw = this.quadPx();
    raw.forEach((p, i) => {
      const hd = h('div', { class: 'handle', dataset: { i: String(i) }, role: 'slider', tabindex: '0', 'aria-label': ['Top left', 'Top right', 'Bottom right', 'Bottom left'][i] + ' corner' }, h('i'));
      hd.style.left = p.x + 'px'; hd.style.top = p.y + 'px'; hd.style.setProperty('--inv', 1 / st.view.z);
      hd.addEventListener('keydown', e => { const d = e.shiftKey ? 0.01 : 0.002; const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]; if (!m) return; e.preventDefault(); this.moveCorner(i, st.edit.quad[i].x + m[0], st.edit.quad[i].y + m[1]); this.draw(); this.afterFrameChange(); setTimeout(() => { const n = $(`.handle[data-i="${i}"]`); n && n.focus(); }, 0); });
      hs.appendChild(hd);
    });
  },
  moveCorner(i, x, y) {
    const q = this.st.edit.quad; x = clamp(x, -0.02, 1.02); y = clamp(y, -0.02, 1.02);
    if (this.st.edit.persp) { q[i] = { x, y }; return; }
    // rectangle crop: keep axis-aligned
    q[i] = { x, y };
    const opp = (i + 2) % 4, xs = i === 0 || i === 3 ? [x, q[opp].x] : [q[opp].x, x], ys = i < 2 ? [y, q[opp].y] : [q[opp].y, y];
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    this.st.edit.quad = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  },
  afterFrameChange() { this.st.preview = null; this.markDirty(); },

  /* ---------- pointer handling: drag corners, brush, pinch-zoom, pan ---------- */
  bindStage() {
    const stage = $('#ed-stage');
    const ptrs = new Map();
    let mode = null, handleI = -1, pinch = null, last = null, stroke = null, tapT = 0, moved = false, startQuad = null, startPt = null;
    const toDisp = (cx, cy) => { const r = stage.getBoundingClientRect(), st = this.st; return { x: (cx - r.left - st.disp.left - st.view.tx) / st.view.z, y: (cy - r.top - st.disp.top - st.view.ty) / st.view.z }; };
    stage.addEventListener('pointerdown', e => {
      const st = this.st; if (!st || st.busy) return;
      stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (ptrs.size === 2) {
        if (stroke) this.endStroke(stroke); stroke = null; mode = 'pinch'; this.hideLoupe();
        const [a, b] = Array.from(ptrs.values()), r = stage.getBoundingClientRect();
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: st.view.z, tx0: st.view.tx, ty0: st.view.ty, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
        return;
      }
      if (ptrs.size > 2) return;
      const d = toDisp(e.clientX, e.clientY);
      const photo = st.step === 'frame' || st.step === 'cutout';
      if (st.step === 'frame' && photo) {
        // nearest handle within 34 screen px
        const q = this.quadPx(); let best = -1, bd = 34 / st.view.z;
        q.forEach((p, i) => { const dd = Math.hypot(p.x - d.x, p.y - d.y); if (dd < bd) { bd = dd; best = i; } });
        if (best >= 0) { mode = 'handle'; handleI = best; if (navigator.vibrate) navigator.vibrate(8); this.showLoupe(best); e.preventDefault(); return; }
        if (GEOM.pointInQuad(d, q)) { mode = 'moveQuad'; startQuad = st.edit.quad.map(p => ({ ...p })); startPt = d; return; }
      }
      if (st.step === 'cutout' && st.brush.mode !== 'off' && st.mask) { mode = 'brush'; stroke = { last: d, before: st.mask.data.slice() }; this.paint(d, d); return; }
      if (st.view.z > 1.01) { mode = 'pan'; last = { x: e.clientX, y: e.clientY }; }
    });
    stage.addEventListener('pointermove', e => {
      const st = this.st; if (!st) return;
      if (st.step === 'cutout' && st.brush.mode !== 'off') this.brushCursor(e);
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = true;
      if (mode === 'pinch' && ptrs.size >= 2) {
        const [a, b] = Array.from(ptrs.values()), r = stage.getBoundingClientRect();
        const z = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, pinch.d0), 1, 8);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const dx = (pinch.mx - st.disp.left - pinch.tx0) / pinch.z0, dy = (pinch.my - st.disp.top - pinch.ty0) / pinch.z0;
        st.view = this.clampView({ z, tx: mx - st.disp.left - dx * z, ty: my - st.disp.top - dy * z });
        this.applyView(); return;
      }
      const d = toDisp(e.clientX, e.clientY);
      if (mode === 'handle') {
        this.moveCorner(handleI, d.x / st.disp.w, d.y / st.disp.h);
        this.drawQuad(); this.showLoupe(handleI);
      } else if (mode === 'moveQuad') {
        const dx = (d.x - startPt.x) / st.disp.w, dy = (d.y - startPt.y) / st.disp.h;
        st.edit.quad = startQuad.map(p => ({ x: clamp(p.x + dx, -0.02, 1.02), y: clamp(p.y + dy, -0.02, 1.02) }));
        this.drawQuad();
      } else if (mode === 'brush' && stroke) { this.paint(stroke.last, d); stroke.last = d; }
      else if (mode === 'pan') { st.view = this.clampView({ z: st.view.z, tx: st.view.tx + e.clientX - last.x, ty: st.view.ty + e.clientY - last.y }); last = { x: e.clientX, y: e.clientY }; this.applyView(); }
    });
    const up = e => {
      const st = this.st; if (!st) return;
      ptrs.delete(e.pointerId);
      if (mode === 'handle' || mode === 'moveQuad') { this.hideLoupe(); this.afterFrameChange(); }
      if (mode === 'brush' && stroke) { this.endStroke(stroke); stroke = null; }
      if (ptrs.size === 0) {
        if (!moved && mode !== 'handle' && mode !== 'brush') { const now = Date.now(); if (now - tapT < 320) { st.view = { z: 1, tx: 0, ty: 0 }; this.applyView(); } tapT = now; }
        mode = null;
      } else if (mode === 'pinch' && ptrs.size === 1) { mode = st.view.z > 1.01 ? 'pan' : null; const p = Array.from(ptrs.values())[0]; last = { x: p.x, y: p.y }; }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('pointerleave', () => { const b = $('#brush-dot'); if (b) b.style.display = 'none'; });
    stage.addEventListener('wheel', e => {
      const st = this.st; if (!st || !(st.step === 'frame' || st.step === 'cutout')) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const z = clamp(st.view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 8);
      const dx = (mx - st.disp.left - st.view.tx) / st.view.z, dy = (my - st.disp.top - st.view.ty) / st.view.z;
      st.view = this.clampView({ z, tx: mx - st.disp.left - dx * z, ty: my - st.disp.top - dy * z }); this.applyView();
    }, { passive: false });
  },
  clampView(v) {
    const st = this.st;
    if (v.z <= 1.001) return { z: 1, tx: 0, ty: 0 };
    const W = st.disp.w * v.z, H = st.disp.h * v.z, stage = $('#ed-stage'), SW = stage.clientWidth, SH = stage.clientHeight;
    const minTx = SW - st.disp.left - W - 40, maxTx = -st.disp.left + 40, minTy = SH - st.disp.top - H - 40, maxTy = -st.disp.top + 40;
    return { z: v.z, tx: clamp(v.tx, Math.min(minTx, maxTx), Math.max(minTx, maxTx)), ty: clamp(v.ty, Math.min(minTy, maxTy), Math.max(minTy, maxTy)) };
  },
  showLoupe(i) {
    const st = this.st, lp = $('#loupe'); if (!lp || !st.src) return;
    const p = st.edit.quad[i], sx = p.x * st.src.width, sy = p.y * st.src.height;
    const ctx = lp.getContext('2d'), S = lp.width, mag = 3 * Math.max(1, st.k * 2), r = S / 2 / mag;
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.src, sx - r, sy - r, r * 2, r * 2, 0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,201,60,0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 26); ctx.lineTo(S / 2, S / 2 + 26); ctx.moveTo(S / 2 - 26, S / 2); ctx.lineTo(S / 2 + 26, S / 2); ctx.stroke();
    lp.classList.add('on');
    lp.classList.toggle('right', p.x < 0.5 && p.y < 0.45);
  },
  hideLoupe() { const lp = $('#loupe'); if (lp) lp.classList.remove('on'); },
  brushCursor(e) {
    const b = $('#brush-dot'), stage = $('#ed-stage'); if (!b) return;
    const r = stage.getBoundingClientRect(), st = this.st;
    b.style.display = 'block'; const s = st.brush.size * 2;
    Object.assign(b.style, { width: s + 'px', height: s + 'px', left: (e.clientX - r.left - s / 2) + 'px', top: (e.clientY - r.top - s / 2) + 'px' });
    b.className = 'brush-dot ' + st.brush.mode;
  },
  paint(a, b) {
    const st = this.st, m = st.mask; if (!m) return;
    const sc = m.w / st.disp.w;            // display px → mask px
    const R = st.brush.size / st.view.z * sc;
    const val = st.brush.mode === 'restore' ? 255 : 0;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * sc / Math.max(1, R * 0.35)));
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let s = 0; s <= steps; s++) {
      const cx = (a.x + (b.x - a.x) * s / steps) * sc, cy = (a.y + (b.y - a.y) * s / steps) * sc;
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(m.w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(m.h - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / R; if (d > 1) continue;
        const f = d < 0.65 ? 1 : 0.5 + 0.5 * Math.cos((d - 0.65) / 0.35 * Math.PI);
        const i = y * m.w + x, cur = m.data[i];
        m.data[i] = val ? Math.max(cur, Math.round(cur + (255 - cur) * f)) : Math.min(cur, Math.round(cur * (1 - f)));
      }
      bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1 + 1); by1 = Math.max(by1, y1 + 1);
    }
    this.syncMaskCanvas({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); });
  },
  endStroke(stroke) {
    const st = this.st;
    st.undo.push(stroke.before); if (st.undo.length > 12) st.undo.shift();
    st.edit.brushed = true; st.maskDirty = true; st.preview = null;
    this.markDirty(); this.tray();
  },

  /* ---------- computing ---------- */
  async ensureMask(force) {
    const st = this.st; if (!st || !st.src) return;
    const e = st.edit;
    if (e.bg === 'none' && !e.brushed) { st.mask = null; st.maskKey = this.maskKey(); this.draw(); return; }
    if (!force && st.mask && (e.brushed || st.maskKey === this.maskKey())) { this.draw(); return; }
    if (st.busy) { st.pendingMask = true; return; } // one computation at a time; re-checked when it ends
    if (e.bg === 'ai' && !AI.isDownloaded(App.S.photo.aiQuality) && !(await this.confirmAI())) { e.bg = 'quick'; this.tray(); }
    if (this.st !== st) return;
    st.busy++;
    let fellBack = false;
    const progress = (pr) => {
      if (pr.phase === 'download' && pr.total) this.setBusy((pr.text || 'Downloading AI (one time)…').replace(/…$/, ''), pr.cur / pr.total);
      else this.setBusy(pr.text || 'Working…');
    };
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const myGen = st.gen, mode = e.bg, myKey = this.maskKey();
        this.setBusy(mode === 'ai' ? 'Starting AI…' : 'Removing background…');
        try {
          const m = await PIPE.mask(st.src, mode, e.quad, e.smooth, App.S.photo.aiQuality, progress);
          if (this.st !== st) return;
          if (st.gen !== myGen) { LOG.add('info', 'cut-out result dropped: the photo changed meanwhile'); break; }
          st.mask = m; st.maskKey = myKey; st.maskDirty = true; st.undo = []; st.preview = null;
          if (st.maskCanvas) { IMG.release(st.maskCanvas); st.maskCanvas = null; }
          st.autoParams = null;
          break;
        } catch (err) {
          LOG.add('error', 'mask failed', err && err.message);
          if (mode === 'ai' && attempt === 0) {
            UI.toast(navigator.onLine === false && !AI.isDownloaded(App.S.photo.aiQuality) ? 'AI cut-out needs internet the first time. Using Quick for now.' : 'AI cut-out didn\'t work for this photo. Using Quick instead. Details are in Settings → Diagnostics.', { type: 'bad', ms: 7000 });
            e.bg = 'quick'; fellBack = true; continue;
          }
          UI.toast('Background removal failed: ' + (err.message || err), { type: 'bad' });
          break;
        }
      }
    } finally { if (this.st === st) { st.busy = Math.max(0, st.busy - 1); this.setBusy(null); } }
    if (this.st !== st) return;
    this.markDirty();
    if (fellBack || st.step === 'cutout') { this.draw(); this.tray(); }
    if (st.pendingMask) { st.pendingMask = false; if (!e.brushed && (!st.mask || st.maskKey !== this.maskKey())) this.ensureMask(); }
  },
  confirmAI() {
    return UI.confirm('Use AI cut-out?', `AI handles busy showroom backgrounds best. It downloads about ${AI.MB[App.S.photo.aiQuality === 'best' ? 'best' : 'fast']} MB once from your site (use Wi-Fi), then works on this phone, even offline. Each photo takes a few seconds, longer on older phones.`, 'Download and use AI');
  },
  async renderPreview(full) {
    const st = this.st; if (!st) return null;
    if (!st.src) {
      if (st.outOnly && st.p.img && st.p.img.out && !st.preview) {
        const b = await DB.getBlob(st.p.img.out); if (b) { const im = await IMG.decode(b); const c = IMG.canvas(IMG.dims(im).w, IMG.dims(im).h); c.getContext('2d').drawImage(im, 0, 0); st.preview = { canvas: c, w: c.width, h: c.height }; }
      }
      this.layoutStage(); this.cardPreview(); return st.preview && st.preview.canvas;
    }
    if (st.edit.bg !== 'none' || st.edit.brushed) await this.ensureMask();
    if (!st.autoParams) st.autoParams = PIPE.autoParamsFor(st.srcData, st.mask);
    const saveOut = PIPE.OUT; PIPE.OUT = full ? 1400 : 900;
    let out;
    try { out = PIPE.render(st.src, st.srcData, st.mask, st.edit, st.autoParams); }
    catch (e) { UI.toast(e.message, { type: 'bad' }); return null; }
    finally { PIPE.OUT = saveOut; }
    if (full) return out;
    if (st.preview && st.preview.canvas !== out) IMG.release(st.preview.canvas);
    st.preview = { canvas: out, w: out.width, h: out.height };
    if (st.step === 'look' || st.step === 'details') { this.layoutStage(); this.cardPreview(); }
    return out;
  },
  rerender: debounce(function () { Editor.renderPreview(); }, 140),
  async cardPreview() {
    const st = this.st, box = $('#card-preview'); if (!st || !box) return;
    const p = Object.assign({}, st.p, { img: Object.assign({}, st.p.img, st.preview ? { out: 'live', ow: st.preview.w, oh: st.preview.h } : {}) });
    const page = LAYOUT.cardPreview(p, App.S);
    const W = Math.min(box.clientWidth || 300, 340), sc = W / page.w;
    const c = h('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(page.w * sc * dpr); c.height = Math.round(page.h * sc * dpr); c.style.width = Math.round(page.w * sc) + 'px';
    await RENDER.drawPage(c.getContext('2d'), page, sc * dpr, async () => st.preview ? st.preview.canvas : null);
    clear(box).append(c);
  },

  /* ---------- tray per step ---------- */
  tray() {
    const st = this.st, t = $('#ed-tray'); if (!t || !st) return;
    clear(t);
    const e = st.edit;
    if (st.quality && st.quality.warnings && st.quality.warnings.length && (st.step === 'frame')) {
      t.appendChild(h('div', { class: 'qwarn' }, st.quality.warnings.map(w => h('span', null, icon('alert'), w.t)), h('button', { class: 'linkish small', onclick: () => this.addPhoto(true) }, 'Retake')));
    }
    if (st.step === 'frame') {
      if (st.autoNote) { this.note(st.autoNote); st.autoNote = null; }
      appendKids(t, [
        h('p', { class: 'tray-hint' }, e.persp ? 'Drag each corner onto a front corner of the product. The page will show it straight-on.' : 'Drag the corners to crop around the product.'),
        h('div', { class: 'tray-row' },
          h('button', { class: 'tool', onclick: async () => { this.setBusy('Finding the product…'); await nextFrame(); const ac = await PIPE.autoCorners(st.src, e.bg === 'ai' ? st.mask : null); e.quad = ac.quad; e.persp = ac.boxLike; this.setBusy(null); this.tray(); this.draw(); this.afterFrameChange(); this.note(ac.found ? 'Corners updated.' : 'Could not find the product. Drag the corners yourself.'); } }, icon('wand'), 'Find corners'),
          h('button', { class: 'tool', onclick: () => { e.quad = GEOM.defaultQuad(0.04); this.draw(); this.afterFrameChange(); } }, icon('frame'), 'Reset'),
          h('button', { class: 'tool', onclick: () => this.rotate() }, icon('rotate'), 'Rotate')),
        UI.toggle('Straighten (4 corners)', e.persp, v => { e.persp = v; if (!v) { const b = GEOM.bounds(e.quad); e.quad = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]; } this.tray(); this.draw(); this.afterFrameChange(); }, 'Off = simple rectangle crop'),
        e.persp ? h('div', { class: 'tray-row wrap' }, h('span', { class: 'small muted' }, 'Shape'), UI.seg([{ value: 'auto', label: 'As drawn' }, { value: '1:1', label: 'Square' }, { value: '3:4', label: 'Tall' }, { value: '4:3', label: 'Wide' }], e.aspect, v => { e.aspect = v; this.afterFrameChange(); }, 'small')) : null,
        h('div', { class: 'tray-next' }, h('button', { class: 'btn primary', onclick: () => this.go('cutout') }, 'Next: cut-out'))]);
    } else if (st.step === 'cutout') {
      const modes = [{ value: 'none', label: 'Keep', title: 'Keep the background inside the frame' }, { value: 'quick', label: 'Quick', title: 'Instant, works best on plain backgrounds' }, { value: 'ai', label: 'AI', title: 'Best for busy showroom photos (downloads once)' }];
      appendKids(t, [
        h('div', { class: 'tray-row wrap' }, h('span', { class: 'small muted' }, 'Background'), UI.seg(modes, e.bg, async v => { e.bg = v; e.brushed = false; st.undo = []; st.preview = null; App.S.photo.bg = v; App.saveSettings(); await this.ensureMask(true); this.tray(); })),
        h('p', { class: 'tray-hint' }, e.bg === 'none' ? 'The photo is used as framed, background included.' : e.bg === 'quick' ? 'Quick works best against a plain wall or sheet. For busy shelves, try AI.' : 'AI is best for busy showroom photos.'),
        (st.mask ? h('div', { class: 'tray-row wrap' },
          h('span', { class: 'small muted' }, 'Fix by hand'),
          UI.seg([{ value: 'off', label: 'Off' }, { value: 'erase', label: 'Erase', icon: 'erase' }, { value: 'restore', label: 'Restore', icon: 'brush' }], st.brush.mode, v => { st.brush.mode = v; $('#ed-stage').classList.toggle('brushing', v !== 'off'); }),
          h('button', { class: 'tool', disabled: !st.undo.length, onclick: () => { const prev = st.undo.pop(); if (prev) { st.mask.data.set(prev); this.syncMaskCanvas(); this.draw(); st.preview = null; this.tray(); this.markDirty(); } } }, icon('undo'), 'Undo')) : null),
        st.mask ? UI.slider('Brush size', st.brush.size, 8, 70, v => { st.brush.size = v; }) : null,
        e.bg !== 'none' ? UI.slider('Edge softness', e.smooth, 0, 100, (v, final) => { e.smooth = v; if (final) { if (e.brushed) { UI.toast('Brush fixes kept; softness applies next time you redo the cut-out'); return; } this.ensureMask(true); } }) : null,
        e.brushed ? h('button', { class: 'linkish small', onclick: async () => { e.brushed = false; await this.ensureMask(true); this.tray(); } }, 'Redo cut-out (drops brush fixes)') : null,
        h('div', { class: 'tray-next' }, h('button', { class: 'btn primary', onclick: () => this.go('look') }, 'Next: look'))]);
      $('#ed-stage').classList.toggle('brushing', st.brush.mode !== 'off');
    } else if (st.step === 'look') {
      const L = e.look;
      const set = (k) => (v, final) => { L[k] = v; this.markDirty(); this.rerender(); };
      appendKids(t, [
        st.outOnly ? h('p', { class: 'tray-hint' }, 'The original photo was not kept, so only the details can change.') : h('div', null,
          UI.toggle('Auto colour and brightness', L.auto, v => { L.auto = v; this.markDirty(); this.rerender(); }),
          UI.slider('Brightness', L.brightness, -50, 50, set('brightness')),
          UI.slider('Contrast', L.contrast, -50, 50, set('contrast')),
          UI.slider('Colour', L.saturation, -50, 50, set('saturation')),
          UI.slider('Warmth', L.warmth, -50, 50, set('warmth')),
          UI.slider('Sharpness', L.sharpen, 0, 100, set('sharpen')),
          h('button', { class: 'linkish small', onclick: () => { Object.assign(L, { auto: true, brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 15 }); this.tray(); this.rerender(); this.markDirty(); } }, 'Reset look')),
        h('div', { class: 'tray-next' }, h('button', { class: 'btn primary', onclick: () => this.go('details') }, 'Next: details'))]);
    } else if (st.step === 'details') {
      t.appendChild(this.detailsForm());
    }
  },
  detailsForm() {
    const st = this.st, p = st.p, S = App.S;
    const sticky = new Set(S.photo.sticky || []);
    const rows = [];
    const keys = S.fields.map(f => f.key);
    for (const f of S.fields) {
      const key = f.key;
      const dlId = 'dl-' + key;
      const isMoney = f.style === 'price';
      const inp = h(key === 'name' ? 'textarea' : 'input', Object.assign({ id: 'fld-' + key, rows: key === 'name' ? 2 : undefined, value: p.f[key] || '', autocomplete: 'off', autocapitalize: key === 'brand' ? 'words' : 'sentences', enterkeyhint: 'next',
        oninput: ev => { const v = ev.target.value; if (v) p.f[key] = v; else delete p.f[key]; if (isMoney) money.textContent = v && parseMoney(v) !== null ? fmtMoney(v) : ''; this.markDirty(); this.dupCheck(); this.cardPreviewSoon(); } },
        key === 'name' ? {} : { type: 'text', list: dlId }, isMoney ? { inputmode: 'decimal', placeholder: 'e.g. 1299' } : {}));
      if (key === 'name') inp.textContent = p.f[key] || '';
      const money = h('span', { class: 'money-prev' }, isMoney && p.f[key] && parseMoney(p.f[key]) !== null ? fmtMoney(p.f[key]) : '');
      const pin = h('button', { class: 'pin' + (sticky.has(key) ? ' on' : ''), type: 'button', title: 'Keep this value for the next product', 'aria-pressed': String(sticky.has(key)), onclick: (ev) => { ev.preventDefault(); if (sticky.has(key)) sticky.delete(key); else sticky.add(key); S.photo.sticky = Array.from(sticky); App.saveSettings(); ev.currentTarget.classList.toggle('on'); ev.currentTarget.setAttribute('aria-pressed', String(sticky.has(key))); } }, icon('pin'));
      const values = key === 'name' || isMoney ? [] : App.values(key);
      rows.push(h('div', { class: 'df' + (f.on ? '' : ' off') },
        h('label', { for: 'fld-' + key }, f.label, f.on ? null : h('small', null, ' (hidden in PDF)')),
        h('div', { class: 'df-in' }, inp, money, key !== 'name' ? pin : null),
        values.length ? h('datalist', { id: dlId }, values.map(v => h('option', { value: v }))) : null));
    }
    const badge = h('input', { type: 'text', value: p.f.badge || '', placeholder: 'Optional, e.g. New', oninput: e => { const v = e.target.value; if (v) p.f.badge = v; else delete p.f.badge; this.markDirty(); this.cardPreviewSoon(); } });
    const quick = ['New', 'Bestseller', 'Offer', '10% off'].map(b => h('button', { class: 'chip small', type: 'button', onclick: () => { badge.value = b; p.f.badge = b; this.markDirty(); this.cardPreviewSoon(); } }, b));
    return h('div', { class: 'details' },
      h('div', { class: 'details-grid' },
        h('div', { class: 'df-list' }, rows,
          h('div', { class: 'df' }, h('label', null, 'Badge'), h('div', { class: 'df-in' }, badge), h('div', { class: 'chips tight' }, quick)),
          h('p', { class: 'small muted' }, 'Empty boxes are left out of the PDF. ', h('span', { class: 'ic-inline' }, icon('pin')), ' keeps a value for the next product.'),
          h('div', { id: 'dup-warn' })),
        h('div', { class: 'card-prev-wrap' }, h('div', { class: 'small muted' }, 'On the page'), h('div', { id: 'card-preview', class: 'card-preview' }))),
      h('div', { class: 'tray-next two' },
        h('button', { class: 'btn ghost', onclick: () => this.save(false) }, 'Save'),
        h('button', { class: 'btn primary', onclick: () => this.save(true) }, icon('camera'), 'Save and take next')));
  },
  cardPreviewSoon: debounce(function () { Editor.cardPreview(); }, 200),
  async addPhoto(camera) {
    if (this.st && (this.st.busy || this.st.saving)) { UI.toast('Wait for the photo to finish processing first.'); return; }
    const files = await UI.pickFiles({ capture: camera });
    if (!files[0] || !this.st) return;
    try { await this.loadNewPhoto(files[0]); this.go('frame'); }
    catch (e) { UI.toast(e.message || 'Could not open the photo', { type: 'bad', ms: 7000 }); }
  },
  dupCheck() {
    const st = this.st, box = $('#dup-warn'); if (!box) return;
    const k = (f) => [f.brand, f.name, f.size].map(matchKey).join('\u0001');
    const key = st.p.f.name ? k(st.p.f) : '';
    const dup = key && App.products.find(q => q.id !== st.p.id && q.f.name && k(q.f) === key);
    clear(box);
    if (dup) box.appendChild(h('p', { class: 'warnline' }, icon('alert'), 'A product with the same brand, name and size already exists.'));
  },
  async rotate() {
    const st = this.st; if (!st || !st.src) return;
    if (st.busy || st.saving) { UI.toast('Wait for the photo to finish processing, then rotate.'); return; }
    st.busy++;
    try {
      const s = st.src, c = IMG.canvas(s.height, s.width), x = c.getContext('2d');
      x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(s, 0, 0);
      IMG.release(s); st.src = c; st.srcData = IMG.data(c); st.srcChanged = true; st.gen++;
      if (st.mask) {
        const m = st.mask, r = new Uint8Array(m.w * m.h);
        for (let y = 0; y < m.h; y++) for (let xx = 0; xx < m.w; xx++) r[xx * m.h + (m.h - 1 - y)] = m.data[y * m.w + xx];
        st.mask = { data: r, w: m.h, h: m.w }; st.maskDirty = true; if (st.maskCanvas) { IMG.release(st.maskCanvas); st.maskCanvas = null; }
        st.undo = [];
      }
      st.edit.quad = st.edit.quad.map(p => ({ x: 1 - p.y, y: p.x }));
      st.edit.quad = [st.edit.quad[3], st.edit.quad[0], st.edit.quad[1], st.edit.quad[2]];
      st.maskKey = this.maskKey(); st.autoParams = null;
      if (st.p.draft && st.p.img && st.p.img.src) {
        // keep the saved draft photo in step with its frame, so reopening it later lines up
        const old = st.p.img.src, b = await IMG.toBlob(st.src, 'image/jpeg', 0.9);
        st.p.img = Object.assign({}, st.p.img, { src: await DB.putBlob(b), sw: st.src.width, sh: st.src.height });
        st.p.edit = st.edit;
        await App.saveProduct(st.p);
        await DB.delBlob(old);
        st.srcChanged = false;
      }
    } finally { st.busy = Math.max(0, st.busy - 1); }
    this.afterFrameChange(); this.layoutStage();
  },

  /* ---------- save / close ---------- */
  async save(next) {
    const st = this.st; if (!st || st.saving) return;
    if (st.busy) { UI.toast('Wait for the photo to finish processing, then save.'); return; }
    const tapAt = Date.now();
    st.saving = true;
    this.autosave.cancel();
    const btns = $$('.ed-save, .tray-next .btn', this.el); btns.forEach(b => b.disabled = true);
    try {
      const p = st.p;
      let stale = [];
      if (st.src) {
        this.setBusy('Saving…');
        if (st.edit.bg !== 'none' || st.edit.brushed) await this.ensureMask();
        const out = await this.renderPreview(true);
        if (!out) throw new Error('Could not render the photo');
        const parts = { out, mask: st.mask && (st.maskDirty || !p.img.mask) ? st.mask : undefined };
        if (st.mask === null && p.img.mask) parts.mask = null;
        if (st.srcChanged) { parts.srcBlob = await IMG.toBlob(st.src, 'image/jpeg', 0.9); parts.srcW = st.src.width; parts.srcH = st.src.height; }
        stale = await PIPE.store(p, parts, true);
        if (!App.S.photo.keepSource && p.img.src) { stale.push(p.img.src); p.img.src = null; }
        IMG.release(out);
      }
      p.edit = st.edit; p.autoParams = st.autoParams; p.q = st.quality;
      p.review = false; p.draft = false;
      if (st.isNew) p.t = Date.now() - st.started;
      for (const k of App.S.photo.sticky || []) { if (p.f[k]) App.stickyValues[k] = p.f[k]; else delete App.stickyValues[k]; }
      await DB.setKV('sticky', App.stickyValues);
      await PIPE.commit(p, stale);          // record first, then old files
      st.dirty = false;
      await this.close(true);
      if (next) {
        // the camera can only open from a fresh tap; a quick save still counts as that tap (not on iPhone)
        const fresh = Date.now() - tapAt < 2500 && !ENV.isIOS;
        if (fresh) Add.photo();
        UI.toast('Saved.', { icon: 'check', ms: fresh ? 6000 : 20000, action: { label: 'Take next photo', fn: () => Add.photo() } });
      } else UI.toast('Saved', { icon: 'check' });
    } catch (e) {
      LOG.add('error', 'save failed', e && e.message);
      UI.toast('Could not save: ' + (e.message || e) + '. Free some space or back up and try again.', { type: 'bad', ms: 8000 });
    } finally { if (this.st === st) { st.saving = false; this.setBusy(null); btns.forEach(b => b.disabled = false); } }
  },
  /** fromPop: the Back button already removed our history entry. */
  async requestClose(fromPop) {
    const st = this.st; if (!st) return;
    const stay = () => { if (fromPop) history.pushState({ editor: true }, ''); };
    if (st.saving) { stay(); return; }
    if (st.dirty) {
      const keep = st.p.draft && this.hasContent(st);
      const ok = await UI.confirm('Leave without saving?', keep ? 'This product is kept as unfinished, so you can finish it later.' : st.isNew ? 'Nothing has been saved for this product yet.' : 'Your changes to this product will be lost.', 'Leave', true);
      if (!ok) { stay(); return; }
    }
    await this.close(false, fromPop);
  },
  /** keepHistory: leave the browser history alone (Back already popped it, or another editor is opening). */
  async close(saved, keepHistory) {
    const st = this.st; if (!st) return;
    this.autosave.cancel();
    if (!saved && st.p.draft) {
      try {
        if (this.hasContent(st)) { st.p.edit = st.edit; await App.saveProduct(st.p); }
        else if (App.byId.has(st.p.id)) await App.deleteProducts([st.p.id]);
      } catch (e) { LOG.add('warn', 'draft save on close failed', e.message); }
    }
    this.st = null;
    window.removeEventListener('resize', this._resize);
    if (st.src) IMG.release(st.src); if (st.maskCanvas) IMG.release(st.maskCanvas); if (st.preview) IMG.release(st.preview.canvas);
    if (this.el) { this.el.classList.add('out'); const el = this.el; setTimeout(() => el.remove(), 180); this.el = null; }
    document.body.classList.remove('noscroll');
    if (!keepHistory && history.state && history.state.editor) { this._skipPop = true; history.back(); }
    App.changed();
  }
};
window.addEventListener('popstate', () => {
  if (Editor._skipPop) { Editor._skipPop = false; return; }
  if (Editor.st) Editor.requestClose(true);
});
window.addEventListener('beforeunload', e => { if ((Editor.st && Editor.st.dirty) || Batch.running || App.saving || App.busy) { e.preventDefault(); e.returnValue = ''; } });
