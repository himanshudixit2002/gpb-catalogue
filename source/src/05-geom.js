/* ===================== 05 · Geometry: 4-corner perspective ("front view") ===================== */
const GEOM = {
  /** 3×3 homography mapping src[i] -> dst[i] (4 points each, [{x,y}]) */
  homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = src[i], u = dst[i].x, v = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = GEOM.solve(A, b);
    if (!h) return null;
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  },
  solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
  area(q) { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; },
  convex(q) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cr) < 1e-9) continue;
      const s = Math.sign(cr); if (!sign) sign = s; else if (s !== sign) return false;
    }
    return true;
  },
  isRect(q, tol = 0.004) { // axis-aligned within tolerance (normalised coords)
    return Math.abs(q[0].y - q[1].y) < tol && Math.abs(q[3].y - q[2].y) < tol && Math.abs(q[0].x - q[3].x) < tol && Math.abs(q[1].x - q[2].x) < tol;
  },
  /** Output size for a quad in pixel coords, honouring aspect choice and max side. */
  outSize(q, aspect = 'auto', maxSide = 1400) {
    let W = Math.max(GEOM.dist(q[0], q[1]), GEOM.dist(q[3], q[2]));
    let H = Math.max(GEOM.dist(q[0], q[3]), GEOM.dist(q[1], q[2]));
    const fixed = { '1:1': 1, '3:4': 3 / 4, '4:3': 4 / 3, '2:3': 2 / 3, '9:16': 9 / 16 }[aspect];
    if (fixed) { const big = Math.max(W, H); if (fixed >= 1) { W = big; H = big / fixed; } else { H = big; W = big * fixed; } }
    const s = Math.min(1, maxSide / Math.max(W, H));
    return { w: Math.max(8, Math.round(W * s)), h: Math.max(8, Math.round(H * s)) };
  },
  /**
   * Perspective warp. src: ImageData (RGBA). mask: optional {data:Uint8Array, w, h} in the same
   * image space (any resolution). quad: 4 points in src pixel coords (TL,TR,BR,BL).
   * Returns ImageData of size outW×outH; alpha comes from the mask (bilinear).
   */
  warp(src, mask, quad, outW, outH) {
    const sw = src.width, sh = src.height, sd = src.data;
    const dstQ = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
    const H = GEOM.homography(dstQ, quad);
    if (!H) throw new Error('Corners are invalid – drag them into a proper four-sided shape.');
    const out = new ImageData(outW, outH), od = out.data;
    const mw = mask ? mask.w : 0, mh = mask ? mask.h : 0, md = mask ? mask.data : null;
    const msx = mask ? mw / sw : 0, msy = mask ? mh / sh : 0;
    for (let Y = 0; Y < outH; Y++) {
      const yy = Y + 0.5;
      let nx = H[0] * 0.5 + H[1] * yy + H[2], ny = H[3] * 0.5 + H[4] * yy + H[5], dz = H[6] * 0.5 + H[7] * yy + H[8];
      let o = Y * outW * 4;
      for (let X = 0; X < outW; X++, o += 4, nx += H[0], ny += H[3], dz += H[6]) {
        const x = nx / dz - 0.5, y = ny / dz - 0.5;
        if (x < -1 || y < -1 || x > sw || y > sh) { od[o + 3] = 0; continue; }
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const xa = x0 < 0 ? 0 : x0 >= sw ? sw - 1 : x0, xb = x0 + 1 < 0 ? 0 : x0 + 1 >= sw ? sw - 1 : x0 + 1;
        const ya = y0 < 0 ? 0 : y0 >= sh ? sh - 1 : y0, yb = y0 + 1 < 0 ? 0 : y0 + 1 >= sh ? sh - 1 : y0 + 1;
        const i00 = (ya * sw + xa) * 4, i10 = (ya * sw + xb) * 4, i01 = (yb * sw + xa) * 4, i11 = (yb * sw + xb) * 4;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        od[o] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
        od[o + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
        od[o + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
        if (md) {
          const mx = (x + 0.5) * msx - 0.5, my = (y + 0.5) * msy - 0.5;
          const mx0 = Math.floor(mx), my0 = Math.floor(my), gx = mx - mx0, gy = my - my0;
          const ax = mx0 < 0 ? 0 : mx0 >= mw ? mw - 1 : mx0, bx = mx0 + 1 >= mw ? mw - 1 : mx0 + 1 < 0 ? 0 : mx0 + 1;
          const ay = my0 < 0 ? 0 : my0 >= mh ? mh - 1 : my0, by = my0 + 1 >= mh ? mh - 1 : my0 + 1 < 0 ? 0 : my0 + 1;
          od[o + 3] = md[ay * mw + ax] * (1 - gx) * (1 - gy) + md[ay * mw + bx] * gx * (1 - gy) + md[by * mw + ax] * (1 - gx) * gy + md[by * mw + bx] * gx * gy;
        } else od[o + 3] = 255;
      }
    }
    return out;
  },
  /**
   * Suggest corners from a cut-out mask (normalised 0..1 coords).
   * Box-like products → true 4-corner quad (perspective fix). Rounded/irregular products → bounding box
   * (so bottles and bags are not stretched).
   */
  quadFromMask(mask, w, h) {
    const s = Math.min(1, 220 / Math.max(w, h)), W = Math.max(2, Math.round(w * s)), Hh = Math.max(2, Math.round(h * s));
    let tl = null, tr = null, br = null, bl = null, minS = 1e9, maxS = -1e9, minD = 1e9, maxD = -1e9;
    let x0 = W, y0 = Hh, x1 = -1, y1 = -1, count = 0;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const v = mask[Math.min(h - 1, Math.floor((y + 0.5) / s)) * w + Math.min(w - 1, Math.floor((x + 0.5) / s))];
      if (v < 128) continue;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const sm = x + y, df = x - y;
      if (sm < minS) { minS = sm; tl = { x, y }; } if (sm > maxS) { maxS = sm; br = { x, y }; }
      if (df > maxD) { maxD = df; tr = { x, y }; } if (df < minD) { minD = df; bl = { x, y }; }
    }
    if (!count || x1 - x0 < 4 || y1 - y0 < 4) return { quad: GEOM.defaultQuad(), boxLike: false, found: false };
    if (count / (W * Hh) > 0.96) return { quad: GEOM.fullQuad(), boxLike: false, found: false }; // product fills the frame
    // confidence: a product that touches the photo edges or covers most of it is probably mixed with clutter
    let edgeHits = 0, edgeTotal = 0;
    for (let x = 0; x < W; x++) { edgeTotal += 2; if (mask[Math.min(h - 1, Math.floor(0.5 / s)) * w + Math.min(w - 1, Math.floor((x + 0.5) / s))] >= 128) edgeHits++; if (mask[Math.min(h - 1, Math.floor((Hh - 0.5) / s)) * w + Math.min(w - 1, Math.floor((x + 0.5) / s))] >= 128) edgeHits++; }
    for (let y = 0; y < Hh; y++) { edgeTotal += 2; if (mask[Math.min(h - 1, Math.floor((y + 0.5) / s)) * w] >= 128) edgeHits++; if (mask[Math.min(h - 1, Math.floor((y + 0.5) / s)) * w + w - 1] >= 128) edgeHits++; }
    const cover = count / (W * Hh);
    const confident = edgeHits / edgeTotal < 0.04 && cover > 0.03 && cover < 0.8;
    const norm = p => ({ x: clamp((p.x + 0.5) / W, 0, 1), y: clamp((p.y + 0.5) / Hh, 0, 1) });
    const quad = [tl, tr, br, bl].map(norm);
    const qa = GEOM.area([tl, tr, br, bl]);
    const rectangularity = qa > 0 ? count / qa : 0;
    const bboxFill = count / ((x1 - x0 + 1) * (y1 - y0 + 1));
    const boxLike = rectangularity > 0.9 && rectangularity < 1.12 && GEOM.convex(quad) && bboxFill > 0.55;
    if (boxLike) {
      // expand slightly outward so the edges are not clipped
      const cx = quad.reduce((a, p) => a + p.x, 0) / 4, cy = quad.reduce((a, p) => a + p.y, 0) / 4;
      return { quad: quad.map(p => ({ x: clamp(cx + (p.x - cx) * 1.012, 0, 1), y: clamp(cy + (p.y - cy) * 1.012, 0, 1) })), boxLike: true, found: true, confident };
    }
    const m = 0.015;
    const bx0 = clamp(x0 / W - m, 0, 1), by0 = clamp(y0 / Hh - m, 0, 1), bx1 = clamp((x1 + 1) / W + m, 0, 1), by1 = clamp((y1 + 1) / Hh + m, 0, 1);
    return { quad: [{ x: bx0, y: by0 }, { x: bx1, y: by0 }, { x: bx1, y: by1 }, { x: bx0, y: by1 }], boxLike: false, found: true, confident };
  },
  defaultQuad(inset = 0.06) { return [{ x: inset, y: inset }, { x: 1 - inset, y: inset }, { x: 1 - inset, y: 1 - inset }, { x: inset, y: 1 - inset }]; },
  fullQuad() { return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]; },
  bounds(q) { const xs = q.map(p => p.x), ys = q.map(p => p.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; },
  pointInQuad(p, q) {
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const a = q[i], b = q[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  },
  /** Scale quad about its centroid */
  scaleQuad(q, f) { const cx = q.reduce((a, p) => a + p.x, 0) / 4, cy = q.reduce((a, p) => a + p.y, 0) / 4; return q.map(p => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })); }
};
