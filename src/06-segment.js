/* ===================== 06 · Background removal =====================
 * "Quick" (no download): colour-model segmentation seeded by the 4-corner frame, iterated like GrabCut,
 * cleaned with morphology + connected components, then edge-snapped with a colour guided filter.
 * "AI" (optional, downloads once): IS-Net model via @imgly/background-removal, loaded only when chosen.
 */
const SEG = {
  /** mean filter, window (2r+1)², edge-normalised */
  box(src, w, h, r, out) {
    const n = w * h, tmp = new Float32Array(n); out = out || new Float32Array(n);
    if (r < 1) { out.set(src); return out; }
    for (let y = 0; y < h; y++) {
      const row = y * w; let sum = 0;
      for (let x = 0; x <= r && x < w; x++) sum += src[row + x];
      for (let x = 0; x < w; x++) {
        const lo = x - r, hi = x + r;
        tmp[row + x] = sum / ((hi < w ? hi : w - 1) - (lo > 0 ? lo : 0) + 1);
        if (hi + 1 < w) sum += src[row + hi + 1];
        if (lo >= 0) sum -= src[row + lo];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y <= r && y < h; y++) sum += tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        const lo = y - r, hi = y + r;
        out[y * w + x] = sum / ((hi < h ? hi : h - 1) - (lo > 0 ? lo : 0) + 1);
        if (hi + 1 < h) sum += tmp[(hi + 1) * w + x];
        if (lo >= 0) sum -= tmp[lo * w + x];
      }
    }
    return out;
  },
  /** Colour guided filter (He et al.). I: {r,g,b} Float32Array planes in 0..1, p: Float32Array. */
  guidedColor(I, p, w, h, r, eps) {
    const n = w * h, B = (a) => SEG.box(a, w, h, r);
    const mul = (a, b) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = a[i] * b[i]; return o; };
    const mR = B(I.r), mG = B(I.g), mB = B(I.b), mp = B(p);
    const mRp = B(mul(I.r, p)), mGp = B(mul(I.g, p)), mBp = B(mul(I.b, p));
    const vRR = B(mul(I.r, I.r)), vRG = B(mul(I.r, I.g)), vRB = B(mul(I.r, I.b)), vGG = B(mul(I.g, I.g)), vGB = B(mul(I.g, I.b)), vBB = B(mul(I.b, I.b));
    const aR = new Float32Array(n), aG = new Float32Array(n), aB = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const cr = mRp[i] - mR[i] * mp[i], cg = mGp[i] - mG[i] * mp[i], cb = mBp[i] - mB[i] * mp[i];
      const rr = vRR[i] - mR[i] * mR[i] + eps, rg = vRG[i] - mR[i] * mG[i], rb = vRB[i] - mR[i] * mB[i];
      const gg = vGG[i] - mG[i] * mG[i] + eps, gb = vGB[i] - mG[i] * mB[i], bb = vBB[i] - mB[i] * mB[i] + eps;
      // inverse of symmetric 3x3
      const i00 = gg * bb - gb * gb, i01 = rb * gb - rg * bb, i02 = rg * gb - rb * gg;
      const i11 = rr * bb - rb * rb, i12 = rb * rg - rr * gb, i22 = rr * gg - rg * rg;
      const det = rr * i00 + rg * i01 + rb * i02 || 1e-12;
      const ar = (i00 * cr + i01 * cg + i02 * cb) / det, ag = (i01 * cr + i11 * cg + i12 * cb) / det, ab = (i02 * cr + i12 * cg + i22 * cb) / det;
      aR[i] = ar; aG[i] = ag; aB[i] = ab; b[i] = mp[i] - ar * mR[i] - ag * mG[i] - ab * mB[i];
    }
    const maR = B(aR), maG = B(aG), maB = B(aB), mb = B(b), q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = maR[i] * I.r[i] + maG[i] * I.g[i] + maB[i] * I.b[i] + mb[i];
    return q;
  },
  planes(d, n) { const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 4) { r[i] = d[j] / 255; g[i] = d[j + 1] / 255; b[i] = d[j + 2] / 255; } return { r, g, b }; },
  dilate(bin, w, h, r) { const f = new Float32Array(bin.length); for (let i = 0; i < f.length; i++) f[i] = bin[i]; const m = SEG.box(f, w, h, r); const o = new Uint8Array(bin.length); for (let i = 0; i < o.length; i++) o[i] = m[i] > 1e-4 ? 1 : 0; return o; },
  erode(bin, w, h, r) { const f = new Float32Array(bin.length); for (let i = 0; i < f.length; i++) f[i] = bin[i]; const m = SEG.box(f, w, h, r); const o = new Uint8Array(bin.length); for (let i = 0; i < o.length; i++) o[i] = m[i] > 0.9999 ? 1 : 0; return o; },
  /** 4-connected components; keep those touching the seed (or the largest). */
  keepMain(bin, w, h, seed) {
    const n = w * h, lab = new Int32Array(n), q = new Int32Array(n); let L = 0; const sizes = [0], hits = [0];
    for (let s = 0; s < n; s++) {
      if (!bin[s] || lab[s]) continue;
      L++; let qh = 0, qt = 0, size = 0, hit = 0; q[qt++] = s; lab[s] = L;
      while (qh < qt) {
        const i = q[qh++]; size++; if (seed && seed[i]) hit++;
        const x = i % w;
        if (x > 0 && bin[i - 1] && !lab[i - 1]) { lab[i - 1] = L; q[qt++] = i - 1; }
        if (x < w - 1 && bin[i + 1] && !lab[i + 1]) { lab[i + 1] = L; q[qt++] = i + 1; }
        if (i >= w && bin[i - w] && !lab[i - w]) { lab[i - w] = L; q[qt++] = i - w; }
        if (i < n - w && bin[i + w] && !lab[i + w]) { lab[i + w] = L; q[qt++] = i + w; }
      }
      sizes.push(size); hits.push(hit);
    }
    if (!L) return bin;
    let biggest = 1; for (let l = 2; l <= L; l++) if (sizes[l] > sizes[biggest]) biggest = l;
    const keep = new Uint8Array(L + 1);
    let anyHit = false;
    for (let l = 1; l <= L; l++) if (hits[l] > 0 && sizes[l] > sizes[biggest] * 0.04) { keep[l] = 1; anyHit = true; }
    if (!anyHit) keep[biggest] = 1;
    const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = keep[lab[i]];
    return o;
  },
  /** Fill enclosed background pockets smaller than maxFrac of the object (real holes like mug handles survive). */
  fillHoles(bin, w, h, maxFrac = 0.02) {
    const n = w * h, lab = new Int32Array(n), q = new Int32Array(n); let area = 0;
    for (let i = 0; i < n; i++) area += bin[i];
    const out = bin.slice(); let L = 0;
    for (let s = 0; s < n; s++) {
      if (bin[s] || lab[s]) continue;
      L++; let qh = 0, qt = 0, border = false; q[qt++] = s; lab[s] = L;
      while (qh < qt) {
        const i = q[qh++], x = i % w, y = (i / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        if (x > 0 && !bin[i - 1] && !lab[i - 1]) { lab[i - 1] = L; q[qt++] = i - 1; }
        if (x < w - 1 && !bin[i + 1] && !lab[i + 1]) { lab[i + 1] = L; q[qt++] = i + 1; }
        if (y > 0 && !bin[i - w] && !lab[i - w]) { lab[i - w] = L; q[qt++] = i - w; }
        if (y < h - 1 && !bin[i + w] && !lab[i + w]) { lab[i + w] = L; q[qt++] = i + w; }
      }
      if (!border && qt <= area * maxFrac) for (let k = 0; k < qt; k++) out[q[k]] = 1;
    }
    return out;
  },
  resize(mask, w, h, nw, nh) {
    const o = new Uint8Array(nw * nh), sx = w / nw, sy = h / nh;
    for (let y = 0; y < nh; y++) {
      const fy = (y + 0.5) * sy - 0.5, y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(h - 1, y0 + 1), ty = Math.min(1, Math.max(0, fy - y0));
      for (let x = 0; x < nw; x++) {
        const fx = (x + 0.5) * sx - 0.5, x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(w - 1, x0 + 1), tx = Math.min(1, Math.max(0, fx - x0));
        o[y * nw + x] = (mask[y0 * w + x0] * (1 - tx) + mask[y0 * w + x1] * tx) * (1 - ty) + (mask[y1 * w + x0] * (1 - tx) + mask[y1 * w + x1] * tx) * ty;
      }
    }
    return o;
  },

  /**
   * Quick cut. id: ImageData (working res). quadN: normalised corners or null.
   * Returns Uint8Array 0/1 mask at the same resolution.
   */
  quickCut(id, quadN, iterations = 3) {
    const w = id.width, h = id.height, n = w * h, d = id.data;
    const bins = new Uint16Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) bins[i] = ((d[j] >> 4) << 8) | ((d[j + 1] >> 4) << 4) | (d[j + 2] >> 4);
    const prior = new Float32Array(n), fgSeed = new Uint8Array(n), bgSeed = new Uint8Array(n), hardBg = new Uint8Array(n);
    const full = !quadN || GEOM.area(quadN) > 0.93;
    if (!full) {
      const q = quadN.map(p => ({ x: p.x * w, y: p.y * h }));
      const inner = GEOM.scaleQuad(q, 0.62), outer = GEOM.scaleQuad(q, 1.08);
      const bb = GEOM.bounds(outer);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, p = { x: x + 0.5, y: y + 0.5 };
        const inOuter = p.x >= bb.x0 && p.x <= bb.x1 && p.y >= bb.y0 && p.y <= bb.y1 && GEOM.pointInQuad(p, outer);
        if (!inOuter) { prior[i] = 0.02; bgSeed[i] = 1; hardBg[i] = 1; continue; }
        const inQ = GEOM.pointInQuad(p, q);
        prior[i] = inQ ? 0.72 : 0.3;
        if (inQ && GEOM.pointInQuad(p, inner)) fgSeed[i] = 1;
      }
    }
    let bgCount = 0; for (let i = 0; i < n; i++) bgCount += bgSeed[i];
    if (full || bgCount < n * 0.02) {
      // no usable frame: centre is product, border band is background
      const band = Math.max(3, Math.round(Math.min(w, h) * 0.035));
      const cx = w / 2, cy = h / 2, rx = w * 0.2, ry = h * 0.2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const edge = x < band || y < band || x >= w - band || y >= h - band;
        const rr = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2;
        if (!full || !prior[i]) prior[i] = clamp(0.68 - rr * 0.35, 0.12, 0.68);
        if (edge) { bgSeed[i] = 1; prior[i] = 0.1; }
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) fgSeed[i] = 1;
      }
    }
    const I = SEG.planes(d, n);
    const rad = Math.max(2, Math.round(Math.min(w, h) / 70));
    // chromaticity (illumination-invariant colour) for shadow detection
    const cbin = new Uint16Array(n), lum = new Float32Array(n), chromaOK = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const s = d[j] + d[j + 1] + d[j + 2] + 1e-3;
      lum[i] = s / 3; chromaOK[i] = s > 66 ? 1 : 0;
      cbin[i] = Math.min(23, Math.floor(d[j] / s * 24)) * 24 + Math.min(23, Math.floor(d[j + 1] / s * 24));
    }
    let M = null;
    const Hf = new Float32Array(4096), Hb = new Float32Array(4096);
    const blur3 = (H) => {
      const o = new Float32Array(4096);
      for (let r = 0; r < 16; r++) for (let g = 0; g < 16; g++) for (let b = 0; b < 16; b++) {
        let s = 0, c = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
          const R = r + dr, G = g + dg, Bb = b + db; if (R < 0 || G < 0 || Bb < 0 || R > 15 || G > 15 || Bb > 15) continue;
          const wgt = (dr || dg || db) ? 0.5 : 2; s += H[(R << 8) | (G << 4) | Bb] * wgt; c += wgt;
        }
        o[(r << 8) | (g << 4) | b] = s / c;
      }
      return o;
    };
    let fgS = fgSeed, bgS = bgSeed;
    for (let it = 0; it < iterations; it++) {
      Hf.fill(0); Hb.fill(0); let nf = 0, nb = 0;
      for (let i = 0; i < n; i++) { if (fgS[i]) { Hf[bins[i]]++; nf++; } if (bgS[i]) { Hb[bins[i]]++; nb++; } }
      if (!nf || !nb) break;
      const F = blur3(Hf), Bh = blur3(Hb);
      // chroma models + background brightness per chroma bin (for cast shadows)
      const CF = new Float32Array(576), CB = new Float32Array(576), CL = new Float32Array(576);
      let cfn = 0, cbn = 0;
      for (let i = 0; i < n; i++) {
        if (!chromaOK[i]) continue;
        if (fgS[i]) { CF[cbin[i]]++; cfn++; }
        if (bgS[i]) { CB[cbin[i]]++; CL[cbin[i]] += lum[i]; cbn++; }
      }
      for (let b = 0; b < 576; b++) CL[b] = CB[b] ? CL[b] / CB[b] : 0;
      const P = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        if (hardBg[i]) { P[i] = 0; continue; }
        const lf = F[bins[i]] / nf + 1e-6, lb = Bh[bins[i]] / nb + 1e-6, pi = prior[i];
        let p = (pi * lf) / (pi * lf + (1 - pi) * lb);
        if (chromaOK[i] && cfn && cbn) {
          const b = cbin[i], cb = CB[b] / cbn, cf = CF[b] / cfn, Lb = CL[b];
          if (Lb > 0 && cb > cf * 1.4) {
            const rel = lum[i] / Lb;                     // darker version of the background colour → shadow
            if (rel < 0.94 && rel > 0.22) p *= 1 - 0.85 * Math.min(1, (cb / (cb + cf) - 0.58) / 0.3) * Math.min(1, (0.94 - rel) / 0.12);
          }
        }
        P[i] = p;
      }
      const Q = SEG.guidedColor(I, P, w, h, rad, 0.012);
      let bin = new Uint8Array(n);
      for (let i = 0; i < n; i++) bin[i] = !hardBg[i] && Q[i] > 0.5 ? 1 : 0;
      bin = SEG.dilate(SEG.erode(bin, w, h, 1), w, h, 1);   // open
      bin = SEG.erode(SEG.dilate(bin, w, h, 2), w, h, 2);   // close
      bin = SEG.keepMain(bin, w, h, fgSeed);
      bin = SEG.fillHoles(bin, w, h, 0.04);
      M = bin;
      // re-estimate models from the current cut
      const er = SEG.erode(M, w, h, 2), dl = SEG.dilate(M, w, h, 3);
      fgS = er; bgS = new Uint8Array(n); for (let i = 0; i < n; i++) bgS[i] = (!dl[i] || hardBg[i]) ? 1 : 0;
    }
    if (!M) { M = new Uint8Array(n); for (let i = 0; i < n; i++) M[i] = prior[i] > 0.5 ? 1 : 0; }
    return M;
  },
  /** Snap a rough 0/1 (or 0..255) mask to image edges at guide resolution; returns 0..255 alpha. */
  refine(mask, mw, mh, guide, smooth = 35, isBinary = true) {
    const w = guide.width, h = guide.height, n = w * h;
    const up = SEG.resize(isBinary ? mask.map(v => v * 255) : mask, mw, mh, w, h);
    const p = new Float32Array(n); for (let i = 0; i < n; i++) p[i] = up[i] / 255;
    const I = SEG.planes(guide.data, n);
    const r = Math.max(1, Math.round((1 + smooth / 14) * Math.max(w, h) / 1024));
    const q = SEG.guidedColor(I, p, w, h, r, 0.0009 + smooth * 0.00006);
    const lo = 0.5 - 0.12 - smooth / 600, hi = 0.5 + 0.12 + smooth / 600;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) { let t = (q[i] - lo) / (hi - lo); t = t < 0 ? 0 : t > 1 ? 1 : t; out[i] = Math.round(255 * t * t * (3 - 2 * t)); }
    return out;
  },
  /** Soften jagged edges of an existing alpha mask (used for AI masks and brush edits). */
  feather(mask, w, h, radius) {
    if (radius < 1) return mask;
    const f = new Float32Array(mask.length); for (let i = 0; i < f.length; i++) f[i] = mask[i];
    const b = SEG.box(SEG.box(f, w, h, radius), w, h, Math.max(1, radius >> 1));
    const o = new Uint8Array(mask.length);
    for (let i = 0; i < o.length; i++) { let t = (b[i] / 255 - 0.5) * 1.6 + 0.5; t = t < 0 ? 0 : t > 1 ? 1 : t; o[i] = Math.round(255 * t * t * (3 - 2 * t)); }
    return o;
  }
};

