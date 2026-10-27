/* ===================== 03 · PDF writer (no external libraries) =====================
 * Embeds TrueType subsets as Type0/CIDFontType2 (Identity-H) with ToUnicode → searchable text, ₹ works.
 * JPEG images (DCTDecode) with optional soft-mask alpha (cut-out products over any page colour).
 * Link annotations (WhatsApp / web), internal page links, bookmarks (outline), metadata.
 * Output is assembled from byte chunks into a Blob, so big catalogues don't need one huge string.
 */
const PDF_ = {
  latin1(s) { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; },
  num(n) { if (!isFinite(n)) return '0'; const r = Math.round(n * 1000) / 1000; return (Object.is(r, -0) ? 0 : r).toString(); },
  color(c) {
    if (Array.isArray(c)) return c.map(v => PDF_.num(v / 255)).join(' ');
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || '#000000') || [0, '00', '00', '00'];
    return [m[1], m[2], m[3]].map(x => PDF_.num(parseInt(x, 16) / 255)).join(' ');
  },
  str(s) {
    // ASCII → literal string; anything else → UTF-16BE hex with BOM
    s = String(s || '');
    if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/([\\()])/g, '\\$1') + ')';
    let hex = 'FEFF';
    for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
    return '<' + hex.toUpperCase() + '>';
  },
  async deflate(u8) {
    if (typeof CompressionStream === 'undefined') { try { return Deflate.zlib(u8); } catch (e) { return null; } }
    try {
      const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { return null; }
  },
  date(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', oh = p(Math.floor(Math.abs(off) / 60)), om = p(Math.abs(off) % 60);
    return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${sign}${oh}'${om}'`;
  }
};

class PDFWriter {
  constructor(meta = {}) {
    this.parts = []; this.pos = 0; this.offsets = [];
    this.nextId = 3; // 1 = Catalog, 2 = Pages
    this.pageIds = []; this.pageCount = 0;
    this.fonts = []; this.imageCount = 0; this.bookmarks = [];
    this.meta = meta;
    this._write('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  }
  alloc() { return this.nextId++; }
  _write(x) {
    const b = typeof x === 'string' ? PDF_.latin1(x) : x;
    this.parts.push(b); this.pos += b.byteLength;
  }
  _obj(id, body) { this.offsets[id] = this.pos; this._write(id + ' 0 obj\n' + body + '\nendobj\n'); }
  async _stream(id, dict, data, compress = true) {
    let bytes = data, filter = '';
    if (compress) { const z = await PDF_.deflate(data); if (z && z.length < data.length) { bytes = z; filter = ' /Filter /FlateDecode'; } }
    this.offsets[id] = this.pos;
    this._write(id + ' 0 obj\n<< ' + dict + filter + ' /Length ' + bytes.length + ' >>\nstream\n');
    this._write(bytes);
    this._write('\nendstream\nendobj\n');
  }
  /** Pre-allocate page object ids so contents pages can link forward. */
  reservePages(n) { while (this.pageIds.length < n) this.pageIds.push(this.alloc()); }
  addFont(ttf) {
    const existing = this.fonts.find(f => f.ttf === ttf); if (existing) return existing;
    const f = { key: 'F' + (this.fonts.length + 1), ttf, id: this.alloc() };
    this.fonts.push(f); return f;
  }
  /** JPEG bytes + optional alpha (Uint8Array w*h, 0..255) as soft mask */
  async addJPEG(bytes, w, h, alpha) {
    let smask = '';
    if (alpha) {
      const sid = this.alloc();
      await this._stream(sid, `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8`, alpha, true);
      smask = ` /SMask ${sid} 0 R`;
    }
    const id = this.alloc();
    await this._stream(id, `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode${smask}`, bytes, false);
    return { key: 'Im' + (++this.imageCount), id, w, h };
  }
  /** Raw RGB (Uint8Array w*h*3) lossless + optional alpha */
  async addRGB(rgb, w, h, alpha) {
    let smask = '';
    if (alpha) {
      const sid = this.alloc();
      await this._stream(sid, `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8`, alpha, true);
      smask = ` /SMask ${sid} 0 R`;
    }
    const id = this.alloc();
    await this._stream(id, `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8${smask}`, rgb, true);
    return { key: 'Im' + (++this.imageCount), id, w, h };
  }
  page(w, h) {
    const index = this.pageCount++;
    if (!this.pageIds[index]) this.pageIds[index] = this.alloc();
    return new PDFPage(this, w, h, index, this.pageIds[index]);
  }
  addBookmark(title, pageIndex) { this.bookmarks.push({ title, pageIndex }); }

  async finish() {
    // fonts
    let tagN = 0;
    for (const f of this.fonts) {
      const t = f.ttf, s = 1000 / t.upem;
      const tag = 'CM' + String.fromCharCode(65 + (tagN % 26), 65 + ((tagN / 26 | 0) % 26), 65 + (f.key.length % 26), 65 + 7) ; tagN++;
      const base = '/' + tag + '+' + (t.psName || 'Font');
      const fileId = this.alloc(), descId = this.alloc(), cidId = this.alloc(), tuId = this.alloc();
      await this._stream(fileId, `/Length1 ${t.bytes.length}`, t.bytes, true);
      const bb = t.bbox.map(v => Math.round(v * s));
      const ascent = Math.round((t.typoAsc || t.ascender) * s), descent = Math.round((t.typoDesc || t.descender) * s);
      this._obj(descId, `<< /Type /FontDescriptor /FontName ${base} /Flags 4 /FontBBox [${bb.join(' ')}] /ItalicAngle ${PDF_.num(t.italicAngle)} /Ascent ${ascent} /Descent ${descent} /CapHeight ${Math.round(t.capHeight * s)} /StemV ${t.weight >= 600 ? 140 : 80} /FontFile2 ${fileId} 0 R >>`);
      const widths = []; for (let g = 0; g < t.numGlyphs; g++) widths.push(Math.round(t.adv[g] * s));
      let W = ''; for (let i = 0; i < widths.length; i += 64) W += i + ' [' + widths.slice(i, i + 64).join(' ') + ']\n';
      this._obj(cidId, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont ${base} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descId} 0 R /DW 1000 /W [${W}] /CIDToGIDMap /Identity >>`);
      // ToUnicode for every mapped glyph (first code point wins)
      const rev = new Map();
      for (const [cp, g] of t.cmap) if (!rev.has(g) && cp <= 0xFFFF) rev.set(g, cp);
      const entries = Array.from(rev.entries()).sort((a, b) => a[0] - b[0]);
      let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100);
        cmap += chunk.length + ' beginbfchar\n' + chunk.map(([g, cp]) => '<' + g.toString(16).padStart(4, '0') + '> <' + cp.toString(16).padStart(4, '0') + '>').join('\n') + '\nendbfchar\n';
      }
      cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
      await this._stream(tuId, '', PDF_.latin1(cmap), true);
      this._obj(f.id, `<< /Type /Font /Subtype /Type0 /BaseFont ${base} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${tuId} 0 R >>`);
    }
    // page tree (only pages that were actually written)
    const kids = this.pageIds.slice(0, this.pageCount);
    this._obj(2, `<< /Type /Pages /Kids [${kids.map(id => id + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
    // outline
    let outlines = '';
    const bms = this.bookmarks.filter(b => b.pageIndex < this.pageCount);
    if (bms.length) {
      const rootId = this.alloc(); const ids = bms.map(() => this.alloc());
      bms.forEach((b, i) => {
        this._obj(ids[i], `<< /Title ${PDF_.str(b.title)} /Parent ${rootId} 0 R${i > 0 ? ` /Prev ${ids[i - 1]} 0 R` : ''}${i < bms.length - 1 ? ` /Next ${ids[i + 1]} 0 R` : ''} /Dest [${this.pageIds[b.pageIndex]} 0 R /Fit] >>`);
      });
      this._obj(rootId, `<< /Type /Outlines /First ${ids[0]} 0 R /Last ${ids[ids.length - 1]} 0 R /Count ${ids.length} >>`);
      outlines = ` /Outlines ${rootId} 0 R /PageMode /UseOutlines`;
    }
    const m = this.meta;
    const infoId = this.alloc();
    this._obj(infoId, `<< /Title ${PDF_.str(m.title || 'Catalogue')} /Author ${PDF_.str(m.author || '')} /Subject ${PDF_.str(m.subject || '')} /Creator ${PDF_.str(APP.name + ' ' + APP.version)} /Producer ${PDF_.str(APP.name)} /CreationDate ${PDF_.str(PDF_.date())} >>`);
    this._obj(1, `<< /Type /Catalog /Pages 2 0 R${outlines} /ViewerPreferences << /DisplayDocTitle true >> /Lang (en-IN) >>`);
    // xref
    const xrefPos = this.pos, size = this.nextId;
    let x = 'xref\n0 ' + size + '\n0000000000 65535 f \n';
    for (let i = 1; i < size; i++) {
      const o = this.offsets[i];
      x += o === undefined ? '0000000000 00000 f \n' : String(o).padStart(10, '0') + ' 00000 n \n';
    }
    const idHex = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    x += `trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R /ID [<${idHex}> <${idHex}>] >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    this._write(x);
    const blob = new Blob(this.parts, { type: 'application/pdf' });
    this.parts = [];
    return blob;
  }
}

