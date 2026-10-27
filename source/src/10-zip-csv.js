/* ===================== 10 · ZIP (backup/restore) and CSV (Excel import/export) ===================== */
const ZIP = (() => {
  const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  /** files: [{name, data: Blob|Uint8Array|string}] → Blob (stored, no compression: images are already compressed) */
  async function write(files, onProgress) {
    const parts = [], central = []; let offset = 0; const now = new Date(), tm = dosTime(now), dt = dosDate(now);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const bytes = typeof f.data === 'string' ? enc.encode(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
      const name = enc.encode(f.name), crc = crc32(bytes), size = bytes.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, typeof f.data === 'string' || f.data instanceof Uint8Array ? bytes : f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + size;
      if (offset > 0xFFFFFFF0) throw new Error('Backup too large for one file. Back up fewer products at a time.');
      onProgress && onProgress(i + 1, files.length);
      if (i % 25 === 0) await yieldUI();
    }
    let cdSize = 0; for (const c of central) cdSize += c.byteLength;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
  async function read(blob) {
    const size = blob.size, tailStart = Math.max(0, size - 65558);
    const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a valid backup file (zip).');
    const count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
    const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const entries = []; let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true), comp = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), lo = cd.getUint32(p + 42, true);
      const nameBytes = new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl);
      const name = (flags & 0x0800) ? dec.decode(nameBytes) : String.fromCharCode(...nameBytes);
      entries.push({
        name, size: usize, method,
        async blob(type) {
          const lh = new DataView(await blob.slice(lo, lo + 30).arrayBuffer());
          const start = lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
          const raw = blob.slice(start, start + comp);
          if (method === 0) return new Blob([raw], { type: type || '' });
          if (method === 8 && typeof DecompressionStream !== 'undefined') {
            const s = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Blob([await new Response(s).arrayBuffer()], { type: type || '' });
          }
          throw new Error('Unsupported compression in backup file');
        },
        async text() { return (await this.blob()).text(); }
      });
      p += 46 + nl + el + cl;
    }
    return entries;
  }
  return { write, read, crc32 };
})();

const CSV = (() => {
  function detectDelim(text) {
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    let best = ',', bestN = -1;
    for (const d of [',', ';', '\t', '|']) { let n = 0, q = false; for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } if (n > bestN) { bestN = n; best = d; } }
    return best;
  }
  function parse(text) {
    text = String(text || '').replace(/^﻿/, '');
    const d = detectDelim(text), rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }
  function stringify(rows) {
    const esc = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
  }
  const SYN = {
    id: ['id'],
    name: ['name', 'productname', 'itemname', 'item', 'title', 'model', 'modelname', 'description', 'desc', 'productdescription'],
    brand: ['brand', 'brandname', 'make', 'company', 'manufacturer', 'mfr', 'mfg'],
    size: ['size', 'packsize', 'pack', 'qty', 'quantity', 'weight', 'volume', 'capacity', 'dimension', 'dimensions', 'variant', 'netqty', 'netquantity'],
    mrp: ['mrp', 'mrprs', 'price', 'rate', 'sellingprice', 'sp', 'amount', 'cost', 'listprice', 'mrpinr', 'pricers'],
    product: ['product', 'category', 'type', 'producttype', 'group', 'range', 'subcategory', 'segment', 'class'],
    badge: ['badge', 'tag', 'label', 'offer', 'ribbon'],
    image: ['image', 'photo', 'picture', 'file', 'filename', 'imagefile', 'img', 'imagename', 'photofile'],
    code: ['sku', 'code', 'itemcode', 'productcode', 'barcode', 'ean', 'partno', 'partnumber', 'articleno', 'hsn']
  };
  function guess(headers) {
    const map = {}; const used = new Set();
    const norm = headers.map(h => normKey(h));
    for (const key of Object.keys(SYN)) {
      for (const syn of SYN[key]) { const i = norm.indexOf(syn); if (i >= 0 && !used.has(i)) { map[key] = i; used.add(i); break; } }
    }
    headers.forEach((h, i) => { if (!used.has(i) && String(h).trim()) map['x:' + String(h).trim()] = i; });
    return map;
  }
  return { parse, stringify, guess };
})();