/* ---- AI background removal (optional) ----
   Everything is served from this app's own site: the library (vendor/imgly/<v>/background-removal.mjs),
   its WebAssembly engine and the model files (vendor/imgly/<v>/data/). Nothing loads from other sites.
   It runs in a background worker so the screen stays responsive, and uses several processor cores
   when the site is cross-origin isolated. If a phone can't run the worker, it runs on the page. */
const AI = {
  VERSION: (typeof SITE !== 'undefined' && SITE.ai) || '1.7.0',
  MB: { fast: 55, best: 100 },          // one-time download: model + engine
  mode: null, worker: null, lib: null, loading: null, failed: null, isolated: false, threads: 1,
  jobs: new Map(), seq: 0,
  base() {
    const site = /^https?:$/.test(location.protocol) ? location.href : (typeof SITE !== 'undefined' && SITE.url) || location.href;
    return new URL(`vendor/imgly/${this.VERSION}/`, site).href;
  },
  model(quality) { return quality === 'best' ? 'isnet_fp16' : 'isnet_quint8'; },
  /** Has this phone downloaded the model for this quality before? (asked once before the big download) */
  isDownloaded(quality) { return !!(App.S.photo.aiDownloaded && App.S.photo.aiDownloaded[quality === 'best' ? 'best' : 'fast']); },
  markDownloaded(quality) {
    const k = quality === 'best' ? 'best' : 'fast';
    App.S.photo.aiDownloaded = Object.assign({}, App.S.photo.aiDownloaded, { [k]: true }); App.saveSettings();
  },
  async load(onProgress) {
    if (this.mode) return this.mode;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      onProgress && onProgress({ phase: 'library', text: 'Starting AI…' });
      if (window.Worker && !this.noWorker) {
        try { await this.startWorker(); this.mode = 'worker'; return this.mode; }
        catch (e) { LOG.add('warn', 'AI worker unavailable, using the page', e && e.message); this.stopWorker(); }
      }
      const m = await import(/* @vite-ignore */ this.base() + 'background-removal.mjs');
      if (!m || typeof m.segmentForeground !== 'function') throw new Error('AI library is incomplete on the site');
      this.lib = m; this.isolated = window.crossOriginIsolated === true; this.threads = navigator.hardwareConcurrency || 1;
      this.mode = 'page'; return this.mode;
    })();
    try { const r = await this.loading; this.failed = null; return r; }
    catch (e) { this.loading = null; this.failed = 'Could not load the AI tool from this site. ' + (e && e.message || ''); throw new Error(this.failed); }
    finally { if (this.mode) this.loading = null; }
  },
  startWorker() {
    return new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(this.base() + 'ai-worker.mjs', { type: 'module', name: 'ai-cutout' }); }
      catch (e) { reject(e); return; }
      const t = setTimeout(() => reject(new Error('AI worker did not start')), 20000);
      w.onmessage = (e) => {
        const m = e.data || {};
        if (m.ready) { clearTimeout(t); this.isolated = !!m.isolated; this.threads = m.threads || 1; this.worker = w; resolve(); return; }
        const job = this.jobs.get(m.id); if (!job) return;
        if (m.progress) { job.progress && job.progress(m.progress.key, m.progress.cur, m.progress.total); return; }
        this.jobs.delete(m.id);
        if (m.error) job.reject(new Error(m.error)); else job.resolve(m.alpha);
      };
      w.onerror = (e) => {
        clearTimeout(t);
        const err = new Error('AI worker stopped' + (e && e.message ? ': ' + e.message : ''));
        if (e && e.preventDefault) e.preventDefault();
        reject(err);
        // a crash mid-job: fail the waiting photos (the editor falls back to Quick), restart next time
        for (const job of this.jobs.values()) job.reject(err);
        this.jobs.clear(); this.stopWorker(); this.mode = null;
      };
    });
  },
  stopWorker() { if (this.worker) { try { this.worker.terminate(); } catch (e) { } } this.worker = null; },
  /** returns Uint8Array alpha at the canvas's resolution */
  async mask(canvas, quality, onProgress) {
    await this.load(onProgress);
    const w = canvas.width, h = canvas.height, model = this.model(quality), publicPath = this.base() + 'data/';
    const progress = (key, cur, total) => {
      if (!onProgress) return;
      if (/^fetch/.test(key)) onProgress({ phase: 'download', cur, total, text: /models/.test(key) ? 'Downloading AI model (one time)…' : 'Downloading AI engine (one time)…' });
      else onProgress({ phase: 'compute', text: 'Removing background…' });
    };
    progress('compute', 0, 1);
    const rgba = IMG.data(canvas).data.buffer;
    let alpha;
    if (this.mode === 'worker') {
      const id = ++this.seq;
      alpha = await new Promise((resolve, reject) => {
        this.jobs.set(id, { resolve, reject, progress });
        this.worker.postMessage({ id, w, h, rgba, model, publicPath }, [rgba]);
      });
    } else {
      const input = new Blob([rgba], { type: `image/x-rgba8;width=${w};height=${h}` });
      const out = await this.lib.segmentForeground(input, { publicPath, model, output: { format: 'image/x-rgba8' }, progress });
      const px = new Uint8Array(await out.arrayBuffer()), n = w * h;
      alpha = new Uint8Array(n);
      for (let i = 0; i < n; i++) alpha[i] = px[i * 4 + 3];
    }
    if (!alpha || alpha.length !== w * h) throw new Error('AI returned a mask of the wrong size');
    if (!this.isDownloaded(quality)) this.markDownloaded(quality);
    return alpha;
  },
  describe() {
    if (!this.mode) return this.failed || 'not loaded';
    return `ready (${this.mode === 'worker' ? 'background worker' : 'on the page'}, ${this.isolated ? this.threads + ' cores' : '1 core'}) from ${this.base()}`;
  }
};
