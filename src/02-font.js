/* ===================== 02 · Font engine (TrueType parsing, metrics, kerning, wrapping) ===================== */
class TTF {
  constructor(bytes, name) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.name = name || 'Font';
    const dv = this.dv = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    const numTables = dv.getUint16(4);
    this.tables = {};
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
      this.tables[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
    }
    const head = this.tables.head.off;
    this.upem = dv.getUint16(head + 18);
    this.bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
    const hhea = this.tables.hhea.off;
    this.ascender = dv.getInt16(hhea + 4);
    this.descender = dv.getInt16(hhea + 6);
    const numHM = dv.getUint16(hhea + 34);
    this.numGlyphs = dv.getUint16(this.tables.maxp.off + 4);
    const hmtx = this.tables.hmtx.off;
    this.adv = new Uint16Array(this.numGlyphs);
    let last = 0;
    for (let g = 0; g < this.numGlyphs; g++) {
      if (g < numHM) last = dv.getUint16(hmtx + g * 4);
      this.adv[g] = last;
    }
    this.capHeight = Math.round(this.ascender * 0.7);
    this.xHeight = Math.round(this.ascender * 0.5);
    this.weight = 400;
    if (this.tables['OS/2']) {
      const os2 = this.tables['OS/2'].off, ver = dv.getUint16(os2);
      this.weight = dv.getUint16(os2 + 4);
      this.typoAsc = dv.getInt16(os2 + 68); this.typoDesc = dv.getInt16(os2 + 70);
      if (ver >= 2) { this.xHeight = dv.getInt16(os2 + 86) || this.xHeight; this.capHeight = dv.getInt16(os2 + 88) || this.capHeight; }
    }
    this.italicAngle = 0;
    if (this.tables.post) { const p = this.tables.post.off; this.italicAngle = dv.getInt16(p + 4) + dv.getUint16(p + 6) / 65536; }
    this.psName = this._readName(6) || this.name.replace(/\s+/g, '');
    this.cmap = new Map();
    this._parseCmap();
    this._kernCache = new Map();
    this._parseGPOS();
  }
  _readName(id) {
    const t = this.tables.name; if (!t) return null;
    const dv = this.dv, o = t.off, count = dv.getUint16(o + 2), strOff = o + dv.getUint16(o + 4);
    let best = null;
    for (let i = 0; i < count; i++) {
      const r = o + 6 + i * 12;
      const pid = dv.getUint16(r), eid = dv.getUint16(r + 2), nid = dv.getUint16(r + 6), len = dv.getUint16(r + 8), off = dv.getUint16(r + 10);
      if (nid !== id) continue;
      let s = '';
      if (pid === 3 || pid === 0) { for (let k = 0; k < len; k += 2) s += String.fromCharCode(dv.getUint16(strOff + off + k)); }
      else if (pid === 1) { for (let k = 0; k < len; k++) s += String.fromCharCode(dv.getUint8(strOff + off + k)); }
      if (s) { best = s; if (pid === 3) break; }
    }
    return best ? best.replace(/[^\x21-\x7e]/g, '') : null;
  }
  _parseCmap() {
    const dv = this.dv, base = this.tables.cmap.off, n = dv.getUint16(base + 2);
    let off4 = 0, off12 = 0;
    for (let i = 0; i < n; i++) {
      const r = base + 4 + i * 8, pid = dv.getUint16(r), eid = dv.getUint16(r + 2), off = dv.getUint32(r + 4);
      const fmt = dv.getUint16(base + off);
      if (fmt === 12 && (pid === 3 || pid === 0)) off12 = base + off;
      if (fmt === 4 && ((pid === 3 && eid === 1) || pid === 0)) off4 = off4 || base + off;
    }
    if (off12) {
      const groups = dv.getUint32(off12 + 12);
      for (let g = 0; g < groups; g++) {
        const r = off12 + 16 + g * 12, s = dv.getUint32(r), e = dv.getUint32(r + 4), sg = dv.getUint32(r + 8);
        for (let c = s; c <= e && c - s < 70000; c++) this.cmap.set(c, sg + (c - s));
      }
    } else if (off4) {
      const segX2 = dv.getUint16(off4 + 6), seg = segX2 / 2;
      const endO = off4 + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (let i = 0; i < seg; i++) {
        const end = dv.getUint16(endO + i * 2), start = dv.getUint16(startO + i * 2);
        const delta = dv.getInt16(deltaO + i * 2), ro = dv.getUint16(rangeO + i * 2);
        if (start === 0xFFFF) continue;
        for (let c = start; c <= end; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xFFFF;
          else {
            const addr = rangeO + i * 2 + ro + (c - start) * 2;
            g = dv.getUint16(addr); if (g !== 0) g = (g + delta) & 0xFFFF;
          }
          if (g) this.cmap.set(c, g);
        }
      }
    }
  }
  /* ---- GPOS pair kerning (PairPos format 1 & 2, incl. Extension lookups) ---- */
  _parseGPOS() {
    this.kernSubtables = [];
    const t = this.tables.GPOS; if (!t) return;
    const dv = this.dv, g = t.off;
    try {
      const featList = g + dv.getUint16(g + 6), lookupList = g + dv.getUint16(g + 8);
      const fCount = dv.getUint16(featList);
      const lookupIdx = new Set();
      for (let i = 0; i < fCount; i++) {
        const r = featList + 2 + i * 6;
        const tag = String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3));
        if (tag !== 'kern') continue;
        const f = featList + dv.getUint16(r + 4), cnt = dv.getUint16(f + 2);
        for (let k = 0; k < cnt; k++) lookupIdx.add(dv.getUint16(f + 4 + k * 2));
      }
      const lookups = [];
      for (const li of Array.from(lookupIdx).sort((a, b) => a - b)) {
        const lo = lookupList + dv.getUint16(lookupList + 2 + li * 2);
        let type = dv.getUint16(lo); const subCount = dv.getUint16(lo + 4);
        const subs = [];
        for (let s = 0; s < subCount; s++) {
          let so = lo + dv.getUint16(lo + 6 + s * 2), st = type;
          if (type === 9) { st = dv.getUint16(so + 2); so = so + dv.getUint32(so + 4); }
          if (st !== 2) continue;
          subs.push(this._readPairPos(so));
        }
        if (subs.length) lookups.push(subs);
      }
      this.kernLookups = lookups;
    } catch (e) { this.kernLookups = []; LOG.add('warn', 'GPOS parse failed for ' + this.name, e.message); }
  }
  _coverage(o) {
    const dv = this.dv, fmt = dv.getUint16(o), map = new Map();
    if (fmt === 1) { const n = dv.getUint16(o + 2); for (let i = 0; i < n; i++) map.set(dv.getUint16(o + 4 + i * 2), i); }
    else if (fmt === 2) {
      const n = dv.getUint16(o + 2);
      for (let i = 0; i < n; i++) { const r = o + 4 + i * 6, s = dv.getUint16(r), e = dv.getUint16(r + 2), si = dv.getUint16(r + 4); for (let gg = s; gg <= e; gg++) map.set(gg, si + gg - s); }
    }
    return map;
  }
  _classDef(o) {
    const dv = this.dv, fmt = dv.getUint16(o), map = new Map();
    if (fmt === 1) { const s = dv.getUint16(o + 2), n = dv.getUint16(o + 4); for (let i = 0; i < n; i++) map.set(s + i, dv.getUint16(o + 6 + i * 2)); }
    else if (fmt === 2) { const n = dv.getUint16(o + 2); for (let i = 0; i < n; i++) { const r = o + 4 + i * 6, s = dv.getUint16(r), e = dv.getUint16(r + 2), c = dv.getUint16(r + 4); for (let gg = s; gg <= e; gg++) map.set(gg, c); } }
    return map;
  }
  static _vrSize(vf) { let n = 0; for (let b = 0; b < 8; b++) if (vf & (1 << b)) n++; return n * 2; }
  static _xAdvOff(vf) { if (!(vf & 4)) return -1; let n = 0; if (vf & 1) n++; if (vf & 2) n++; return n * 2; }
  _readPairPos(o) {
    const dv = this.dv, fmt = dv.getUint16(o);
    const cov = this._coverage(o + dv.getUint16(o + 2));
    const vf1 = dv.getUint16(o + 4), vf2 = dv.getUint16(o + 6);
    const s1 = TTF._vrSize(vf1), s2 = TTF._vrSize(vf2), xo = TTF._xAdvOff(vf1);
    if (fmt === 1) {
      const setCount = dv.getUint16(o + 8), sets = [];
      for (let i = 0; i < setCount; i++) {
        const ps = o + dv.getUint16(o + 10 + i * 2), n = dv.getUint16(ps), m = new Map();
        for (let k = 0; k < n; k++) {
          const r = ps + 2 + k * (2 + s1 + s2);
          m.set(dv.getUint16(r), xo >= 0 ? dv.getInt16(r + 2 + xo) : 0);
        }
        sets.push(m);
      }
      return { fmt: 1, cov, sets };
    }
    const cd1 = this._classDef(o + dv.getUint16(o + 8)), cd2 = this._classDef(o + dv.getUint16(o + 10));
    const c1 = dv.getUint16(o + 12), c2 = dv.getUint16(o + 14);
    const vals = new Int16Array(c1 * c2), rec = s1 + s2;
    for (let a = 0; a < c1; a++) for (let b = 0; b < c2; b++) {
      const r = o + 16 + (a * c2 + b) * rec;
      vals[a * c2 + b] = xo >= 0 ? dv.getInt16(r + xo) : 0;
    }
    return { fmt: 2, cov, cd1, cd2, c2, c1, vals };
  }
  kern(g1, g2) {
    if (!this.kernLookups || !this.kernLookups.length) return 0;
    const key = g1 * 65536 + g2;
    const c = this._kernCache.get(key); if (c !== undefined) return c;
    let total = 0;
    for (const subs of this.kernLookups) {
      for (const st of subs) {
        const ci = st.cov.get(g1); if (ci === undefined) continue;
        if (st.fmt === 1) { const v = st.sets[ci] && st.sets[ci].get(g2); if (v === undefined) continue; total += v; break; }
        const a = st.cd1.get(g1) || 0, b = st.cd2.get(g2) || 0;
        if (a < st.c1 && b < st.c2) total += st.vals[a * st.c2 + b];
        break;
      }
    }
    this._kernCache.set(key, total);
    return total;
  }
  gid(cp) { return this.cmap.get(cp) || 0; }
  covers(str) { for (const ch of str) { const cp = ch.codePointAt(0); if (cp > 32 && !this.cmap.has(cp)) return false; } return true; }
  /** glyph run with per-glyph x offsets in font units (kerning applied) */
  shape(str) {
    const gids = [], cps = [];
    for (const ch of str) { const cp = ch.codePointAt(0); cps.push(cp); gids.push(this.gid(cp)); }
    const kerns = new Array(gids.length).fill(0);
    for (let i = 0; i + 1 < gids.length; i++) kerns[i] = this.kern(gids[i], gids[i + 1]);
    return { gids, cps, kerns };
  }
  /** width in points */
  width(str, size, tracking = 0) {
    if (!str) return 0;
    let w = 0, n = 0, prev = -1;
    for (const ch of str) {
      const g = this.gid(ch.codePointAt(0));
      if (prev >= 0) w += this.kern(prev, g);
      w += this.adv[g] || 0; prev = g; n++;
    }
    return w * size / this.upem + (n > 1 ? tracking * size * (n - 1) : 0);
  }
}

