/* ===================== 07 · Product photo pipeline ===================== */
const PIPE = {
  SRC: 2000,   // stored original (longest side)
  WORK: 448,   // quick-cut working size
  REF: 1024,   // mask resolution
  OUT: 1400,   // finished cut-out (longest side)

  defaultEdit(settings) {
    return {
      rot: 0, quad: null, persp: true, aspect: 'auto',
      bg: (settings && settings.photo && settings.photo.bg) || 'quick',
      smooth: 35,
      look: { auto: true, brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 15 },
      brushed: false
    };
  },
  /** File → stored source JPEG + canvas */
  async importPhoto(file, rot = 0) {
    const img = await IMG.decode(file, PIPE.SRC);
    const canvas = IMG.toCanvas(img, PIPE.SRC, rot);
    if (img.close) img.close();
    const blob = await IMG.toBlob(canvas, 'image/jpeg', 0.9);
    const quality = IMG.quality(canvas);
    return { canvas, blob, quality };
  },
  async sourceCanvas(srcBlob, rot = 0) {
    const img = await IMG.decode(srcBlob, PIPE.SRC);
    const c = IMG.toCanvas(img, PIPE.SRC, rot);
    if (img.close) img.close();
    return c;
  },
  scaled(canvas, maxSide) {
    const s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
    const c = IMG.canvas(canvas.width * s, canvas.height * s), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  },
  /** Compute cut-out mask for the whole photo → {data:Uint8Array(0..255), w, h} at ≤REF */
  async mask(srcCanvas, mode, quadN, smooth, aiQuality, onProgress) {
    if (mode === 'none') return null;
    const guideC = PIPE.scaled(srcCanvas, PIPE.REF), guide = IMG.data(guideC);
    try {
      if (mode === 'ai') {
        const aiInput = PIPE.scaled(srcCanvas, 1600);
        const a = await AI.mask(aiInput, aiQuality, onProgress);
        let m = SEG.resize(a, aiInput.width, aiInput.height, guide.width, guide.height);
        IMG.release(aiInput);
        // No clipping to the frame here: the straighten step crops to the frame anyway, and a clipped mask
        // would go stale when the corners are moved later.
        if (smooth > 45) m = SEG.feather(m, guide.width, guide.height, Math.round((smooth - 45) / 18));
        return { data: m, w: guide.width, h: guide.height };
      }
      onProgress && onProgress({ phase: 'compute', text: 'Cutting out…' });
      await yieldUI();
      const workC = PIPE.scaled(srcCanvas, PIPE.WORK), work = IMG.data(workC);
      const bin = SEG.quickCut(work, quadN, 3);
      await yieldUI();
      const m = SEG.refine(bin, work.width, work.height, guide, smooth, true);
      IMG.release(workC);
      return { data: m, w: guide.width, h: guide.height };
    } finally { IMG.release(guideC); }
  },
  /** Suggest corners: run a quick cut on the whole photo and fit a quad. */
  async autoCorners(srcCanvas, existingMask) {
    let m = existingMask;
    if (!m) {
      const workC = PIPE.scaled(srcCanvas, 360), work = IMG.data(workC), w = work.width, h = work.height;
      let bin = SEG.quickCut(work, null, 3);
      // cut thin bridges to neighbouring objects, keep the central product
      bin = SEG.dilate(SEG.erode(bin, w, h, 3), w, h, 3);
      const seed = new Uint8Array(w * h);
      for (let y = Math.round(h * 0.35); y < h * 0.65; y++) for (let x = Math.round(w * 0.35); x < w * 0.65; x++) seed[y * w + x] = 1;
      bin = SEG.keepMain(bin, w, h, seed);
      m = { data: bin.map(v => v * 255), w, h };
      IMG.release(workC);
    }
    return GEOM.quadFromMask(m.data, m.w, m.h);
  },
  /** Straighten + cut-out + look → finished RGBA canvas (trimmed). */
  render(srcCanvas, srcData, mask, edit, autoParams) {
    const sw = srcCanvas.width, sh = srcCanvas.height;
    let qn = edit.quad || GEOM.fullQuad();
    if (!edit.persp) { const b = GEOM.bounds(qn); qn = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]; }
    const q = qn.map(p => ({ x: p.x * sw, y: p.y * sh }));
    const size = GEOM.outSize(q, edit.aspect, PIPE.OUT);
    const warped = GEOM.warp(srcData, mask, q, size.w, size.h);
    const look = Object.assign({}, edit.look);
    if (look.auto && autoParams) look.auto = autoParams; else look.auto = null;
    IMG.adjust(warped, look);
    const c = IMG.fromData(warped);
    if (!mask) return c;
    const t = IMG.trim(c, 0.012, 12);
    if (t !== c) IMG.release(c);
    return t;
  },
  autoParamsFor(srcData, mask) {
    let a = null;
    if (mask) a = SEG.resize(mask.data, mask.w, mask.h, srcData.width, srcData.height);
    return IMG.autoParams(srcData.data, srcData.width, srcData.height, a);
  },
  async thumb(outCanvas, bg = '#F2F1EC') {
    const S = 360, c = IMG.canvas(S, S), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, S, S);
    const pad = S * 0.08, bw = S - pad * 2, bh = S - pad * 2.4;
    const s = Math.min(bw / outCanvas.width, bh / outCanvas.height);
    const w = outCanvas.width * s, h = outCanvas.height * s, X = (S - w) / 2, Y = pad + bh - h;
    const g = x.createRadialGradient(S / 2, Y + h, 1, S / 2, Y + h, w * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.20)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(S / 2, Y + h); x.scale(1, 0.09); x.translate(-S / 2, -(Y + h)); x.fillStyle = g; x.beginPath(); x.arc(S / 2, Y + h, w * 0.5, 0, Math.PI * 2); x.fill(); x.restore();
    x.imageSmoothingQuality = 'high'; x.drawImage(outCanvas, X, Y, w, h);
    const b = await IMG.toBlob(c, 'image/jpeg', 0.82);
    IMG.release(c);
    return b;
  },
  async maskToBlob(mask) {
    const c = IMG.canvas(mask.w, mask.h), x = c.getContext('2d'), id = x.createImageData(mask.w, mask.h), d = id.data;
    for (let i = 0, j = 0; i < mask.data.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = mask.data[i]; d[j + 3] = 255; }
    x.putImageData(id, 0, 0);
    const b = await IMG.toBlob(c, 'image/png');
    IMG.release(c);
    return b;
  },
  async blobToMask(blob) {
    if (!blob) return null;
    const img = await IMG.decode(blob);
    const { w, h } = IMG.dims(img);
    const c = IMG.canvas(w, h); c.getContext('2d').drawImage(img, 0, 0);
    if (img.close) img.close();
    const d = IMG.data(c).data, m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4];
    IMG.release(c);
    return { data: m, w, h };
  },
  /** Fully automatic processing (batch import): corners + cut-out + look. */
  async autoProcess(file, settings, onProgress) {
    const { canvas, blob, quality } = await PIPE.importPhoto(file);
    const edit = PIPE.defaultEdit(settings);
    let mask = null;
    if (edit.bg === 'ai') {
      try { mask = await PIPE.mask(canvas, 'ai', null, edit.smooth, settings.photo.aiQuality, onProgress); }
      catch (e) { LOG.add('warn', 'AI unavailable in batch, using Quick', e.message); edit.bg = 'quick'; }
    }
    const ac = await PIPE.autoCorners(canvas, mask);
    edit.quad = ac.quad; edit.persp = ac.boxLike;
    if (edit.bg === 'quick') mask = await PIPE.mask(canvas, 'quick', ac.found ? ac.quad : null, edit.smooth, null, onProgress);
    const srcData = IMG.data(canvas);
    const ap = PIPE.autoParamsFor(srcData, mask);
    const out = PIPE.render(canvas, srcData, mask, edit, ap);
    const res = { srcBlob: blob, srcW: canvas.width, srcH: canvas.height, mask, out, edit, autoParams: ap, quality, review: !ac.found || !ac.confident };
    IMG.release(canvas);
    return res;
  },
  /** Write new images for a product and point p.img at them. Returns ids of the replaced blobs:
   *  callers delete those only AFTER the product record itself has been saved (so a failed save loses nothing). */
  async store(p, parts, keepSource = true) {
    const old = Object.assign({}, p.img || {});
    const img = Object.assign({}, p.img || {});
    if (parts.srcBlob) { img.src = keepSource ? await DB.putBlob(parts.srcBlob) : null; img.sw = parts.srcW; img.sh = parts.srcH; }
    if (parts.mask !== undefined) img.mask = parts.mask ? await DB.putBlob(await PIPE.maskToBlob(parts.mask)) : null;
    if (parts.out) {
      const t = IMG.alphaType();
      img.out = await DB.putBlob(await IMG.toBlob(parts.out, t, t === 'image/webp' ? 0.92 : undefined));
      img.ow = parts.out.width; img.oh = parts.out.height;
      img.thumb = await DB.putBlob(await PIPE.thumb(parts.out));
    }
    const stale = [];
    for (const k of ['src', 'mask', 'out', 'thumb']) if (old[k] && old[k] !== img[k]) stale.push(old[k]);
    p.img = img;
    return stale;
  },
  /** Save a product record, then remove the blobs it no longer uses. */
  async commit(p, stale) {
    await App.saveProduct(p);
    if (stale && stale.length) { try { await DB.delMany('blobs', stale); } catch (e) { LOG.add('warn', 'stale blob cleanup failed', e.message); } }
  }
};
