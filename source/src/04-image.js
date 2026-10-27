/* ===================== 04 · Image utilities ===================== */
const IMG = {
  supportsWebP: (() => { try { const c = document.createElement('canvas'); c.width = c.height = 2; return c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } })(),
  canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; },
  ctx(c) { return c.getContext('2d', { willReadFrequently: true }); },
  release(...cs) { for (const c of cs) if (c && c.width !== undefined) { c.width = 0; c.height = 0; } },
  dims(img) { return { w: img.naturalWidth || img.videoWidth || img.width, h: img.naturalHeight || img.videoHeight || img.height }; },

  /** Read width/height from a JPEG, PNG or WebP header without decoding the pixels. */
  async headerSize(blob) {
    try {
      const b = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer()), dv = new DataView(b.buffer);
      if (b[0] === 0x89 && b[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20) };
      if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
        const t = String.fromCharCode(b[12], b[13], b[14], b[15]);
        if (t === 'VP8X') return { w: 1 + (b[24] | b[25] << 8 | b[26] << 16), h: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
        if (t === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
        if (t === 'VP8L') { const v = dv.getUint32(21, true); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
      }
      if (b[0] === 0xFF && b[1] === 0xD8) {
        let i = 2;
        while (i + 9 < b.length) {
          if (b[i] !== 0xFF) { i++; continue; }
          const m = b[i + 1];
          if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) };
          i += 2 + dv.getUint16(i + 2);
        }
      }
    } catch (e) { }
    return null;
  },
  /** Decode a File/Blob into something drawable. Honors EXIF orientation. Very large photos are
   *  decoded straight to a smaller size when the browser allows it (a 108 MP photo would need ~430 MB). */
  async decode(blob, maxSide) {
    if (!blob) throw new Error('No image');
    if (maxSide && window.createImageBitmap) {
      const hs = await IMG.headerSize(blob);
      if (hs && hs.w && hs.h && Math.max(hs.w, hs.h) > maxSide * 1.6) {
        const s = (maxSide * 1.25) / Math.max(hs.w, hs.h);
        try { return await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: Math.max(1, Math.round(hs.w * s)), resizeQuality: 'high' }); } catch (e) { LOG.add('warn', 'reduced decode failed, using full decode', e.message); }
      }
    }
    const name = (blob.name || '').toLowerCase();
    if (/\.(heic|heif)$/.test(name) || /hei[cf]/.test(blob.type || '')) {
      // Safari can decode HEIC; other browsers cannot.
      try { return await IMG._viaImg(blob); } catch (e) { throw new Error('This photo is in HEIC format, which this browser cannot open. On iPhone: Settings → Camera → Formats → "Most Compatible", or pick the photo from the Photos app (it converts automatically).'); }
    }
    try { if (window.createImageBitmap) return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { }
    try { return await IMG._viaImg(blob); } catch (e) { throw new Error('Could not open this image (' + (blob.type || name || 'unknown type') + ').'); }
  },
  _viaImg(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 2000); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode failed')); };
      img.src = url;
    });
  },
  /** Draw image into a new canvas no larger than maxSide, with optional 90° rotation steps. */
  toCanvas(img, maxSide = 2000, rotation = 0) {
    let { w, h } = IMG.dims(img);
    const s = Math.min(1, maxSide / Math.max(w, h));
    let tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
    // step-down for big reductions (better quality on Safari)
    let src = img, sw = w, sh = h, tmp = null;
    while (sw / 2 > tw * 1.1) {
      const nw = Math.round(sw / 2), nh = Math.round(sh / 2);
      const c = IMG.canvas(nw, nh), cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high'; cx.drawImage(src, 0, 0, nw, nh);
      if (tmp) IMG.release(tmp);
      tmp = c; src = c; sw = nw; sh = nh;
    }
    const rot = ((rotation % 360) + 360) % 360;
    const out = rot === 90 || rot === 270 ? IMG.canvas(th, tw) : IMG.canvas(tw, th);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    if (rot === 90) { ctx.translate(th, 0); ctx.rotate(Math.PI / 2); }
    else if (rot === 180) { ctx.translate(tw, th); ctx.rotate(Math.PI); }
    else if (rot === 270) { ctx.translate(0, tw); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(src, 0, 0, tw, th);
    ctx.restore();
    if (tmp) IMG.release(tmp);
    return out;
  },
  toBlob(canvas, type = 'image/jpeg', quality = 0.9) {
    return new Promise((res, rej) => {
      try { canvas.toBlob(b => b ? res(b) : rej(new Error('Image encode failed (out of memory?)')), type, quality); }
      catch (e) { rej(e); }
    });
  },
  /** Best lossless-with-alpha format this browser can encode */
  alphaType() { return IMG.supportsWebP ? 'image/webp' : 'image/png'; },
  data(canvas) { return IMG.ctx(canvas).getImageData(0, 0, canvas.width, canvas.height); },
  fromData(id) { const c = IMG.canvas(id.width, id.height); c.getContext('2d').putImageData(id, 0, 0); return c; },
  gray(rgba, n) { const g = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) / 255; return g; },

  /** Photo quality: blur (variance of Laplacian), exposure, resolution → warnings */
  quality(canvas) {
    const s = Math.min(1, 480 / Math.max(canvas.width, canvas.height));
    const c = IMG.canvas(canvas.width * s, canvas.height * s); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    const { data, width: w, height: h } = IMG.data(c), n = w * h;
    const g = IMG.gray(data, n);
    let mean = 0; for (let i = 0; i < n; i++) mean += g[i]; mean /= n;
    let lsum = 0, lsq = 0, cnt = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const L = (g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]) * 255;
      lsum += L; lsq += L * L; cnt++;
    }
    const lvar = cnt ? lsq / cnt - (lsum / cnt) ** 2 : 0;
    IMG.release(c);
    const warnings = [];
    if (Math.min(canvas.width, canvas.height) < 480) warnings.push({ k: 'res', t: 'Low resolution — move closer or use the main camera' });
    if (lvar < 45) warnings.push({ k: 'blur', t: 'Looks blurry — hold steady and tap to focus' });
    if (mean < 0.24) warnings.push({ k: 'dark', t: 'Too dark — add light or move near a window' });
    if (mean > 0.93) warnings.push({ k: 'bright', t: 'Over-exposed — avoid direct light' });
    return { sharpness: Math.round(lvar), brightness: Math.round(mean * 100), warnings };
  },

  /** Auto look: luminance levels + gentle white balance from the brightest neutral area. */
  autoParams(rgba, w, h, alpha) {
    const n = w * h, hist = new Uint32Array(256);
    let wr = 0, wg = 0, wb = 0, wc = 0;
    const step = Math.max(1, Math.floor(n / 250000));
    for (let i = 0; i < n; i += step) {
      if (alpha && alpha[i] < 128) continue;
      const j = i * 4, r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
      const l = (r * 77 + g * 150 + b * 29) >> 8; hist[l]++;
    }
    let total = 0; for (let i = 0; i < 256; i++) total += hist[i];
    if (!total) return { lo: 0, hi: 255, wb: [1, 1, 1] };
    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.006) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.006) { hi = i; break; } }
    lo = Math.min(lo, 38); hi = Math.max(hi, 205);
    // white point from brightest 3% near-neutral pixels (whole photo, incl. background)
    const thr = (() => { let a = 0; for (let i = 255; i >= 0; i--) { a += hist[i]; if (a >= total * 0.03) return i; } return 230; })();
    for (let i = 0; i < n; i += step) {
      const j = i * 4, r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
      const l = (r * 77 + g * 150 + b * 29) >> 8;
      if (l < thr) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 40) continue; // skip strongly coloured highlights
      wr += r; wg += g; wb += b; wc++;
    }
    let wbv = [1, 1, 1];
    if (wc > 50) {
      const ar = wr / wc, ag = wg / wc, ab = wb / wc, m = (ar + ag + ab) / 3;
      wbv = [m / ar, m / ag, m / ab].map(v => clamp(v, 0.85, 1.18));
    }
    return { lo, hi, wb: wbv };
  },
  /** Apply look adjustments in place. p: {brightness,contrast,saturation,warmth,sharpen (−100..100), auto:{lo,hi,wb}} */
  adjust(id, p) {
    const d = id.data, n = id.width * id.height;
    const lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
    const a = p.auto || { lo: 0, hi: 255, wb: [1, 1, 1] };
    const br = (p.brightness || 0) * 1.1, ct = 1 + (p.contrast || 0) / 100, warm = (p.warmth || 0) * 0.35;
    for (let c = 0; c < 3; c++) for (let v = 0; v < 256; v++) {
      let x = (v - a.lo) * 255 / Math.max(1, a.hi - a.lo);
      x = x * a.wb[c];
      x = (x - 128) * ct + 128 + br;
      if (c === 0) x += warm; if (c === 2) x -= warm;
      lut[c][v] = x;
    }
    const sat = 1 + (p.saturation || 0) / 100;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      let r = lut[0][d[j]], g = lut[1][d[j + 1]], b = lut[2][d[j + 2]];
      if (sat !== 1) { const L = 0.299 * r + 0.587 * g + 0.114 * b; r = L + (r - L) * sat; g = L + (g - L) * sat; b = L + (b - L) * sat; }
      d[j] = r; d[j + 1] = g; d[j + 2] = b;
    }
    if (p.sharpen > 0) IMG.sharpen(id, p.sharpen / 100);
    return id;
  },
  sharpen(id, amount) {
    const w = id.width, h = id.height, d = id.data, src = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const j = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const k = j + c;
        const blur = (src[k - 4] + src[k + 4] + src[k - w * 4] + src[k + w * 4] + src[k] * 4) / 8;
        d[k] = src[k] + (src[k] - blur) * amount * 1.6;
      }
    }
  },

  /** Split RGBA into opaque edge-extended RGB (no halos) + alpha. Used for PDF soft-masked images. */
  splitAlpha(rgba, w, h, passes = 8) {
    const n = w * h, alpha = new Uint8Array(n), rgb = new Uint8Array(n * 3);
    const done = new Uint8Array(n);
    let sr = 0, sg = 0, sb = 0, sc = 0;
    let anyTransparent = false;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const a = rgba[j + 3]; alpha[i] = a;
      if (a >= 250) { rgb[i * 3] = rgba[j]; rgb[i * 3 + 1] = rgba[j + 1]; rgb[i * 3 + 2] = rgba[j + 2]; done[i] = 1; sr += rgba[j]; sg += rgba[j + 1]; sb += rgba[j + 2]; sc++; }
      else anyTransparent = true;
    }
    if (!anyTransparent) return { rgb, alpha: null };
    // grow colours outward from solid pixels, layer by layer
    let frontier = [];
    for (let i = 0; i < n; i++) if (!done[i]) {
      const x = i % w, y = (i / w) | 0;
      if ((x > 0 && done[i - 1]) || (x < w - 1 && done[i + 1]) || (y > 0 && done[i - w]) || (y < h - 1 && done[i + w])) frontier.push(i);
    }
    for (let p = 0; p < passes && frontier.length; p++) {
      const vals = new Uint8Array(frontier.length * 3), ok = new Uint8Array(frontier.length);
      frontier.forEach((i, fi) => {
        const x = i % w, y = (i / w) | 0; let r = 0, g = 0, b = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const k = yy * w + xx;
          if (done[k]) { r += rgb[k * 3]; g += rgb[k * 3 + 1]; b += rgb[k * 3 + 2]; c++; }
        }
        if (c) { vals[fi * 3] = r / c; vals[fi * 3 + 1] = g / c; vals[fi * 3 + 2] = b / c; ok[fi] = 1; }
      });
      const next = [];
      frontier.forEach((i, fi) => { if (ok[fi]) { rgb[i * 3] = vals[fi * 3]; rgb[i * 3 + 1] = vals[fi * 3 + 1]; rgb[i * 3 + 2] = vals[fi * 3 + 2]; done[i] = 2; } });
      frontier.forEach((i) => {
        const x = i % w, y = (i / w) | 0;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const k of nb) if (k >= 0 && !done[k]) { done[k] = 3; next.push(k); }
      });
      for (const k of next) done[k] = 0;
      frontier = next;
    }
    const mr = sc ? sr / sc : 255, mg = sc ? sg / sc : 255, mb = sc ? sb / sc : 255;
    for (let i = 0; i < n; i++) if (!done[i]) { rgb[i * 3] = mr; rgb[i * 3 + 1] = mg; rgb[i * 3 + 2] = mb; }
    return { rgb, alpha };
  },

  /** Crop to non-transparent content + uniform padding (fixes "gap between image and text"). */
  trim(canvas, padFrac = 0.02, thr = 10) {
    const { data, width: w, height: h } = IMG.data(canvas);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) if (data[row + x * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    if (x1 < 0) return canvas; // fully transparent – leave as is
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * padFrac);
    const nx0 = Math.max(0, x0 - pad), ny0 = Math.max(0, y0 - pad), nx1 = Math.min(w - 1, x1 + pad), ny1 = Math.min(h - 1, y1 + pad);
    const out = IMG.canvas(nx1 - nx0 + 1, ny1 - ny0 + 1);
    out.getContext('2d').drawImage(canvas, nx0, ny0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  },

  /** Logo: remove a flat background (global colour key or connected-only) and trim. */
  async processLogo(blob, mode = 'global') {
    const img = await IMG.decode(blob);
    const c = IMG.toCanvas(img, 1400);
    if (img.close) img.close();
    const id = IMG.data(c), d = id.data, w = c.width, h = c.height, n = w * h;
    let transparent = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 240) transparent++;
    let removed = false;
    if (mode !== 'keep' && transparent / n < 0.02) {
      // background colour = median of border pixels
      const rs = [], gs = [], bs = [];
      const push = (x, y) => { const j = (y * w + x) * 4; rs.push(d[j]); gs.push(d[j + 1]); bs.push(d[j + 2]); };
      for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
      const med = a => a.sort((p, q) => p - q)[a.length >> 1];
      const B = [med(rs), med(gs), med(bs)];
      // how uniform is the border? if very mixed, it's a photo-like logo – keep as is
      let spread = 0; for (let i = 0; i < rs.length; i++) spread += Math.abs(rs[i] - B[0]) + Math.abs(gs[i] - B[1]) + Math.abs(bs[i] - B[2]); spread /= rs.length;
      if (spread < 40) {
        const t0 = 14, t1 = 48;
        const alphaAt = (j) => { const dist = Math.hypot(d[j] - B[0], d[j + 1] - B[1], d[j + 2] - B[2]); return dist <= t0 ? 0 : dist >= t1 ? 1 : (dist - t0) / (t1 - t0); };
        let keyMask = null;
        if (mode === 'connected') {
          keyMask = new Uint8Array(n); const q = new Int32Array(n); let qh = 0, qt = 0;
          const seed = (i) => { if (!keyMask[i] && alphaAt(i * 4) < 1) { keyMask[i] = 1; q[qt++] = i; } };
          for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
          for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
          while (qh < qt) { const i = q[qh++], x = i % w, y = (i / w) | 0; if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (y > 0) seed(i - w); if (y < h - 1) seed(i + w); }
        }
        for (let i = 0, j = 0; i < n; i++, j += 4) {
          if (keyMask && !keyMask[i]) continue;
          const a = alphaAt(j);
          if (a >= 1) continue;
          if (a <= 0) { d[j + 3] = 0; continue; }
          // un-blend the known background colour from anti-aliased edges
          for (let k = 0; k < 3; k++) d[j + k] = clamp((d[j + k] - (1 - a) * B[k]) / a, 0, 255);
          d[j + 3] = Math.round(a * 255);
        }
        IMG.ctx(c).putImageData(id, 0, 0);
        removed = true;
      }
    }
    const t = IMG.trim(c, 0.01, 8);
    const out = await IMG.toBlob(t, 'image/png');
    const res = { blob: out, w: t.width, h: t.height, removed };
    if (t !== c) IMG.release(c);
    IMG.release(t);
    return res;
  },
  /** Soft elliptical contact shadow (alpha only) used under products. */
  shadowAlpha(w, h, strength = 0.55) {
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const r2 = dx * dx + dy * dy;
      a[y * w + x] = Math.round(255 * strength * Math.exp(-r2 * 3.2) * (r2 < 1 ? 1 : Math.max(0, 1.6 - r2 * 0.6)));
    }
    return a;
  }
};