/* Embedded font registry. FONT_DATA is injected by the build step (base64 TTF subsets). */
const Fonts = {
  ready: false, faces: {},
  families: {
    sans: { css: 'CM Sans', regular: 'poppins-400', medium: 'poppins-500', bold: 'poppins-700' },
    serif: { css: 'CM Serif', regular: 'lora-400', medium: 'lora-700', bold: 'lora-700' }
  },
  async init() {
    if (this.ready) return;
    for (const key in FONT_DATA) {
      const bytes = b64ToBytes(FONT_DATA[key]);
      this.faces[key] = new TTF(bytes, key);
    }
    // Register the same files for on-screen canvas previews so preview == PDF.
    try {
      const defs = [['CM Sans', 'poppins-400', '400'], ['CM Sans', 'poppins-500', '500'], ['CM Sans', 'poppins-700', '700'], ['CM Serif', 'lora-400', '400'], ['CM Serif', 'lora-700', '700']];
      const loads = [];
      for (const [fam, key, weight] of defs) {
        if (!this.faces[key] || typeof FontFace === 'undefined') continue;
        const ff = new FontFace(fam, this.faces[key].bytes.slice().buffer, { weight, style: 'normal' });
        document.fonts.add(ff); loads.push(ff.load());
      }
      await Promise.all(loads);
    } catch (e) { LOG.add('warn', 'FontFace registration failed', e.message); }
    this.ready = true;
  },
  /** face for family + weight token: 'regular' | 'medium' | 'bold' */
  face(family, weight) { const f = this.families[family] || this.families.sans; return this.faces[f[weight] || f.regular]; },
  css(family, weight) { const f = this.families[family] || this.families.sans; const w = weight === 'bold' ? 700 : weight === 'medium' ? (family === 'serif' ? 700 : 500) : 400; return { family: f.css, weight: w }; }
};

/** Greedy word wrap using real font metrics. Returns array of line strings. */
function wrapLines(measure, str, maxW, maxLines = 99) {
  const words = String(str || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = []; let cur = '';
  const pushWordPieces = (w) => {
    // word longer than a line: hard-break by characters
    let piece = '';
    for (const ch of w) {
      if (measure(piece + ch) > maxW && piece) { lines.push(piece); piece = ch; }
      else piece += ch;
    }
    return piece;
  };
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(t) <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur);
    cur = measure(w) > maxW ? pushWordPieces(w) : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] + ' ' + lines.slice(maxLines).join(' ');
    while (last.length > 1 && measure(last + '…') > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = last.replace(/[\s,.;:-]+$/, '') + '…';
    return kept;
  }
  return lines;
}