class PDFPage {
  constructor(doc, w, h, index, id) {
    this.doc = doc; this.w = w; this.h = h; this.index = index; this.id = id;
    this.ops = []; this.fonts = new Map(); this.xobjs = new Map(); this.gs = new Map(); this.annots = [];
  }
  Y(y) { return this.h - y; }
  _alpha(a) {
    if (a === undefined || a >= 0.999) return;
    const k = 'G' + Math.round(a * 100);
    this.gs.set(k, a); this.ops.push('/' + k + ' gs');
  }
  _rrPath(x, y, w, h, r) {
    const n = PDF_.num, Y = v => this.Y(v);
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    if (!r) return `${n(x)} ${n(Y(y + h))} ${n(w)} ${n(h)} re`;
    const k = 0.5523 * r;
    return [
      `${n(x + r)} ${n(Y(y))} m`,
      `${n(x + w - r)} ${n(Y(y))} l`, `${n(x + w - r + k)} ${n(Y(y))} ${n(x + w)} ${n(Y(y + r - k))} ${n(x + w)} ${n(Y(y + r))} c`,
      `${n(x + w)} ${n(Y(y + h - r))} l`, `${n(x + w)} ${n(Y(y + h - r + k))} ${n(x + w - r + k)} ${n(Y(y + h))} ${n(x + w - r)} ${n(Y(y + h))} c`,
      `${n(x + r)} ${n(Y(y + h))} l`, `${n(x + r - k)} ${n(Y(y + h))} ${n(x)} ${n(Y(y + h - r + k))} ${n(x)} ${n(Y(y + h - r))} c`,
      `${n(x)} ${n(Y(y + r))} l`, `${n(x)} ${n(Y(y + r - k))} ${n(x + r - k)} ${n(Y(y))} ${n(x + r)} ${n(Y(y))} c`, 'h'
    ].join('\n');
  }
  rect(x, y, w, h, o = {}) {
    if (!o.fill && !o.stroke) return;
    this.ops.push('q'); this._alpha(o.alpha);
    if (o.fill) this.ops.push(PDF_.color(o.fill) + ' rg');
    if (o.stroke) this.ops.push(PDF_.color(o.stroke) + ' RG ' + PDF_.num(o.lw || 0.5) + ' w');
    this.ops.push(this._rrPath(x, y, w, h, o.r));
    this.ops.push(o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S');
    this.ops.push('Q');
  }
  circle(cx, cy, r, o = {}) {
    const n = PDF_.num, k = 0.5523 * r, Y = v => this.Y(v);
    this.ops.push('q'); this._alpha(o.alpha);
    this.ops.push(PDF_.color(o.fill || '#000') + ' rg');
    this.ops.push(`${n(cx + r)} ${n(Y(cy))} m ${n(cx + r)} ${n(Y(cy - k))} ${n(cx + k)} ${n(Y(cy - r))} ${n(cx)} ${n(Y(cy - r))} c ${n(cx - k)} ${n(Y(cy - r))} ${n(cx - r)} ${n(Y(cy - k))} ${n(cx - r)} ${n(Y(cy))} c ${n(cx - r)} ${n(Y(cy + k))} ${n(cx - k)} ${n(Y(cy + r))} ${n(cx)} ${n(Y(cy + r))} c ${n(cx + k)} ${n(Y(cy + r))} ${n(cx + r)} ${n(Y(cy + k))} ${n(cx + r)} ${n(Y(cy))} c f`);
    this.ops.push('Q');
  }
  line(x1, y1, x2, y2, color, lw = 0.5, alpha) {
    const n = PDF_.num;
    this.ops.push('q'); this._alpha(alpha);
    this.ops.push(`${PDF_.color(color)} RG ${n(lw)} w ${n(x1)} ${n(this.Y(y1))} m ${n(x2)} ${n(this.Y(y2))} l S Q`);
  }
  image(img, x, y, w, h, o = {}) {
    const n = PDF_.num;
    this.xobjs.set(img.key, img.id);
    this.ops.push('q'); this._alpha(o.alpha);
    if (o.clipR) this.ops.push(this._rrPath(x, y, w, h, o.clipR) + ' W n');
    this.ops.push(`${n(w)} 0 0 ${n(h)} ${n(x)} ${n(this.Y(y + h))} cm /${img.key} Do Q`);
  }
  /** y is the baseline (top-left page coordinates). */
  text(face, size, x, y, str, o = {}) {
    if (!str) return;
    const f = this.doc.addFont(face); this.fonts.set(f.key, f.id);
    const { gids, kerns } = face.shape(str);
    const sc = 1000 / face.upem;
    let tj = '[', run = '';
    for (let i = 0; i < gids.length; i++) {
      run += gids[i].toString(16).padStart(4, '0');
      const k = kerns[i];
      if (k && i < gids.length - 1) { tj += '<' + run + '> ' + PDF_.num(-k * sc) + ' '; run = ''; }
    }
    if (run) tj += '<' + run + '>';
    tj += '] TJ';
    this.ops.push('q'); this._alpha(o.alpha);
    this.ops.push('BT ' + PDF_.color(o.color || '#000') + ' rg /' + f.key + ' ' + PDF_.num(size) + ' Tf' + (o.tracking ? ' ' + PDF_.num(o.tracking * size) + ' Tc' : '') + ` 1 0 0 1 ${PDF_.num(x)} ${PDF_.num(this.Y(y))} Tm ${tj} ET Q`);
  }
  link(x, y, w, h, url) { this.annots.push({ x, y, w, h, url }); }
  goto(x, y, w, h, pageIndex) { this.annots.push({ x, y, w, h, page: pageIndex }); }
  async end() {
    const doc = this.doc, n = PDF_.num;
    const content = PDF_.latin1(this.ops.join('\n'));
    const cid = doc.alloc();
    await doc._stream(cid, '', content, true);
    const annIds = [];
    for (const a of this.annots) {
      const id = doc.alloc(); annIds.push(id);
      const rect = `[${n(a.x)} ${n(this.Y(a.y + a.h))} ${n(a.x + a.w)} ${n(this.Y(a.y))}]`;
      if (a.url) doc._obj(id, `<< /Type /Annot /Subtype /Link /Rect ${rect} /Border [0 0 0] /F 4 /A << /S /URI /URI ${PDF_.str(a.url)} >> >>`);
      else { const target = doc.pageIds[a.page]; doc._obj(id, `<< /Type /Annot /Subtype /Link /Rect ${rect} /Border [0 0 0] /F 4 /Dest [${target} 0 R /Fit] >>`); }
    }
    const fonts = Array.from(this.fonts).map(([k, id]) => `/${k} ${id} 0 R`).join(' ');
    const xo = Array.from(this.xobjs).map(([k, id]) => `/${k} ${id} 0 R`).join(' ');
    const gs = Array.from(this.gs).map(([k, a]) => `/${k} << /Type /ExtGState /ca ${n(a)} /CA ${n(a)} >>`).join(' ');
    const res = `<< /ProcSet [/PDF /Text /ImageB /ImageC]${fonts ? ' /Font << ' + fonts + ' >>' : ''}${xo ? ' /XObject << ' + xo + ' >>' : ''}${gs ? ' /ExtGState << ' + gs + ' >>' : ''} >>`;
    doc._obj(this.id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.w)} ${n(this.h)}] /Resources ${res} /Contents ${cid} 0 R${annIds.length ? ' /Annots [' + annIds.map(i => i + ' 0 R').join(' ') + ']' : ''} >>`);
    this.ops = null;
  }
}
