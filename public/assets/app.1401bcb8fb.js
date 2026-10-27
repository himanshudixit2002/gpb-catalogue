const SITE = {"name": "GPB Catalogue", "short_name": "GPB Catalogue", "url": "https://gpb-catalogue.web.app/", "repo": "https://github.com/himanshudixit2002/gpb-catalogue", "ai": "1.7.0", "build": "site"};
/* ---- 00-util.js ---- */
/* ===================== 00 · Utilities ===================== */
'use strict';
const APP = { name: 'Catalogue Maker', version: '2.1.0', build: '2026-10-27' };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Tiny element factory: h('div', {class:'x', onclick:fn}, 'text', child, [more]) */
function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'polygon' || tag === 'circle' || tag === 'rect' || tag === 'g' || tag === 'line' || tag === 'polyline'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple' || k === 'hidden') { if (v) el.setAttribute(k, ''); el[k] = !!v; }
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendKids(el, children);
  return el;
}
function appendKids(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

const uid = () => {
  if (window.crypto && crypto.getRandomValues) {
    const a = new Uint8Array(9); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const yieldUI = () => new Promise(r => setTimeout(r, 0));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

function debounce(fn, ms) {
  let t = 0;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = (...args) => { clearTimeout(t); return fn(...args); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/* ---- money & numbers (Indian grouping) ---- */
const INR = (() => { try { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }); } catch (e) { return null; } })();
function parseMoney(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[₹,\s]|rs\.?|inr|mrp/gi, '').trim();
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}
function groupIN(n) {
  if (INR) return INR.format(n);
  const [i, d] = String(Math.round(n * 100) / 100).split('.');
  const last3 = i.slice(-3), rest = i.slice(0, -3);
  return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3 + (d ? '.' + d : '');
}
/** "1299" -> "₹1,299" ; "On request" stays as typed */
function fmtMoney(v, symbol = '₹') {
  const n = parseMoney(v);
  if (n === null) return String(v || '').trim();
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  let s = groupIN(n);
  if (hasPaise && !/\.\d\d$/.test(s)) s = s.replace(/\.(\d)$/, '.$10');
  return symbol + s;
}
function bytesFmt(n) {
  if (!isFinite(n) || n <= 0) return '0 KB';
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}
const pad2 = n => String(n).padStart(2, '0');
function fileStamp(d = new Date()) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function niceDate(d = new Date()) {
  try { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return fileStamp(d); }
}
function monthYear(d = new Date()) {
  try { return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); } catch (e) { return fileStamp(d); }
}
function safeFileName(s, max = 90) {
  let out = String(s || 'catalogue').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  if (out.length > max) { out = out.slice(0, max); const cut = out.lastIndexOf('-'); if (cut > max * 0.6) out = out.slice(0, cut); } // end on a whole word
  return out || 'catalogue';
}
function normKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

/* ---- environment ---- */
const ENV = (() => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|; wv\)|GSA\//i.test(ua);
  const isFile = location.protocol === 'file:';
  const contentUri = location.protocol === 'content:';
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  return { ua, isIOS, isAndroid, inApp, isFile, contentUri, touch, standalone,
    canShareFiles: !!(navigator.canShare && window.File),
    compression: typeof CompressionStream !== 'undefined',
    decompression: typeof DecompressionStream !== 'undefined' };
})();

/* ---- small LRU for decoded images / object URLs ---- */
class LRU {
  constructor(max, onEvict) { this.max = max; this.map = new Map(); this.onEvict = onEvict; }
  get(k) { if (!this.map.has(k)) return undefined; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v; }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) { const [ok, ov] = this.map.entries().next().value; this.map.delete(ok); this.onEvict && this.onEvict(ov, ok); }
  }
  delete(k) { if (this.map.has(k)) { const v = this.map.get(k); this.map.delete(k); this.onEvict && this.onEvict(v, k); } }
  clear() { for (const [k, v] of this.map) this.onEvict && this.onEvict(v, k); this.map.clear(); }
}

/* ---- error log (shown in Settings → Diagnostics) ---- */
const LOG = {
  items: [],
  add(level, msg, extra) {
    const item = { t: new Date().toISOString(), level, msg: String(msg && msg.message || msg), extra: extra ? String(extra).slice(0, 400) : '' };
    this.items.push(item); if (this.items.length > 80) this.items.shift();
    if (level === 'error') console.error('[CM]', msg, extra || ''); else console.log('[CM]', msg, extra || '');
  },
  text() { return this.items.map(i => `${i.t} ${i.level.toUpperCase()} ${i.msg} ${i.extra}`).join('\n'); }
};
window.addEventListener('error', e => LOG.add('error', e.message, (e.filename || '') + ':' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => LOG.add('error', e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack));

/* ---- text helpers ---- */
function b64ToBytes(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

/* Screen wake lock while long jobs run (prevents phone sleeping mid-export) */
const Wake = {
  lock: null, count: 0,
  async on() { this.count++; try { if (!this.lock && navigator.wakeLock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch (e) { /* not allowed: fine */ } },
  async off() { this.count = Math.max(0, this.count - 1); if (this.count === 0 && this.lock) { try { await this.lock.release(); } catch (e) { } this.lock = null; } }
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Wake.count > 0 && !Wake.lock) { Wake.count--; Wake.on(); } });

/* ---- matching keys (Unicode-safe: Hindi and other scripts stay distinct) ---- */
function matchKey(s) { return String(s === undefined || s === null ? '' : s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }
function codeKey(s) { return String(s === undefined || s === null ? '' : s).normalize('NFKC').toLowerCase().replace(/[\s\-_.\/]+/g, ''); }

/* ---- DEFLATE fallback (zlib format) for browsers without CompressionStream (iOS < 16.4) ----
 * LZ77 with hash chains + fixed Huffman codes. Smaller than real zlib output, but far better than nothing. */
const Deflate = (() => {
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const rev = (c, n) => { let r = 0; for (let i = 0; i < n; i++) { r = (r << 1) | (c & 1); c >>= 1; } return r; };
  const LITC = new Uint16Array(288), LITL = new Uint8Array(288);
  for (let s = 0; s < 288; s++) {
    let c, n;
    if (s < 144) { c = 0x30 + s; n = 8; } else if (s < 256) { c = 0x190 + s - 144; n = 9; } else if (s < 280) { c = s - 256; n = 7; } else { c = 0xC0 + s - 280; n = 8; }
    LITC[s] = rev(c, n); LITL[s] = n;
  }
  const DISTC = new Uint8Array(30); for (let d = 0; d < 30; d++) DISTC[d] = rev(d, 5);
  const LCODE = new Uint8Array(259); for (let c = 0; c < 29; c++) { const end = c < 28 ? LBASE[c + 1] : 259; for (let l = LBASE[c]; l < end; l++) LCODE[l] = c; }
  const DCODE = new Uint8Array(32769); for (let c = 0; c < 30; c++) { const end = c < 29 ? DBASE[c + 1] : 32769; for (let d = DBASE[c]; d < end; d++) DCODE[d] = c; }
  function raw(data) {
    const n = data.length;
    let out = new Uint8Array(n + (n >> 3) + 1024), pos = 0, buf = 0, cnt = 0;
    const put = (bits, len) => {
      buf |= bits << cnt; cnt += len;
      while (cnt >= 8) { if (pos >= out.length) { const o = new Uint8Array(out.length * 2); o.set(out); out = o; } out[pos++] = buf & 255; buf >>>= 8; cnt -= 8; }
    };
    put(1, 1); put(1, 2); // final block, fixed Huffman
    const WS = 32768, WM = WS - 1, HS = 1 << 15, HM = HS - 1;
    const head = new Int32Array(HS).fill(-1), prev = new Int32Array(WS).fill(-1);
    const hash = (i) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & HM;
    let i = 0;
    while (i < n) {
      let best = 0, dist = 0;
      if (i + 2 < n) {
        const h = hash(i), maxLen = Math.min(258, n - i);
        let j = head[h], chain = 48;
        while (j >= 0 && i - j <= WS && chain-- > 0) {
          if (data[j + best] === data[i + best] && data[j] === data[i]) {
            let l = 0; while (l < maxLen && data[j + l] === data[i + l]) l++;
            if (l > best) { best = l; dist = i - j; if (l === maxLen) break; }
          }
          const nj = prev[j & WM]; if (nj >= j) break; j = nj;
        }
        prev[i & WM] = head[h]; head[h] = i;
      }
      if (best >= 3) {
        const c = LCODE[best]; put(LITC[257 + c], LITL[257 + c]); if (LEXT[c]) put(best - LBASE[c], LEXT[c]);
        const dc = DCODE[dist]; put(DISTC[dc], 5); if (DEXT[dc]) put(dist - DBASE[dc], DEXT[dc]);
        for (let k = 1; k < best; k++) { const p = i + k; if (p + 2 < n) { const hh = hash(p); prev[p & WM] = head[hh]; head[hh] = p; } }
        i += best;
      } else { put(LITC[data[i]], LITL[data[i]]); i++; }
    }
    put(LITC[256], LITL[256]);
    if (cnt > 0) { if (pos >= out.length) { const o = new Uint8Array(out.length + 16); o.set(out); out = o; } out[pos++] = buf & 255; }
    return out.subarray(0, pos);
  }
  function adler32(d) { let a = 1, b = 0; for (let i = 0; i < d.length;) { const end = Math.min(d.length, i + 5552); for (; i < end; i++) { a += d[i]; b += a; } a %= 65521; b %= 65521; } return ((b << 16) | a) >>> 0; }
  function zlib(data) {
    const r = raw(data), out = new Uint8Array(r.length + 6);
    out[0] = 0x78; out[1] = 0x01; out.set(r, 2);
    const ad = adler32(data); out[r.length + 2] = ad >>> 24; out[r.length + 3] = (ad >>> 16) & 255; out[r.length + 4] = (ad >>> 8) & 255; out[r.length + 5] = ad & 255;
    return out;
  }
  return { zlib, raw };
})();

/* ---- 01-db.js ---- */
/* ===================== 01 · Storage (IndexedDB, autosave) ===================== */
const DB = (() => {
  const NAME = 'catalogue-maker', VER = 1;
  let db = null;
  let memory = null; // fallback when IndexedDB is unavailable (some private modes / file:// viewers)
  const STORES = ['products', 'blobs', 'kv'];
  const KEYS = { products: 'id', blobs: 'id', kv: 'k' };

  function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

  async function open() {
    if (db || memory) return true;
    try {
      if (!window.indexedDB) throw new Error('IndexedDB missing');
      db = await new Promise((resolve, reject) => {
        const r = indexedDB.open(NAME, VER);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: KEYS[s] });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.onblocked = () => reject(new Error('Database blocked by another tab'));
        setTimeout(() => reject(new Error('Database open timed out')), 8000);
      });
      db.onversionchange = () => { db.close(); db = null; };
      // probe write: some embedded viewers expose IDB but throw on write
      await put('kv', { k: '__probe', v: Date.now() });
      return true;
    } catch (e) {
      LOG.add('error', 'Storage unavailable, using temporary memory', e && e.message);
      db = null;
      memory = { products: new Map(), blobs: new Map(), kv: new Map() };
      return false;
    }
  }
  const persistent = () => !!db;

  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  /** Run writes in one transaction; resolve only when the transaction has COMMITTED (storage-full errors surface here). */
  function write(store, fn) {
    return new Promise((res, rej) => {
      let t;
      try { t = db.transaction(store, 'readwrite'); fn(t.objectStore(store)); }
      catch (e) { rej(e); return; }
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error || new Error('Write failed'));
      t.onabort = () => rej(t.error || new Error('Write aborted (phone storage may be full)'));
    });
  }

  async function get(store, key) {
    if (memory) return memory[store].get(key);
    return req(tx(store, 'readonly').get(key));
  }
  async function put(store, value) {
    if (memory) { memory[store].set(value[KEYS[store]], value); return; }
    return write(store, os => os.put(value));
  }
  async function del(store, key) {
    if (memory) { memory[store].delete(key); return; }
    return write(store, os => os.delete(key));
  }
  async function all(store) {
    if (memory) return Array.from(memory[store].values());
    return req(tx(store, 'readonly').getAll());
  }
  async function allKeys(store) {
    if (memory) return Array.from(memory[store].keys());
    return req(tx(store, 'readonly').getAllKeys());
  }
  async function clearStore(store) {
    if (memory) { memory[store].clear(); return; }
    return write(store, os => os.clear());
  }
  async function putMany(store, values) {
    if (memory) { for (const v of values) memory[store].set(v[KEYS[store]], v); return; }
    if (!values.length) return;
    return write(store, os => { for (const v of values) os.put(v); });
  }
  async function delMany(store, keys) {
    if (memory) { for (const k of keys) memory[store].delete(k); return; }
    keys = keys.filter(Boolean); if (!keys.length) return;
    return write(store, os => { for (const k of keys) os.delete(k); });
  }
  /* blobs */
  async function putBlob(blob, id) {
    id = id || 'b' + uid();
    await put('blobs', { id, blob, type: blob.type, size: blob.size });
    return id;
  }
  async function getBlob(id) { if (!id) return null; const r = await get('blobs', id); return r ? r.blob : null; }
  async function delBlob(id) { if (id) await del('blobs', id); }
  /* key-value */
  async function getKV(k, def) { const r = await get('kv', k); return r ? r.v : def; }
  async function setKV(k, v) { return put('kv', { k, v }); }

  async function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { }
    return null;
  }
  async function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) { if (await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } } catch (e) { }
    return false;
  }
  async function isPersisted() { try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { return false; } }

  return { open, persistent, get, put, del, all, allKeys, clear: clearStore, putMany, delMany, putBlob, getBlob, delBlob, getKV, setKV, estimate, askPersist, isPersisted };
})();

/* ---- 02-font.js ---- */
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

/* ---- 03-pdf.js ---- */
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

/* ---- 04-image.js ---- */
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

/* ---- 05-geom.js ---- */
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

/* ---- 06-segment.js ---- */
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

/* ---- 07-pipeline.js ---- */
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

/* ---- 08-layout.js ---- */
/* ===================== 08 · Catalogue layout engine (one page model → preview & PDF) ===================== */
const THEMES = {
  classic:  { name: 'Classic',  page: '#FFFFFF', card: '#F6F5F1', ink: '#17171C', muted: '#6A6A73', accent: '#C2410C', rule: '#E6E3DC', line: '#E9E6DF', dark: false },
  ivory:    { name: 'Ivory & Gold', page: '#FBF7EE', card: '#FFFFFF', ink: '#2A2418', muted: '#7C705B', accent: '#9E7417', rule: '#E8DCC2', line: '#EADFC8', dark: false },
  midnight: { name: 'Midnight', page: '#111218', card: '#1B1D26', ink: '#F4F2EC', muted: '#A3A6B4', accent: '#F2B53D', rule: '#2A2D3A', line: '#2C2F3C', dark: true },
  emerald:  { name: 'Emerald',  page: '#FFFFFF', card: '#EEF5F0', ink: '#0E2A1F', muted: '#56725F', accent: '#0F7B53', rule: '#D7E6DD', line: '#D7E6DD', dark: false },
  royal:    { name: 'Royal',    page: '#FFFFFF', card: '#F0F3FB', ink: '#0D1A3A', muted: '#5A6688', accent: '#1F4FD8', rule: '#DCE3F3', line: '#DCE3F3', dark: false },
  festive:  { name: 'Festive',  page: '#FFF8F2', card: '#FFFFFF', ink: '#3A0C12', muted: '#875A5F', accent: '#B0123A', rule: '#F1DCD3', line: '#F1DCD3', dark: false },
  mono:     { name: 'Mono',     page: '#FFFFFF', card: '#FFFFFF', ink: '#111111', muted: '#6B6B6B', accent: '#111111', rule: '#DDDDDD', line: '#E2E2E2', dark: false }
};
const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28] };

const LAYOUT = (() => {
  const lum = hex => { const m = /^#?(..)(..)(..)$/.exec(hex) || [0, 'ff', 'ff', 'ff']; const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onColor = hex => lum(hex) > 0.42 ? '#111111' : '#FFFFFF';
  let _rc = null;
  const rasterMeasure = (str, size, wt) => {
    if (!_rc) _rc = document.createElement('canvas').getContext('2d');
    _rc.font = `${wt === 'bold' ? 700 : wt === 'medium' ? 500 : 400} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif`;
    return _rc.measureText(str).width;
  };
  function theme(cat) {
    const t = Object.assign({}, THEMES[cat.theme] || THEMES.classic);
    if (cat.accent && /^#[0-9a-f]{6}$/i.test(cat.accent)) t.accent = cat.accent;
    t.onAccent = onColor(t.accent);
    return t;
  }
  /** Measure + build a single text op. */
  function line(str, fam, wt, s, color, tracking = 0) {
    const face = Fonts.face(fam, wt);
    let raster = !face.covers(str);
    if (raster && fam !== 'sans' && Fonts.face('sans', wt).covers(str)) { fam = 'sans'; raster = false; }
    const w = raster ? rasterMeasure(str, s, wt) : Fonts.face(fam, wt).width(str, s, tracking);
    return { str, fam, wt, s, color, tracking, w, raster };
  }
  function measurer(fam, wt, s, tracking) {
    return (t) => { const f = Fonts.face(fam, wt); return f.covers(t) ? f.width(t, s, tracking) : rasterMeasure(t, s, wt); };
  }
  function wrapped(str, fam, wt, s, color, maxW, maxLines, tracking = 0) {
    return wrapLines(measurer(fam, wt, s, tracking), str, maxW, maxLines).map(l => line(l, fam, wt, s, color, tracking));
  }
  function textOp(l, x, baseline, align) {
    const left = align === 'center' ? x - l.w / 2 : align === 'right' ? x - l.w : x;
    return { t: 'text', x: left, y: baseline, w: l.w, str: l.str, fam: l.fam, wt: l.wt, s: l.s, color: l.color, tracking: l.tracking, raster: l.raster };
  }
  function capH(fam, wt) { const f = Fonts.face(fam, wt); return (f.capHeight || f.ascender * 0.7) / f.upem; }
  function fit(w, h, bw, bh) { const s = Math.min(bw / w, bh / h); return { w: w * s, h: h * s }; }
  function waNumber(n) { let d = String(n || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1); return d; }
  function waLink(num, text) { const n = waNumber(num); if (!n) return null; return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function fieldValue(p, key) { const v = p.f && p.f[key]; return v === undefined || v === null ? '' : String(v).trim(); }
  function enquiryText(p, S) {
    const name = fieldValue(p, 'name') || fieldValue(p, 'product') || 'this product';
    const bits = [];
    const brand = fieldValue(p, 'brand'); if (brand && name.toLowerCase().indexOf(brand.toLowerCase()) < 0) bits.push(brand);
    bits.push(name);
    const size = fieldValue(p, 'size'); if (size) bits.push('(' + size + ')');
    const mrp = fieldValue(p, 'mrp'); const price = mrp ? ' – MRP ' + fmtMoney(mrp) : '';
    const tpl = (S.cat.waMsg || 'Hi{biz}! I am interested in {item}. Please share details.');
    return tpl.replace('{biz}', S.biz.name ? ' ' + S.biz.name : '').replace('{item}', bits.join(' ') + price);
  }

  /* ---------- the text block under each product ---------- */
  function productLines(p, S, s, maxW, T, dense) {
    const out = [];
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    let metaBuf = [];
    const flushMeta = () => {
      if (!metaBuf.length) return;
      const str = metaBuf.join('  ·  ');
      wrapped(str, 'sans', 'regular', s * 0.8, T.muted, maxW, dense ? 1 : 2).forEach(l => out.push(Object.assign(l, { lh: s * 0.8 * 1.42, kind: 'meta' })));
      metaBuf = [];
    };
    for (const f of S.fields) {
      if (!f.on) continue;
      const v = fieldValue(p, f.key);
      if (!v) continue;                                   // empty fields are left out
      const label = f.showLabel && f.label ? f.label : '';
      if (f.style === 'meta' || f.style === 'custom') {
        const txt = label ? label + ': ' + v : v;
        if (dense) { metaBuf.push(txt); continue; }
        flushMeta();
        wrapped(txt, 'sans', 'regular', s * 0.8, T.muted, maxW, 2).forEach(l => out.push(Object.assign(l, { lh: s * 0.8 * 1.42, kind: 'meta' })));
        continue;
      }
      flushMeta();
      if (f.style === 'brand') {
        const txt = (label ? label + ': ' : '') + v.toUpperCase();
        // tracking kept under ~0.1em so PDF readers still find the brand name when searching
        wrapped(txt, 'sans', 'medium', s * 0.7, T.accent, maxW, 1, 0.09).forEach(l => out.push(Object.assign(l, { lh: s * 0.7 * 1.6, kind: 'brand' })));
      } else if (f.style === 'title') {
        const txt = label ? label + ': ' + v : v;
        wrapped(txt, fam, 'bold', s * (fam === 'serif' ? 1.08 : 1.0), T.ink, maxW, 2).forEach(l => out.push(Object.assign(l, { lh: s * 1.24, kind: 'title' })));
      } else if (f.style === 'price') {
        const money = fmtMoney(v);
        const txt = (label ? label + ' ' : '') + money;
        out.push(Object.assign(line(txt, 'sans', 'bold', s * 1.04, T.accent), { lh: s * 1.04 * 1.42, kind: 'price', gapBefore: s * 0.18 }));
      }
    }
    flushMeta();
    let h = 0; for (const l of out) h += l.lh + (l.gapBefore || 0);
    return { lines: out, h };
  }

  /* ---------- grid: balanced rows for 1–10 per page ---------- */
  function grid(n, W, H, gap, textEst) {
    let best = null;
    for (let rows = 1; rows <= n; rows++) {
      const cols = Math.ceil(n / rows);
      if (cols * (rows - 1) >= n && rows > 1) continue;
      const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
      const s = clamp(Math.sqrt(cw * ch) / 22, 7, 20);
      const pad = clamp(cw * 0.055, 6, 18);
      const side = Math.min(cw - pad * 2, ch - pad * 2 - textEst(s) - s * 0.4);
      const score = side - (rows * cols - n) * 0.5;
      if (!best || score > best.score + 0.5) best = { rows, cols, cw, ch, s, pad, score };
    }
    const base = Math.floor(n / best.rows), extra = n % best.rows;
    best.rowCounts = Array.from({ length: best.rows }, (_, i) => base + (i < extra ? 1 : 0));
    return best;
  }

  function header(ops, P, S, T, title, sub, hasLogo, logo) {
    const M = P.m, top = M * 0.62, HH = P.hh;
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    // logo top-right, full logo (contain), on a light plate for dark themes
    let logoW = 0;
    if (hasLogo && logo && logo.w) {
      const box = { w: Math.min(170, P.w * 0.32), h: HH - 12 };
      const f = fit(logo.w, logo.h, box.w, box.h);
      const x = P.w - M - f.w, y = top + (HH - f.h) / 2 - 2;
      if (T.dark) ops.push({ t: 'rect', x: x - 8, y: y - 6, w: f.w + 16, h: f.h + 12, r: 8, fill: '#FFFFFF' });
      ops.push({ t: 'img', src: 'logo', x, y, w: f.w, h: f.h });
      logoW = f.w + (T.dark ? 16 : 0);
    } else if (S.biz.name) {
      const l = line(S.biz.name, fam, 'bold', 13, T.ink);
      ops.push(textOp(l, P.w - M, top + HH / 2 + 4.5, 'right')); logoW = l.w;
    }
    const maxW = P.w - M * 2 - logoW - 24;
    const tl = wrapped(title || '', fam, 'bold', 15, T.ink, maxW, 1)[0];
    if (tl) ops.push(textOp(tl, M, top + HH / 2 + (sub ? 0 : 5), 'left'));
    if (sub) { const sl = wrapped(sub, 'sans', 'regular', 8.5, T.muted, maxW, 1)[0]; if (sl) ops.push(textOp(sl, M, top + HH / 2 + 13, 'left')); }
    ops.push({ t: 'rect', x: M, y: top + HH + 2, w: 34, h: 2.2, r: 1.1, fill: T.accent });
    ops.push({ t: 'line', x1: M + 40, y1: top + HH + 3.1, x2: P.w - M, y2: top + HH + 3.1, color: T.rule, lw: 0.6 });
  }
  /** "Prices valid until 30 Nov 2026" when a date is set */
  function validText(S) {
    const v = S.cat.validTill;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const d = new Date(v + 'T12:00:00');
    return isNaN(d) ? '' : 'Prices valid until ' + niceDate(d) + '.';
  }

  function footer(ops, P, S, T, pageNo, total) {
    const M = P.m, y = P.h - M * 0.55;
    const contact = [S.biz.name, S.biz.phone, S.biz.website || S.biz.email].filter(Boolean).join('   ·   ');
    ops.push({ t: 'line', x1: M, y1: y - 15, x2: P.w - M, y2: y - 15, color: T.rule, lw: 0.5 });
    if (S.cat.footContact !== false && contact) { const l = wrapped(contact, 'sans', 'regular', 7.5, T.muted, P.w * 0.62, 1)[0]; if (l) ops.push(textOp(l, M, y - 3, 'left')); }
    if (S.cat.pageNo !== false) ops.push(textOp(line(pageNo + ' / ' + total, 'sans', 'medium', 7.5, T.muted), P.w - M, y - 3, 'right'));
    const note = [S.cat.note, validText(S), S.cat.waLinks && S.biz.whatsapp ? 'Tap any product to enquire on WhatsApp.' : ''].filter(Boolean).join('  ');
    if (note) { const l = wrapped(note, 'sans', 'regular', 6.5, T.muted, P.w - M * 2, 1)[0]; if (l) ops.push(textOp(l, M, y + 7, 'left')); }
  }

  function productCard(ops, p, x, y, cw, ch, s, pad, textH, S, T, dense) {
    const style = S.cat.card || 'soft';
    const r = Math.min(14, cw * 0.05);
    if (style === 'soft') ops.push({ t: 'rect', x, y, w: cw, h: ch, r, fill: T.card });
    else if (style === 'outline') ops.push({ t: 'rect', x, y, w: cw, h: ch, r, stroke: T.line, lw: 0.8 });
    const innerW = cw - pad * 2;
    const imgBox = { x: x + pad, y: y + pad, w: innerW, h: ch - pad * 2 - textH - s * 0.45 };
    const ow = (p.img && p.img.ow) || 1, oh = (p.img && p.img.oh) || 1;
    if (p.img && p.img.out && imgBox.h > 4) {
      const f = fit(ow, oh, imgBox.w * 0.96, imgBox.h * 0.97);
      const ix = imgBox.x + (imgBox.w - f.w) / 2, iy = imgBox.y + imgBox.h - f.h;      // bottom-anchored: no gap above the text
      if (S.cat.shadow !== false) {
        const sw = f.w * 0.86, sh = Math.max(3, Math.min(f.h * 0.07, s * 1.1));
        ops.push({ t: 'shadow', x: ix + (f.w - sw) / 2, y: iy + f.h - sh * 0.55, w: sw, h: sh, alpha: T.dark ? 0.9 : 0.75 });
      }
      ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
    } else if (imgBox.h > 4) {
      ops.push({ t: 'rect', x: imgBox.x + imgBox.w * 0.2, y: imgBox.y + imgBox.h * 0.2, w: imgBox.w * 0.6, h: imgBox.h * 0.6, r: 8, stroke: T.line, lw: 0.8 });
      ops.push(textOp(line('No photo', 'sans', 'regular', s * 0.7, T.muted), x + cw / 2, imgBox.y + imgBox.h / 2 + s * 0.25, 'center'));
    }
    // badge (e.g. NEW, 20% OFF)
    const badge = fieldValue(p, 'badge');
    if (badge && S.cat.badges !== false) {
      const bl = line(badge.toUpperCase(), 'sans', 'bold', Math.max(5.5, s * 0.58), T.onAccent, 0.08);
      const bh = bl.s * 1.9, bw = bl.w + bl.s * 1.6;
      ops.push({ t: 'rect', x: x + pad * 0.7, y: y + pad * 0.7, w: bw, h: bh, r: bh / 2, fill: T.accent });
      ops.push(textOp(bl, x + pad * 0.7 + bw / 2, y + pad * 0.7 + bh / 2 + bl.s * 0.36, 'center'));
    }
    // details: centred, immediately below the image
    const block = productLines(p, S, s, innerW, T, dense);
    let ty = imgBox.y + imgBox.h + s * 0.45;
    for (const l of block.lines) {
      ty += (l.gapBefore || 0);
      const base = ty + l.lh / 2 + capH(l.fam, l.wt) * l.s / 2;
      ops.push(textOp(l, x + cw / 2, base, 'center'));
      ty += l.lh;
    }
    if (S.cat.waLinks && S.biz.whatsapp) {
      const url = waLink(S.biz.whatsapp, enquiryText(p, S));
      if (url) ops.push({ t: 'link', x, y, w: cw, h: ch, url });
    }
  }

  function coverPage(P, S, T, products, total, hasLogo, logo, sectionsCount) {
    const ops = [], M = P.m, W = P.w, H = P.h, land = W > H;
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    const sc = Math.min(1, (land ? H : W) / 595);       // A5 and small pages scale everything down
    const b = S.biz;
    const site = b.website ? (/^https?:/i.test(b.website) ? b.website : 'https://' + b.website) : '';
    const qrData = S.cat.qr !== false ? (waLink(b.whatsapp, '') || site) : '';
    const rows = [['Phone', b.phone], ['WhatsApp', b.whatsapp], ['Email', b.email], ['Website', b.website], ['Address', b.address], ['GSTIN', b.gstin]].filter(r => r[1]);
    /** contact block; returns its height. dry = measure only */
    const contact = (x, y0, maxW, k, dry) => {
      let y = y0;
      const out = (op) => { if (!dry) ops.push(op); };
      if (b.name) { const l = wrapped(b.name, fam, 'bold', 18 * k, T.ink, maxW, 1)[0]; out(textOp(l, x, y, 'left')); y += 20 * k; }
      if (b.tagline) { wrapped(b.tagline, 'sans', 'regular', 10 * k, T.muted, maxW, 2).forEach(l => { out(textOp(l, x, y, 'left')); y += 14 * k; }); }
      y += 10 * k;
      const lab = 64 * k;
      for (const [key, v] of rows) {
        out(textOp(line(key.toUpperCase(), 'sans', 'medium', 6.8 * k, T.accent, 0.12), x, y, 'left'));
        const vl = wrapped(v, 'sans', 'regular', 9.5 * k, T.ink, maxW - lab, 2);
        vl.forEach((l, i) => out(textOp(l, x + lab, y + i * 12.5 * k, 'left')));
        y += Math.max(1, vl.length) * 12.5 * k + 6 * k;
      }
      if (!dry && site) ops.push({ t: 'link', x, y: y0 - 16 * k, w: maxW, h: y - y0 + 16 * k, url: site });
      return y - y0;
    };
    const logoPlate = (x, y, maxW, maxH) => {
      if (hasLogo && logo && logo.w) {
        const f = fit(logo.w, logo.h, maxW, maxH);
        ops.push({ t: 'rect', x, y, w: f.w + 28 * sc, h: f.h + 22 * sc, r: 12 * sc, fill: '#FFFFFF' });
        ops.push({ t: 'img', src: 'logo', x: x + 14 * sc, y: y + 11 * sc, w: f.w, h: f.h });
        return f.h + 22 * sc;
      }
      if (b.name) { ops.push(textOp(wrapped(b.name.toUpperCase(), 'sans', 'bold', 12 * sc, T.onAccent, maxW, 1, 0.12)[0], x, y + 20 * sc, 'left')); return 28 * sc; }
      return 0;
    };
    const titleBlock = (x, y, maxW) => {
      const tSize = (fam === 'serif' ? 44 : 40) * sc * (land ? 0.9 : 1);
      const kicker = line((S.cat.edition || monthYear()).toUpperCase(), 'sans', 'medium', 9 * sc, T.onAccent, 0.2);
      ops.push(Object.assign(textOp(kicker, x, y, 'left'), { alpha: 0.85 }));
      y += 16 * sc;
      for (const l of wrapped(S.cat.title || 'Product Catalogue', fam, 'bold', tSize, T.onAccent, maxW, 3)) { ops.push(textOp(l, x, y + l.s * 0.82, 'left')); y += l.s * 1.1; }
      y += 8 * sc;
      if (S.cat.subtitle) for (const l of wrapped(S.cat.subtitle, 'sans', 'regular', 14 * sc, T.onAccent, maxW, 2)) { ops.push(Object.assign(textOp(l, x, y + 12 * sc, 'left'), { alpha: 0.9 })); y += 20 * sc; }
      if (S.cat.forWho && S.cat.forWho.trim()) {
        // a catalogue made for one customer
        y += 10 * sc;
        ops.push(Object.assign(textOp(line('PREPARED FOR', 'sans', 'medium', 7.5 * sc, T.onAccent, 0.16), x, y + 8 * sc, 'left'), { alpha: 0.75 }));
        y += 14 * sc;
        for (const l of wrapped(S.cat.forWho.trim(), fam, 'bold', 16 * sc, T.onAccent, maxW, 2)) { ops.push(textOp(l, x, y + 12 * sc, 'left')); y += 20 * sc; }
      }
      ops.push({ t: 'rect', x, y: y + 18 * sc, w: 46 * sc, h: 3 * sc, r: 1.5, fill: T.onAccent, alpha: 0.85 });
      return y + 24 * sc;
    };
    const card = (p, x, y, cw, ch) => {
      ops.push({ t: 'rect', x, y, w: cw, h: ch, r: 14 * sc, fill: T.dark ? T.card : '#FFFFFF' });
      const f = fit(p.img.ow, p.img.oh, cw - 24 * sc, ch - 30 * sc);
      const ix = x + (cw - f.w) / 2, iy = y + ch - 14 * sc - f.h;
      ops.push({ t: 'shadow', x: ix + f.w * 0.07, y: iy + f.h - 4, w: f.w * 0.86, h: 7 * sc, alpha: 0.7 });
      ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
    };
    const qrPlate = (qx, qy, qs, onBand) => {
      ops.push({ t: 'rect', x: qx - 10 * sc, y: qy - 10 * sc, w: qs + 20 * sc, h: qs + 20 * sc, r: 10 * sc, fill: '#FFFFFF', stroke: T.dark || onBand ? null : T.rule, lw: 0.6 });
      ops.push({ t: 'qr', x: qx, y: qy, size: qs, data: qrData, color: '#111111' });
      const cap = line(waLink(b.whatsapp, '') ? 'Scan to chat on WhatsApp' : 'Scan to visit our website', 'sans', 'medium', 7.5 * sc, onBand ? T.onAccent : T.muted);
      ops.push(textOp(cap, qx + qs / 2, qy + qs + 24 * sc, 'center'));
      ops.push({ t: 'link', x: qx - 10 * sc, y: qy - 10 * sc, w: qs + 20 * sc, h: qs + 20 * sc, url: qrData });
    };
    const feat = products.filter(p => p.img && p.img.out).slice(0, 3);
    const meta = [total + (total === 1 ? ' product' : ' products'), sectionsCount > 1 ? sectionsCount + ' sections' : '', niceDate(), validText(S).replace(/\.$/, '')].filter(Boolean).join('   ·   ');
    ops.push({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: T.page });

    if (land) {
      /* landscape: accent band on the left (logo, title, QR); products and contact details on the right */
      const bw = W * 0.46;
      ops.push({ t: 'rect', x: 0, y: 0, w: bw, h: H, fill: T.accent });
      ops.push({ t: 'circle', cx: bw * 0.72, cy: H * 0.2, r: bw * 0.26, fill: T.onAccent, alpha: 0.07 });
      ops.push({ t: 'circle', cx: bw * 0.18, cy: H * 0.98, r: bw * 0.2, fill: T.onAccent, alpha: 0.05 });
      const lh = logoPlate(M, M, bw * 0.6, 54 * sc);
      titleBlock(M, M + lh + 34 * sc, bw - M * 2);
      if (qrData) { const qs = Math.min(80 * sc, H * 0.2); qrPlate(M + 10 * sc, H - M - qs - 30 * sc, qs, true); }
      const x0 = bw + M, rw = W - x0 - M;
      let y = M;
      const cH = contact(x0, 0, rw, sc, true);
      if (feat.length) {
        const gap = 10 * sc, cw = Math.min((rw - gap * 2) / 3, (H - M * 2 - cH - 60 * sc) / 1.16), ch = cw * 1.16;
        if (cw > 50) { feat.forEach((p, i) => card(p, x0 + i * (cw + gap), y, cw, ch)); y += ch + 34 * sc; }
      }
      contact(x0, y + 12 * sc, rw, sc, false);
      ops.push(textOp(line(meta, 'sans', 'regular', 7.5 * sc, T.muted), x0, H - M + 2, 'left'));
      return { w: W, h: H, bg: T.page, ops, kind: 'cover' };
    }

    /* portrait: accent band on top, product strip on its edge, contact details and QR below */
    const qs = qrData ? 92 * sc : 0;
    let k = sc, cH = contact(M, 0, W - M * 2 - (qs ? qs + 34 * sc : 0), k, true);
    let bandH = Math.min(H * 0.6, H - M - 26 * sc - cH - 70 * sc);
    if (bandH < H * 0.44) { k = sc * 0.85; cH = contact(M, 0, W - M * 2 - (qs ? qs + 34 * sc : 0), k, true); bandH = Math.max(H * 0.42, Math.min(H * 0.6, H - M - 26 * sc - cH - 60 * sc)); }
    ops.push({ t: 'rect', x: 0, y: 0, w: W, h: bandH, fill: T.accent });
    ops.push({ t: 'circle', cx: W * 0.92, cy: bandH * 0.18, r: W * 0.36, fill: T.onAccent, alpha: 0.07 });
    ops.push({ t: 'circle', cx: W * 0.78, cy: bandH * 0.62, r: W * 0.2, fill: T.onAccent, alpha: 0.06 });
    ops.push({ t: 'circle', cx: W * 0.06, cy: bandH * 0.98, r: W * 0.13, fill: T.onAccent, alpha: 0.05 });
    const lh = logoPlate(M, M, W * 0.36, 62 * sc);
    const ty = titleBlock(M, M + lh + 30 * sc + Math.max(0, (bandH - 470 * sc) * 0.35), W - M * 2 - 20);
    let overhang = 0;
    if (feat.length) {
      const gap = 12 * sc, cw = Math.min(W * 0.2, (W - M * 2 - gap * (feat.length - 1)) / feat.length), ch = cw * 1.16;
      const startX = W - M - (cw * feat.length + gap * (feat.length - 1));
      const cy = Math.max(ty + 10 * sc, bandH - ch * 0.6);
      feat.forEach((p, i) => card(p, startX + i * (cw + gap), cy, cw, ch));
      overhang = Math.max(0, cy + ch - bandH);
    }
    const cTop = bandH + Math.max(70 * sc, overhang + 30 * sc);
    contact(M, cTop, W - M * 2 - (qs ? qs + 34 * sc : 0), k, false);
    if (qrData) {
      let q = qs, qy = H - M - q - 30 * sc;
      if (qy < bandH + overhang + 16 * sc) { q = Math.max(56 * sc, H - M - 30 * sc - bandH - overhang - 16 * sc); qy = H - M - q - 30 * sc; }
      qrPlate(W - M - q, qy, q, false);
    }
    ops.push(textOp(line(meta, 'sans', 'regular', 7.5 * sc, T.muted), M, H - M + 2, 'left'));
    return { w: W, h: H, bg: T.page, ops, kind: 'cover' };
  }

  function dividerPage(P, S, T, group, firstProducts, pageNo, total, hasLogo, logo) {
    const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
    const fam = S.cat.font === 'serif' ? 'serif' : 'sans';
    header(ops, P, S, T, S.cat.title, S.biz.name, hasLogo, logo);
    const M = P.m, cy = P.h * 0.36;
    ops.push({ t: 'circle', cx: P.w - M - 40, cy: cy - 40, r: 120, fill: T.accent, alpha: 0.07 });
    ops.push(textOp(line(((S.cat.groupBy === 'brand' ? 'Brand' : S.cat.groupBy === 'product' ? 'Range' : 'Section')).toUpperCase(), 'sans', 'medium', 9, T.accent, 0.22), M, cy - 52, 'left'));
    wrapped(group.name, fam, 'bold', 40, T.ink, P.w - M * 2, 2).forEach((l, i) => ops.push(textOp(l, M, cy + i * 46, 'left')));
    ops.push({ t: 'rect', x: M, y: cy + 22 + (group.name.length > 18 ? 46 : 0), w: 56, h: 3, r: 1.5, fill: T.accent });
    ops.push(textOp(line(group.items.length + (group.items.length === 1 ? ' product' : ' products'), 'sans', 'regular', 11, T.muted), M, cy + 50 + (group.name.length > 18 ? 46 : 0), 'left'));
    const feat = firstProducts.filter(p => p.img && p.img.out).slice(0, 4);
    if (feat.length) {
      const gap = 12, area = P.w - M * 2, cw = (area - gap * 3) / 4, ch = cw * 1.15, y0 = P.h * 0.58;
      feat.forEach((p, i) => {
        const x = M + i * (cw + gap);
        ops.push({ t: 'rect', x, y: y0, w: cw, h: ch, r: 12, fill: T.card });
        const f = fit(p.img.ow, p.img.oh, cw - 20, ch - 24);
        const ix = x + (cw - f.w) / 2, iy = y0 + ch - 12 - f.h;
        ops.push({ t: 'shadow', x: ix + f.w * 0.07, y: iy + f.h - 4, w: f.w * 0.86, h: 6, alpha: 0.7 });
        ops.push({ t: 'img', src: { id: p.id }, x: ix, y: iy, w: f.w, h: f.h, pid: p.id });
      });
    }
    footer(ops, P, S, T, pageNo, total);
    return { w: P.w, h: P.h, bg: T.page, ops, kind: 'divider', section: group.name };
  }

  /** How many list rows fit on one contents (cols 1) or index (cols 2) page. */
  function listCapacity(P, cols, roomy) {
    const top = P.m * 0.62 + P.hh + 30, rowH = cols === 1 ? (roomy ? 38 : 24) : 15.5;
    return Math.max(1, Math.floor((P.h - top - P.fh - P.m * 0.6) / rowH)) * cols;
  }
  function listPage(P, S, T, title, entries, pageNo, total, hasLogo, logo, cols, roomy) {
    // entries: [{label, sub, page}]
    const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
    header(ops, P, S, T, title, S.cat.title, hasLogo, logo);
    const M = P.m, top = P.m * 0.62 + P.hh + 30, colGap = 22;
    roomy = !!roomy && cols === 1;
    const colW = (P.w - M * 2 - colGap * (cols - 1)) / cols, rowH = cols === 1 ? (roomy ? 38 : 24) : 15.5;
    const perCol = Math.max(1, Math.floor((P.h - top - P.fh - M * 0.6) / rowH));
    entries.forEach((e, i) => {
      const c = Math.floor(i / perCol), r = i % perCol; if (c >= cols) return;
      const x = M + c * (colW + colGap), y = top + r * rowH;
      const sz = cols === 1 ? (roomy ? 14 : 11.5) : 8.2;
      const num = line(String(e.page), 'sans', cols === 1 ? 'bold' : 'medium', sz, cols === 1 ? T.accent : T.ink);
      const lab = wrapped(e.label, 'sans', cols === 1 ? 'medium' : 'regular', sz, T.ink, colW - num.w - 30, 1)[0];
      if (lab) ops.push(textOp(lab, x, y + sz, 'left'));
      ops.push(textOp(num, x + colW, y + sz, 'right'));
      const lx0 = x + (lab ? lab.w : 0) + 6, lx1 = x + colW - num.w - 6;
      if (lx1 > lx0) ops.push({ t: 'line', x1: lx0, y1: y + sz + 1, x2: lx1, y2: y + sz + 1, color: T.rule, lw: 0.6, dash: true });
      if (e.sub && cols === 1) { const sl = line(e.sub, 'sans', 'regular', roomy ? 9 : 8, T.muted); ops.push(textOp(sl, x, y + sz + (roomy ? 14 : 11), 'left')); }
      ops.push({ t: 'goto', x, y, w: colW, h: rowH, page: e.page - 1 });
    });
    footer(ops, P, S, T, pageNo, total);
    return { w: P.w, h: P.h, bg: T.page, ops, kind: 'list' };
  }

  /**
   * Build all pages. groups: [{name|null, items:[product]}]
   * logo: {w,h} or null.
   */
  function build(groups, S, logo) {
    const cat = S.cat, T = theme(cat);
    let [pw, ph] = PAGE_SIZES[cat.page] || PAGE_SIZES.A4;
    if (cat.orient === 'landscape') [pw, ph] = [ph, pw];
    const P = { w: pw, h: ph, m: Math.round(Math.min(pw, ph) * 0.05), hh: 40, fh: 30 };
    const hasLogo = !!logo;
    const n = clamp(parseInt(cat.perPage, 10) || 6, 1, 10);
    const all = groups.flatMap(g => g.items);
    const grouped = groups.length > 1 || (groups[0] && groups[0].name);
    const dense = n >= 7 || cat.compact === true;
    const contentTop = P.m * 0.62 + P.hh + 16, contentBottom = P.h - P.m * 0.55 - 22;
    const CW = P.w - P.m * 2, CH = contentBottom - contentTop;
    const gap = clamp(Math.min(CW, CH) * 0.022, 6, 14);
    // estimate text height (max over all products) for a given base size
    const textEst = (s) => {
      const cols = 1; const innerW = Math.max(60, CW / Math.ceil(Math.sqrt(n)) - s * 2);
      let mx = 0; const sample = all.length > 400 ? all.filter((_, i) => i % Math.ceil(all.length / 400) === 0) : all;
      for (const p of sample) mx = Math.max(mx, productLines(p, S, s, innerW, T, dense).h);
      return mx || s * 3.2;
    };
    const G = grid(n, CW, CH, gap, textEst);
    const innerW = G.cw - G.pad * 2;
    let textH = 0; for (const p of all) textH = Math.max(textH, productLines(p, S, G.s, innerW, T, dense).h);
    // pages
    const pages = [];
    const cover = cat.cover !== false;
    const useDividers = grouped && cat.dividers !== false;
    const useContents = grouped && cat.contents !== false && groups.length > 1;
    const roomyContents = groups.length <= listCapacity(P, 1, true);
    const perContents = listCapacity(P, 1, roomyContents);
    const contentsPages = useContents ? Math.ceil(groups.length / perContents) : 0;
    let pageNo = (cover ? 1 : 0) + contentsPages;
    const plan = []; // product page plan
    const bookmarks = [];
    for (const g of groups) {
      const startPage = pageNo + 1;
      if (useDividers && g.name) { plan.push({ kind: 'divider', group: g }); pageNo++; }
      for (let i = 0; i < g.items.length; i += n) { plan.push({ kind: 'products', group: g, items: g.items.slice(i, i + n), first: i === 0 }); pageNo++; }
      g.startPage = startPage;
      if (g.name) bookmarks.push({ title: g.name, page: startPage - 1 });
    }
    const indexEntries = cat.index ? all.map(p => ({ label: [fieldValue(p, 'name') || fieldValue(p, 'product') || 'Untitled', fieldValue(p, 'size')].filter(Boolean).join(' · '), page: 0, id: p.id })) : [];
    const perIndexPage = listCapacity(P, 2, false);
    const indexPages = cat.index && indexEntries.length ? Math.ceil(indexEntries.length / perIndexPage) : 0;
    const total = pageNo + indexPages;
    if (cover) pages.push(coverPage(P, S, T, all, all.length, hasLogo, logo, groups.filter(g => g.name).length));
    for (let c = 0; c < contentsPages; c++) {
      const ents = groups.slice(c * perContents, (c + 1) * perContents).map(g => ({ label: g.name || 'Products', sub: g.items.length + (g.items.length === 1 ? ' product' : ' products'), page: g.startPage }));
      pages.push(listPage(P, S, T, 'Contents', ents, pages.length + 1, total, hasLogo, logo, 1, roomyContents));
    }
    const productPage = new Map();
    for (const pl of plan) {
      const no = pages.length + 1;
      if (pl.kind === 'divider') { pages.push(dividerPage(P, S, T, pl.group, pl.group.items, no, total, hasLogo, logo)); continue; }
      const ops = [{ t: 'rect', x: 0, y: 0, w: P.w, h: P.h, fill: T.page }];
      const title = pl.group.name || cat.title || 'Catalogue';
      const sub = pl.group.name ? (cat.title || '') : (cat.subtitle || S.biz.name || '');
      header(ops, P, S, T, title, sub, hasLogo, logo);
      // cells
      let k = 0;
      const rowsUsed = G.rowCounts;
      for (let r = 0; r < G.rows && k < pl.items.length; r++) {
        const cap = rowsUsed[r], cnt = Math.min(cap, pl.items.length - k);
        const rowW = cnt * G.cw + (cnt - 1) * gap;
        const x0 = P.m + (CW - rowW) / 2, y = contentTop + r * (G.ch + gap);
        for (let c = 0; c < cnt; c++, k++) {
          const p = pl.items[k];
          productCard(ops, p, x0 + c * (G.cw + gap), y, G.cw, G.ch, G.s, G.pad, textH, S, T, dense);
          productPage.set(p.id, no);
        }
      }
      footer(ops, P, S, T, no, total);
      pages.push({ w: P.w, h: P.h, bg: T.page, ops, kind: 'products', section: pl.group.name, ids: pl.items.map(p => p.id) });
    }
    if (indexPages) {
      for (const e of indexEntries) e.page = productPage.get(e.id) || 1;
      indexEntries.sort((a, b) => a.label.localeCompare(b.label));
      for (let c = 0; c < indexPages; c++) pages.push(listPage(P, S, T, 'Index', indexEntries.slice(c * perIndexPage, (c + 1) * perIndexPage), pages.length + 1, total, hasLogo, logo, 2));
    }
    return { pages, theme: T, grid: G, total: pages.length, bookmarks, products: all.length };
  }
  /** A single product card, sized exactly as it will be in the catalogue (for the editor preview). */
  function cardPreview(p, S, others) {
    const cat = S.cat, T = theme(cat);
    let [pw, ph] = PAGE_SIZES[cat.page] || PAGE_SIZES.A4;
    if (cat.orient === 'landscape') [pw, ph] = [ph, pw];
    const m = Math.round(Math.min(pw, ph) * 0.05);
    const n = clamp(parseInt(cat.perPage, 10) || 6, 1, 10), dense = n >= 7 || cat.compact === true;
    const CW = pw - m * 2, CH = (ph - m * 0.55 - 22) - (m * 0.62 + 40 + 16);
    const gap = clamp(Math.min(CW, CH) * 0.022, 6, 14);
    const all = [p].concat(others || []);
    const G = grid(n, CW, CH, gap, (s) => { let mx = 0; for (const q of all) mx = Math.max(mx, productLines(q, S, s, CW / Math.ceil(Math.sqrt(n)) - s * 2, T, dense).h); return mx || s * 3.2; });
    let textH = 0; for (const q of all) textH = Math.max(textH, productLines(q, S, G.s, G.cw - G.pad * 2, T, dense).h);
    const pad = 8;
    const ops = [{ t: 'rect', x: 0, y: 0, w: G.cw + pad * 2, h: G.ch + pad * 2, fill: T.page }];
    productCard(ops, p, pad, pad, G.cw, G.ch, G.s, G.pad, textH, S, T, dense);
    return { w: G.cw + pad * 2, h: G.ch + pad * 2, bg: T.page, ops: ops.filter(o => o.t !== 'link') };
  }
  return { build, theme, waLink, waNumber, enquiryText, productLines, grid, line, wrapped, cardPreview };
})();

/* ---- 09-render.js ---- */
/* ===================== 09 · Renderers: canvas (preview / images) and PDF ===================== */
const RENDER = (() => {
  const W8 = { regular: 400, medium: 500, bold: 700 };
  const QUALITY = {
    small: { dpi: 110, q: 0.72, label: 'Small · best for WhatsApp' },
    standard: { dpi: 160, q: 0.8, label: 'Standard · sharp on phones' },
    print: { dpi: 240, q: 0.88, label: 'Print · large file' }
  };
  function cssFont(op) {
    if (op.raster) return `${W8[op.wt] || 400} ${op.s}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif`;
    const f = Fonts.css(op.fam, op.wt);
    return `${f.weight} ${op.s}px "${f.family}"`;
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawText(ctx, op) {
    ctx.font = cssFont(op);
    ctx.fillStyle = op.color || '#000';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (op.raster) { ctx.fillText(op.str, op.x, op.y); return; }
    // per-glyph placement with the embedded metrics → identical to the PDF
    const face = Fonts.face(op.fam, op.wt), k = op.s / face.upem, tr = (op.tracking || 0) * op.s;
    const { gids, kerns, cps } = face.shape(op.str);
    let x = op.x;
    for (let i = 0; i < gids.length; i++) {
      ctx.fillText(String.fromCodePoint(cps[i]), x, op.y);
      x += (face.adv[gids[i]] + (kerns[i] || 0)) * k + tr;
    }
  }
  function drawQR(ctx, op) {
    const q = QR.encode(op.data);
    const cell = op.size / q.size;
    ctx.fillStyle = op.color || '#000';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) ctx.fillRect(op.x + x * cell, op.y + y * cell, cell + 0.02, cell + 0.02);
  }
  /** Draw one page model to a 2D context at scale (px per pt). getImg(src) → drawable|null (may be async) */
  async function drawPage(ctx, page, scale, getImg, opts = {}) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = page.bg || '#fff'; ctx.fillRect(0, 0, page.w, page.h);
    for (const op of page.ops) {
      ctx.globalAlpha = op.alpha !== undefined && op.t !== 'shadow' ? op.alpha : 1;
      switch (op.t) {
        case 'rect':
          rr(ctx, op.x, op.y, op.w, op.h, op.r);
          if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
          if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw || 0.5; ctx.stroke(); }
          break;
        case 'circle': ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2); ctx.fillStyle = op.fill; ctx.fill(); break;
        case 'line':
          ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.strokeStyle = op.color; ctx.lineWidth = op.lw || 0.5;
          ctx.setLineDash(op.dash ? [0.8, 2.2] : []); ctx.stroke(); ctx.setLineDash([]); break;
        case 'text': drawText(ctx, op); break;
        case 'shadow': {
          ctx.save();
          const cx = op.x + op.w / 2, cy = op.y + op.h / 2;
          ctx.translate(cx, cy); ctx.scale(1, op.h / op.w);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, op.w / 2);
          g.addColorStop(0, `rgba(0,0,0,${0.32 * (op.alpha || 0.7)})`); g.addColorStop(0.55, `rgba(0,0,0,${0.12 * (op.alpha || 0.7)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, op.w / 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'img': {
          const im = await getImg(op.src, op.w * scale, op.h * scale);
          if (im) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, op.x, op.y, op.w, op.h); }
          else { ctx.fillStyle = 'rgba(128,128,128,0.12)'; rr(ctx, op.x, op.y, op.w, op.h, 6); ctx.fill(); }
          break;
        }
        case 'qr': drawQR(ctx, op); break;
        case 'link': case 'goto':
          if (opts.showLinks) { ctx.strokeStyle = 'rgba(37,211,102,0.6)'; ctx.lineWidth = 1 / scale * 2; ctx.setLineDash([3, 3]); ctx.strokeRect(op.x, op.y, op.w, op.h); ctx.setLineDash([]); }
          break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- PDF export ---------- */
  async function encodeImageForPDF(doc, drawable, pxW, pxH, quality) {
    const c = IMG.canvas(pxW, pxH), x = IMG.ctx(c);
    x.imageSmoothingQuality = 'high';
    x.drawImage(drawable, 0, 0, c.width, c.height);
    const id = x.getImageData(0, 0, c.width, c.height);
    const { rgb, alpha } = IMG.splitAlpha(id.data, c.width, c.height);
    if (alpha) { const d = id.data; for (let i = 0, j = 0; i < rgb.length / 3; i++, j += 4) { d[j] = rgb[i * 3]; d[j + 1] = rgb[i * 3 + 1]; d[j + 2] = rgb[i * 3 + 2]; d[j + 3] = 255; } x.putImageData(id, 0, 0); }
    const jpg = new Uint8Array(await (await IMG.toBlob(c, 'image/jpeg', quality)).arrayBuffer());
    const res = await doc.addJPEG(jpg, c.width, c.height, alpha);
    IMG.release(c);
    return res;
  }
  async function encodeLossless(doc, drawable, pxW, pxH) {
    const c = IMG.canvas(pxW, pxH), x = IMG.ctx(c);
    x.imageSmoothingQuality = 'high'; x.drawImage(drawable, 0, 0, c.width, c.height);
    const id = x.getImageData(0, 0, c.width, c.height);
    const { rgb, alpha } = IMG.splitAlpha(id.data, c.width, c.height, 3);
    const res = await doc.addRGB(rgb, c.width, c.height, alpha);
    IMG.release(c);
    return res;
  }
  async function rasterText(doc, op) {
    const k = 4, pad = op.s * 0.5;
    const c = IMG.canvas((op.w + pad * 2) * k, op.s * 1.7 * k), x = c.getContext('2d');
    x.scale(k, k); x.font = cssFont(op); x.fillStyle = op.color || '#000'; x.textBaseline = 'alphabetic';
    x.fillText(op.str, pad, op.s * 1.2);
    const id = x.getImageData(0, 0, c.width, c.height);
    const { rgb, alpha } = IMG.splitAlpha(id.data, c.width, c.height, 2);
    const img = await doc.addRGB(rgb, c.width, c.height, alpha || new Uint8Array(c.width * c.height).fill(255));
    IMG.release(c);
    return { img, x: op.x - pad, y: op.y - op.s * 1.2, w: op.w + pad * 2, h: op.s * 1.7 };
  }

  /**
   * layout: from LAYOUT.build. getFull(src) → Promise<drawable> (full-res product/logo).
   * Returns [{blob, name, pages, products}]
   */
  async function exportPDF(layout, S, getFull, onProgress, cancelled) {
    const Q = QUALITY[S.cat.quality] || QUALITY.standard;
    const pages = layout.pages;
    // split into parts by product count
    const split = Math.max(0, parseInt(S.cat.split, 10) || 0);
    const parts = [];
    if (split > 0) {
      let cur = [], count = 0;
      pages.forEach((pg, i) => {
        const nProd = pg.kind === 'products' ? pg.ids.length : 0;
        if (cur.length && count + nProd > split && pg.kind === 'products') {
          // a section title page belongs with the products that follow it
          const carry = [];
          while (cur.length > 1 && pages[cur[cur.length - 1]].kind === 'divider') carry.unshift(cur.pop());
          parts.push(cur); cur = carry; count = 0;
        }
        cur.push(i); count += nProd;
      });
      if (cur.length) parts.push(cur);
    } else parts.push(pages.map((_, i) => i));
    const forWho = (S.cat.forWho || '').trim();
    const baseName = safeFileName([S.biz.name, S.cat.title, forWho ? 'for ' + forWho : ''].filter(Boolean).join(' ') || 'Catalogue') + '-' + fileStamp();
    const results = [];
    let done = 0; const totalPages = pages.length;
    for (let pi = 0; pi < parts.length; pi++) {
      const idxs = parts[pi], local = new Map(idxs.map((g, l) => [g, l]));
      const doc = new PDFWriter({ title: (S.cat.title || 'Catalogue') + (parts.length > 1 ? ` (part ${pi + 1} of ${parts.length})` : ''), author: S.biz.name || '', subject: (S.cat.subtitle || '') });
      doc.reservePages(idxs.length);
      const cache = new Map();
      let shadowImg = null;
      for (const gi of idxs) {
        if (cancelled && cancelled()) throw new Error('Cancelled');
        const page = pages[gi], pg = doc.page(page.w, page.h);
        for (const op of page.ops) {
          switch (op.t) {
            case 'rect': if (op.fill === '#FFFFFF' && op.x === 0 && op.y === 0 && op.w === page.w) break; pg.rect(op.x, op.y, op.w, op.h, { fill: op.fill, stroke: op.stroke, lw: op.lw, r: op.r, alpha: op.alpha }); break;
            case 'circle': pg.circle(op.cx, op.cy, op.r, { fill: op.fill, alpha: op.alpha }); break;
            case 'line':
              if (op.dash) { const len = Math.hypot(op.x2 - op.x1, op.y2 - op.y1), step = 3; for (let t = 0; t < len; t += step) { const a = t / len, b = Math.min(len, t + 0.9) / len; pg.line(op.x1 + (op.x2 - op.x1) * a, op.y1 + (op.y2 - op.y1) * a, op.x1 + (op.x2 - op.x1) * b, op.y1 + (op.y2 - op.y1) * b, op.color, op.lw); } }
              else pg.line(op.x1, op.y1, op.x2, op.y2, op.color, op.lw, op.alpha);
              break;
            case 'text':
              if (op.raster) { const r = await rasterText(doc, op); pg.image(r.img, r.x, r.y, r.w, r.h, { alpha: op.alpha }); }
              else pg.text(Fonts.face(op.fam, op.wt), op.s, op.x, op.y, op.str, { color: op.color, tracking: op.tracking, alpha: op.alpha });
              break;
            case 'shadow':
              if (!shadowImg) { const sw = 160, sh = 40; shadowImg = await doc.addRGB(new Uint8Array(sw * sh * 3), sw, sh, IMG.shadowAlpha(sw, sh, 0.5)); }
              pg.image(shadowImg, op.x, op.y, op.w, op.h, { alpha: op.alpha });
              break;
            case 'img': {
              const isLogo = op.src === 'logo', key = isLogo ? 'logo' : op.src.id;
              const dpi = isLogo ? Math.max(Q.dpi, 220) : Q.dpi;
              const wantW = Math.max(8, Math.round(op.w / 72 * dpi)), wantH = Math.max(8, Math.round(op.h / 72 * dpi));
              const ck = key + '@' + wantW + 'x' + wantH;
              let em = cache.get(ck);
              if (!em) {
                const dr = await getFull(op.src, wantW, wantH);
                if (!dr) break;
                const nat = IMG.dims(dr);
                const pxW = Math.max(8, Math.min(nat.w, wantW)), pxH = Math.max(8, Math.round(pxW * op.h / op.w));
                em = isLogo ? await encodeLossless(doc, dr, pxW, pxH) : await encodeImageForPDF(doc, dr, pxW, pxH, Q.q);
                cache.set(ck, em);
                if (!isLogo && dr.close) { try { dr.close(); } catch (e) { } }
              }
              pg.image(em, op.x, op.y, op.w, op.h);
              break;
            }
            case 'qr': {
              const q = QR.encode(op.data), cell = op.size / q.size;
              for (let y = 0; y < q.size; y++) {
                let run = -1;
                for (let x = 0; x <= q.size; x++) {
                  const on = x < q.size && q.get(x, y);
                  if (on && run < 0) run = x;
                  if (!on && run >= 0) { pg.rect(op.x + run * cell, op.y + y * cell, (x - run) * cell + 0.05, cell + 0.05, { fill: op.color || '#000' }); run = -1; }
                }
              }
              break;
            }
            case 'link': pg.link(op.x, op.y, op.w, op.h, op.url); break;
            case 'goto': if (local.has(op.page)) pg.goto(op.x, op.y, op.w, op.h, local.get(op.page)); break;
          }
        }
        await pg.end();
        done++;
        onProgress && onProgress(done, totalPages, pi, parts.length);
        await yieldUI();
      }
      for (const b of layout.bookmarks) if (local.has(b.page)) doc.addBookmark(b.title, local.get(b.page));
      const blob = await doc.finish();
      const name = baseName + (parts.length > 1 ? `-part-${pi + 1}-of-${parts.length}` : '') + '.pdf';
      results.push({ blob, name, pages: idxs.length, file: new File([blob], name, { type: 'application/pdf' }) });
    }
    return results;
  }

  /** Pages → JPEG images (for WhatsApp status / Instagram). */
  async function exportImages(layout, getFull, widthPx = 1240, onProgress, pageFilter) {
    const files = [];
    const list = layout.pages.map((p, i) => i).filter(i => !pageFilter || pageFilter(i));
    for (let k = 0; k < list.length; k++) {
      const page = layout.pages[list[k]], scale = widthPx / page.w;
      const c = IMG.canvas(page.w * scale, page.h * scale), ctx = c.getContext('2d');
      await drawPage(ctx, page, scale, (src, w, h) => getFull(src, w, h));
      const blob = await IMG.toBlob(c, 'image/jpeg', 0.88);
      IMG.release(c);
      files.push(new File([blob], `page-${String(list[k] + 1).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
      onProgress && onProgress(k + 1, list.length);
      await yieldUI();
    }
    return files;
  }
  return { drawPage, exportPDF, exportImages, QUALITY };
})();

/* ---- 10-zip-csv.js ---- */
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

/* ---- 11-qr.js ---- */
/* ===================== 11 · QR code encoder (byte mode, ECC level M, versions 1–20) ===================== */
const QR = (() => {
  // [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] for level M
  const M = [null,
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42],
    [28, 7, 45, 3, 46], [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; };
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); }
    return r;
  }
  const cache = new Map();
  function encode(text) {
    if (cache.has(text)) return cache.get(text);
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 0, spec = null;
    for (let v = 1; v <= 20; v++) {
      const s = M[v], dataCw = s[1] * s[2] + s[3] * s[4];
      const bits = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
      if (bits <= dataCw * 8) { ver = v; spec = s; break; }
    }
    if (!ver) throw new Error('QR data too long');
    const size = 17 + ver * 4, dataCw = spec[1] * spec[2] + spec[3] * spec[4];
    // bit stream
    const bb = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
    put(0, Math.min(4, dataCw * 8 - bb.length));
    while (bb.length % 8) bb.push(0);
    const data = []; for (let i = 0; i < bb.length; i += 8) { let v = 0; for (let k = 0; k < 8; k++) v = (v << 1) | bb[i + k]; data.push(v); }
    for (let pad = 0xEC; data.length < dataCw; pad ^= 0xEC ^ 0x11) data.push(pad);
    // blocks + ECC
    const blocks = [], div = rsDivisor(spec[0]); let k = 0;
    for (let g = 0; g < 2; g++) for (let b = 0; b < spec[1 + g * 2]; b++) { const d = data.slice(k, k + spec[2 + g * 2]); k += d.length; blocks.push({ d, e: rsRemainder(d, div) }); }
    const out = []; const maxD = Math.max(...blocks.map(b => b.d.length));
    for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
    for (let i = 0; i < spec[0]; i++) for (const b of blocks) out.push(b.e[i]);
    // matrix
    const mod = new Uint8Array(size * size), fn = new Uint8Array(size * size);
    const set = (x, y, dark) => { mod[y * size + x] = dark ? 1 : 0; fn[y * size + x] = 1; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[ver], na = al.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = (mask) => {
      const dataF = (0 << 3) | mask; let rem = dataF; // level M = 00
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((dataF << 10) | rem) ^ 0x5412, bit = i => ((bits >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const c = ((bits >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, c); set(b, a, c); }
    }
    // place data
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y * size + x] && bi < out.length * 8) { mod[y * size + x] = (out[bi >>> 3] >>> (7 - (bi & 7))) & 1; bi++; }
      }
    }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y * size + x] && maskFn[m](x, y)) mod[y * size + x] ^= 1; };
    const penalty = () => {
      let p = 0; const at = (x, y) => mod[y * size + x];
      for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b <= size; b++) {
          const cur = b < size ? (pass ? at(a, b) : at(b, a)) : -1, prev = pass ? at(a, b - 1) : at(b - 1, a);
          if (cur === prev) run++; else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
        for (let b = 0; b + 11 <= size; b++) {
          let s = ''; for (let t = 0; t < 11; t++) s += pass ? at(a, b + t) : at(b + t, a);
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = at(x, y); if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) p += 3; }
      let dark = 0; for (let i = 0; i < mod.length; i++) dark += mod[i];
      p += Math.floor(Math.abs(dark * 20 - mod.length * 10) / mod.length) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    const res = { size, version: ver, mask: best, get: (x, y) => mod[y * size + x] === 1, modules: mod };
    cache.set(text, res);
    return res;
  }
  return { encode };
})();

/* ---- 20-app-core.js ---- */
/* ===================== 20 · App core: state, data, shared UI ===================== */
const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  images: '<rect x="3" y="5" width="14" height="12" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V9"/><path d="m4 15 4-4 4 4 2-2 3 3"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  wand: '<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  brush: '<path d="M14 4 20 10l-7 7-6-6z"/><path d="M7 11c-3 0-4 3-4 6 0 1-.5 2-1 3 4 0 8-1 9-5"/>',
  erase: '<path d="M8 20h12M5 14l8-8 6 6-8 8H8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
  frame: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="m9 9 6 1-1 5-6-1z"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'
};
const icon = (name, cls = '') => { const s = h('span', { class: 'ic ' + cls, 'aria-hidden': 'true' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; return s; };

const DEFAULT_SETTINGS = () => ({
  v: 2,
  biz: { name: '', tagline: '', phone: '', whatsapp: '', email: '', website: '', address: '', gstin: '' },
  fields: [
    { key: 'brand', label: 'Brand', on: true, showLabel: false, style: 'brand', builtin: true },
    { key: 'size', label: 'Size', on: true, showLabel: true, style: 'meta', builtin: true },
    { key: 'name', label: 'Name', on: true, showLabel: false, style: 'title', builtin: true },
    { key: 'mrp', label: 'MRP', on: true, showLabel: true, style: 'price', builtin: true },
    { key: 'product', label: 'Product', on: true, showLabel: false, style: 'meta', builtin: true }
  ],
  cat: {
    title: 'Product Catalogue', subtitle: '', edition: '', forWho: '', validTill: '', page: 'A4', orient: 'portrait', perPage: 6,
    theme: 'classic', accent: '', font: 'sans', card: 'soft', shadow: true, badges: true,
    cover: true, contents: true, dividers: true, index: false,
    groupBy: 'none', sortBy: 'manual', include: 'ready', brand: '', product: '',
    qr: true, waLinks: true, waMsg: '', note: 'Prices are MRP, inclusive of all taxes.',
    quality: 'standard', split: 0, compact: false, pageNo: true, footContact: true
  },
  photo: { bg: 'quick', aiQuality: 'fast', aiDownloaded: {}, keepSource: true, sticky: ['brand', 'product'] },
  hidden: {},
  logoMode: 'global', staff: '', appUrl: '', lastBackup: 0, onboarded: false
});

const App = {
  S: null, products: [], byId: new Map(), view: 'products',
  filter: { q: '', status: 'all', brand: '' }, selected: new Set(), selecting: false,
  logo: null, // {blob, w, h, bmp}
  stickyValues: {}, saving: 0, busy: 0, lastSaved: 0, persistentOK: true,
  thumbs: new LRU(500, (url) => URL.revokeObjectURL(url)),
  bitmaps: new LRU(120, (b) => { try { b.close && b.close(); } catch (e) { } }),

  async load() {
    App.persistentOK = await DB.open();
    const saved = await DB.getKV('settings', null);
    App.S = mergeDeep(DEFAULT_SETTINGS(), saved || {});
    App.stickyValues = await DB.getKV('sticky', {}) || {};
    const list = await DB.all('products');
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    App.products = list; App.byId = new Map(list.map(p => [p.id, p]));
    const lb = await DB.getBlob('logo');
    if (lb) await App.setLogoBlob(lb, false);
  },
  saveSettings: debounce(async () => { await DB.setKV('settings', App.S); App.markSaved(); Sync.post({ t: 'settings' }); }, 350),
  /** Re-read products changed in another tab (ids) or everything. */
  async reloadProducts(ids) {
    if (!ids) {
      const list = await DB.all('products'); list.sort((a, b) => (a.order || 0) - (b.order || 0));
      App.products = list; App.byId = new Map(list.map(p => [p.id, p]));
    } else {
      for (const id of ids) {
        const rec = await DB.get('products', id), i = App.products.findIndex(x => x.id === id);
        if (rec) { if (i >= 0) App.products[i] = rec; else App.products.push(rec); App.byId.set(id, rec); }
        else if (i >= 0) { App.products.splice(i, 1); App.byId.delete(id); }
        App.thumbs.delete(id);
      }
      App.products.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    App.changed();
  },
  async reloadSettings() {
    const saved = await DB.getKV('settings', null);
    if (saved) App.S = mergeDeep(DEFAULT_SETTINGS(), saved);
    const lb = await DB.getBlob('logo');
    if (lb && (!App.logo || App.logo.blob.size !== lb.size)) await App.setLogoBlob(lb, false);
    App.changed();
  },
  async setLogoBlob(blob, persist = true) {
    if (App.logo && App.logo.bmp && App.logo.bmp.close) App.logo.bmp.close();
    if (App.logo && App.logo.url) URL.revokeObjectURL(App.logo.url);
    if (!blob) { App.logo = null; if (persist) await DB.delBlob('logo'); return; }
    const bmp = await IMG.decode(blob); const d = IMG.dims(bmp);
    App.logo = { blob, w: d.w, h: d.h, bmp };
    if (persist) { await DB.putBlob(blob, 'logo'); App.markSaved(); }
  },
  logoURL() { if (!App.logo) return ''; if (!App.logo.url) App.logo.url = URL.createObjectURL(App.logo.blob); return App.logo.url; },
  markSaved() { App.lastSaved = Date.now(); const el = $('#savestate'); if (el) renderSaveState(el); },

  /* ---- products ---- */
  newProduct() {
    const maxOrder = App.products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    return { id: 'p' + uid(), createdAt: Date.now(), updatedAt: Date.now(), order: maxOrder + 1, f: {}, img: {}, edit: null, review: false, q: null, t: 0 };
  },
  async saveProduct(p) {
    p.updatedAt = Date.now();
    App.saving++;
    try { await DB.put('products', p); }
    finally { App.saving--; }
    if (!App.byId.has(p.id)) { App.products.push(p); }
    else { const i = App.products.findIndex(x => x.id === p.id); if (i >= 0) App.products[i] = p; }
    App.byId.set(p.id, p);
    App.thumbs.delete(p.id); for (const k of Array.from(App.bitmaps.map.keys())) if (k.startsWith(p.id + '@')) App.bitmaps.delete(k);
    App.markSaved();
    Sync.post({ t: 'products', ids: [p.id] });
    App.changed();
  },
  async deleteProducts(ids) {
    const blobs = [];
    for (const id of ids) { const p = App.byId.get(id); if (!p) continue; for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) blobs.push(p.img[k]); }
    await DB.delMany('blobs', blobs); await DB.delMany('products', ids);
    const set = new Set(ids);
    App.products = App.products.filter(p => !set.has(p.id));
    for (const id of ids) { App.byId.delete(id); App.thumbs.delete(id); App.selected.delete(id); }
    Sync.post({ t: 'products', ids });
    App.markSaved(); App.changed();
  },
  async duplicateProduct(p) {
    const q = JSON.parse(JSON.stringify(p));
    q.id = 'p' + uid(); q.createdAt = q.updatedAt = Date.now(); q.order = (p.order || 0) + 0.5;
    q.img = Object.assign({}, p.img);
    for (const k of ['src', 'mask', 'out', 'thumb']) if (p.img && p.img[k]) { const b = await DB.getBlob(p.img[k]); q.img[k] = b ? await DB.putBlob(b) : null; }
    await App.saveProduct(q); await App.renumber();
    return q;
  },
  /** Close gaps in the manual order; writes only the products whose position changed. */
  async renumber() {
    App.products.sort((a, b) => (a.order || 0) - (b.order || 0));
    const changed = [];
    App.products.forEach((p, i) => { if (p.order !== i + 1) { p.order = i + 1; changed.push(p); } });
    await DB.putMany('products', changed);
    if (changed.length) Sync.post({ t: 'products', ids: changed.map(p => p.id) });
  },
  status(p) {
    if (p.draft) return 'review';
    if (!p.img || !p.img.out) return 'nophoto';
    if (p.review) return 'review';
    if (!(p.f && (p.f.name || p.f.product || p.f.brand))) return 'nodetails';
    return 'ready';
  },
  brands() { const s = new Map(); for (const p of App.products) { const b = (p.f.brand || '').trim(); if (b) s.set(b.toLowerCase(), b); } return Array.from(s.values()).sort((a, b) => a.localeCompare(b)); },
  values(key) { const s = new Map(); for (const p of App.products) { const b = String(p.f[key] || '').trim(); if (b) s.set(b.toLowerCase(), b); } return Array.from(s.values()).sort((a, b) => a.localeCompare(b)).slice(0, 300); },
  async thumbURL(p) {
    let u = App.thumbs.get(p.id); if (u) return u;
    if (!p.img || !p.img.thumb) return null;
    const b = await DB.getBlob(p.img.thumb); if (!b) return null;
    u = URL.createObjectURL(b); App.thumbs.set(p.id, u); return u;
  },
  /** Decoded cut-out for previews/PDF (cached at a size bucket) */
  async productBitmap(id, maxPx) {
    const p = App.byId.get(id); if (!p || !p.img || !p.img.out) return null;
    const bucket = maxPx ? Math.min(1400, Math.pow(2, Math.ceil(Math.log2(Math.max(64, maxPx))))) : 0;
    const key = id + '@' + bucket + '@' + p.updatedAt;
    let b = App.bitmaps.get(key); if (b) return b;
    const blob = await DB.getBlob(p.img.out); if (!blob) return null;
    try {
      if (bucket && window.createImageBitmap) {
        const s = Math.min(1, bucket / Math.max(p.img.ow || bucket, p.img.oh || bucket));
        b = await createImageBitmap(blob, s < 1 ? { resizeWidth: Math.max(1, Math.round((p.img.ow || bucket) * s)), resizeHeight: Math.max(1, Math.round((p.img.oh || bucket) * s)), resizeQuality: 'high' } : {});
      } else b = await IMG.decode(blob);
    } catch (e) { b = await IMG.decode(blob); }
    if (bucket) App.bitmaps.set(key, b);
    return b;
  },
  listeners: new Set(),
  changed: debounce(() => { for (const fn of App.listeners) try { fn(); } catch (e) { LOG.add('error', e); } }, 60)
};
function mergeDeep(base, extra) {
  for (const k in extra) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

/* ---------- keep open copies (tabs, home-screen app) in step: data changes are broadcast ---------- */
const Sync = {
  ch: null, id: uid(),
  init() {
    if (!('BroadcastChannel' in window)) return;
    try { this.ch = new BroadcastChannel('catalogue-maker-v2'); } catch (e) { return; }
    this.ch.onmessage = (e) => this.receive(e.data);
  },
  post(m) { if (this.ch) try { this.ch.postMessage(Object.assign({ from: this.id }, m)); } catch (e) { } },
  async receive(m) {
    if (!m || m.from === this.id) return;
    if (m.t === 'products') await App.reloadProducts(m.ids);
    else if (m.t === 'reload') await App.reloadProducts();
    else if (m.t === 'settings') await App.reloadSettings();
  }
};

/* ---------- one working copy at a time ----------
   The copy opened last becomes the working copy without any warning. An older copy
   (another tab, the home-screen app) pauses with a "Use here" button, and resumes by
   itself when the working copy closes. Uses Web Locks, so a crashed or closed tab
   releases its turn automatically. */
const Presence = {
  NAME: 'catalogue-maker-working-copy', active: true, waiting: null, el: null, inerted: [],
  supported: !!(navigator.locks && navigator.locks.request),
  init() {
    if (!this.supported) return;
    // a page Chrome preloads in the background must not take over until it is actually shown
    if (document.prerendering) document.addEventListener('prerenderingchange', () => this.take(), { once: true });
    else this.take();
  },
  /** Become the working copy now (taking over from any other copy). */
  take() {
    if (this.waiting) { try { this.waiting.abort(); } catch (e) { } this.waiting = null; }
    this.hold(true);
  },
  hold(steal) {
    let granted = false;
    const ac = steal ? null : new AbortController();
    if (ac) this.waiting = ac;
    navigator.locks.request(this.NAME, steal ? { steal: true } : { signal: ac.signal }, () => new Promise(() => {
      // held until this page closes or another copy takes over
      granted = true; if (ac) this.waiting = null;
      this.set(true);
    })).catch(() => {
      if (!granted) return;              // stopped waiting because this copy took over
      this.set(false); this.hold(false); // another copy took over: pause, wait for our turn
    });
  },
  async set(on) {
    if (on === this.active) return;
    this.active = on;
    if (on) {
      // back from a pause: the other copy may have changed things
      this.hide();
      try { await App.reloadProducts(); await App.reloadSettings(); } catch (e) { LOG.add('warn', 'refresh after resume failed', e && e.message); }
      LOG.add('info', 'working copy again');
    } else {
      // keep anything typed here before pausing
      try { App.saveSettings.flush(); } catch (e) { }
      try { Editor.autosave.flush(); } catch (e) { }
      this.show();
      LOG.add('info', 'paused: app opened in another tab or window');
    }
  },
  show() {
    if (this.el) return;
    const btn = h('button', { class: 'btn primary', onclick: () => this.take() }, 'Use here');
    this.el = h('div', { class: 'paused', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'paused-t', 'aria-describedby': 'paused-d' },
      h('div', { class: 'paused-card' },
        h('span', { class: 'tag paused-tag', 'aria-hidden': 'true' }, '₹'),
        h('h2', { id: 'paused-t' }, 'Open in another tab'),
        h('p', { id: 'paused-d' }, 'The app is open in another tab or window, so it\'s paused here to keep your work in one place. Everything is saved.'),
        btn));
    this.inerted = Array.from(document.body.children).filter(x => !x.inert);
    for (const x of this.inerted) x.inert = true;
    document.body.appendChild(this.el);
    try { btn.focus({ preventScroll: true }); } catch (e) { }
  },
  hide() {
    if (!this.el) return;
    for (const x of this.inerted) x.inert = false;
    this.inerted = []; this.el.remove(); this.el = null;
  }
};

/* ---------- shared UI components ---------- */
const UI = {
  toast(msg, o = {}) {
    let wrap = $('#toasts'); if (!wrap) { wrap = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(wrap); }
    const t = h('div', { class: 'toast ' + (o.type || '') }, o.icon ? icon(o.icon) : null, h('span', null, msg),
      o.action ? h('button', { class: 'toast-act', onclick: () => { o.action.fn(); t.remove(); } }, o.action.label) : null);
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, o.ms || (o.action ? 6000 : 3200));
  },
  modal({ title, body, actions = [], wide = false, onClose, dismissible = true, cls = '' }) {
    const back = h('div', { class: 'modal-back' });
    const close = (v) => { back.classList.add('out'); setTimeout(() => back.remove(), 180); document.removeEventListener('keydown', onKey); onClose && onClose(v); };
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
    const box = h('div', { class: 'modal ' + (wide ? 'wide ' : '') + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
      title ? h('div', { class: 'modal-head' }, h('h2', null, title), dismissible ? h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, icon('x')) : null) : null,
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' }, actions.map(a => h('button', { class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'), onclick: async () => { const r = a.onClick ? await a.onClick() : undefined; if (r !== false) close(a.value); } }, a.icon ? icon(a.icon) : null, a.label))) : null);
    back.appendChild(box);
    back.addEventListener('click', (e) => { if (e.target === back && dismissible) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    setTimeout(() => { const f = box.querySelector('input,select,textarea,button.primary'); if (f && !ENV.touch) f.focus(); }, 30);
    return { close, el: box };
  },
  confirm(title, text, okLabel = 'OK', danger = false) {
    return new Promise(res => {
      UI.modal({ title, body: h('p', { class: 'muted' }, text), onClose: (v) => res(v === true),
        actions: [{ label: 'Cancel', value: false }, { label: okLabel, primary: !danger, danger, value: true }] });
    });
  },
  sheet(title, items) {
    const back = h('div', { class: 'sheet-back' });
    const close = () => { back.classList.add('out'); setTimeout(() => back.remove(), 200); };
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-grip' }), title ? h('h3', null, title) : null,
      items.map(it => it.sep ? h('div', { class: 'sheet-sep' }) : h('button', { class: 'sheet-item' + (it.primary ? ' primary' : ''), onclick: () => { close(); it.onClick && it.onClick(); } },
        h('span', { class: 'si-ic' }, icon(it.icon || 'chev')), h('span', { class: 'si-txt' }, h('b', null, it.label), it.sub ? h('small', null, it.sub) : null))));
    back.appendChild(sheet);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.appendChild(back);
    return { close };
  },
  progress(title, cancellable = false) {
    let cancelled = false;
    const bar = h('div', { class: 'pbar' }, h('i'));
    const txt = h('p', { class: 'muted small' }, 'Starting…');
    const m = UI.modal({ title, dismissible: false, body: h('div', { class: 'progress-body' }, bar, txt),
      actions: cancellable ? [{ label: 'Cancel', onClick: () => { cancelled = true; txt.textContent = 'Stopping…'; return false; } }] : [] });
    return {
      set(frac, text) { if (frac !== null && frac !== undefined) { bar.firstChild.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; bar.classList.remove('indet'); } else bar.classList.add('indet'); if (text) txt.textContent = text; },
      close: () => m.close(), get cancelled() { return cancelled; }
    };
  },
  field(label, input, hint) { return h('label', { class: 'field' }, h('span', { class: 'f-label' }, label), input, hint ? h('small', { class: 'f-hint' }, hint) : null); },
  toggle(label, checked, onChange, hint) {
    const inp = h('input', { type: 'checkbox', role: 'switch', checked, onchange: e => onChange(e.target.checked) });
    return h('label', { class: 'toggle' }, h('span', { class: 'tg-txt' }, h('span', null, label), hint ? h('small', null, hint) : null), inp, h('i', { class: 'tg-ui', 'aria-hidden': 'true' }));
  },
  seg(options, value, onChange, cls = '') {
    const wrap = h('div', { class: 'seg ' + cls, role: 'radiogroup' });
    const draw = (v) => { clear(wrap); options.forEach(o => wrap.appendChild(h('button', { class: 'seg-btn' + (o.value === v ? ' on' : ''), role: 'radio', 'aria-checked': String(o.value === v), title: o.title || '', onclick: () => { draw(o.value); onChange(o.value); } }, o.icon ? icon(o.icon) : null, o.label))); };
    draw(value);
    wrap.set = draw;
    return wrap;
  },
  slider(label, value, min, max, onInput, fmt) {
    const out = h('output', null, fmt ? fmt(value) : String(value));
    const inp = h('input', { type: 'range', min, max, value, step: 1, oninput: e => { out.textContent = fmt ? fmt(+e.target.value) : e.target.value; onInput(+e.target.value, false); }, onchange: e => onInput(+e.target.value, true) });
    return h('label', { class: 'slider' }, h('span', { class: 'sl-head' }, h('span', null, label), out), inp);
  },
  async share(files, title, text) {
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title, text }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'aborted'; LOG.add('warn', 'share failed', e && e.message); }
    return 'unsupported';
  },
  download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
  },
  open(blob) { const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) UI.download(blob, 'catalogue.pdf'); setTimeout(() => URL.revokeObjectURL(url), 120000); },
  pickFiles({ accept = 'image/*', multiple = false, capture = false } = {}) {
    return new Promise(res => {
      const inp = h('input', { type: 'file', accept, style: 'position:fixed;left:-999px;top:0;opacity:0' });
      if (multiple) inp.multiple = true;
      if (capture) inp.setAttribute('capture', 'environment');
      // Never guess "cancelled" from focus changes: on Android the camera can hand the photo back late.
      inp.onchange = () => { res(Array.from(inp.files || [])); setTimeout(() => inp.remove(), 1000); };
      inp.addEventListener('cancel', () => { res([]); setTimeout(() => inp.remove(), 1000); });
      document.body.appendChild(inp); inp.click();
    });
  }
};
function renderSaveState(el) {
  clear(el);
  if (!App.persistentOK) { el.className = 'savestate bad'; el.append(icon('alert'), 'Not saving on this phone'); el.title = 'This browser is not letting the app save. Open the website link in Chrome or Safari.'; return; }
  el.className = 'savestate ok'; el.append(h('i', { class: 'dot' }), App.products.length ? 'Saved on this phone' : 'Ready');
}

/* ---- 21-products.js ---- */
/* ===================== 21 · Products view, adding, batch, CSV ===================== */
const STATUS_LABEL = { ready: 'Ready', review: 'Check cut-out', nodetails: 'Add details', nophoto: 'No photo' };

const ProductsView = {
  el: null, grid: null, items: [], cols: 2, rowH: 252, sort: 'newest',
  render(main) {
    const S = App.S;
    const total = App.products.length;
    const counts = { all: total, ready: 0, review: 0, nodetails: 0, nophoto: 0 };
    for (const p of App.products) counts[App.status(p)]++;
    const brands = App.brands();
    const head = h('header', { class: 'top' },
      h('div', { class: 'top-row' },
        App.logo ? h('img', { class: 'top-logo', alt: S.biz.name || 'Logo', src: App.logoURL() }) : h('span', { class: 'top-mark' }, icon('tag')),
        h('div', { class: 'top-title' }, h('h1', null, App.logo || !S.biz.name ? 'Products' : S.biz.name), h('span', { id: 'savestate', class: 'savestate' })),
        h('button', { class: 'icon-btn phone-only', 'aria-label': 'Settings', onclick: () => go('settings') }, icon('gear')),
        h('button', { class: 'icon-btn', 'aria-label': 'More', onclick: () => ProductsView.menu() }, icon('more'))),
      Banners.render(),
      total ? StatsStrip.render() : null,
      total ? h('div', { class: 'searchbar' }, icon('search'),
        h('input', { type: 'search', placeholder: 'Search name, brand, size…', value: App.filter.q, 'aria-label': 'Search products', oninput: debounce(e => { App.filter.q = e.target.value; ProductsView.refresh(); }, 120) }),
        brands.length > 1 ? h('select', { class: 'brandsel', 'aria-label': 'Filter by brand', onchange: e => { App.filter.brand = e.target.value; ProductsView.refresh(); } },
          h('option', { value: '' }, 'All brands'), brands.map(b => h('option', { value: b, selected: App.filter.brand === b }, b))) : null) : null,
      total ? h('div', { class: 'chips', role: 'tablist' },
        [['all', 'All'], ['ready', 'Ready'], ['review', 'Check'], ['nodetails', 'No details'], ['nophoto', 'No photo']].filter(([k]) => k === 'all' || counts[k]).map(([k, l]) =>
          h('button', { class: 'chip' + (App.filter.status === k ? ' on' : '') + (k === 'review' ? ' warn' : ''), role: 'tab', dataset: { k }, 'aria-selected': String(App.filter.status === k), onclick: () => { App.filter.status = k; ProductsView.refresh(true); } }, l, h('b', null, String(counts[k]))))) : null
    );
    const sel = App.selecting ? ProductsView.selectionBar() : null;
    const grid = h('div', { class: 'pgrid', role: 'list' });
    const body = total ? [h('div', { class: 'list-head' }, h('span', { class: 'muted small', id: 'shown-count' }), h('button', { class: 'linkish small', onclick: () => { ProductsView.sort = ProductsView.sort === 'newest' ? 'order' : 'newest'; ProductsView.refresh(true); } }, ProductsView.sort === 'newest' ? 'Newest first' : 'Catalogue order')), grid] : [Onboarding.render()];
    this.sig = ProductsView.statusSig();
    clear(main).append(head, sel || '', ...body);
    renderSaveState($('#savestate'));
    this.el = main; this.grid = grid;
    if (total) this.refresh(true);
  },
  statusSig() { const seen = new Set(); for (const p of App.products) seen.add(App.status(p)); return ['ready', 'review', 'nodetails', 'nophoto'].filter(k => seen.has(k)).join(','); },
  filtered() {
    const f = App.filter, q = f.q.trim().toLowerCase();
    let list = App.products.filter(p => {
      if (f.status !== 'all' && App.status(p) !== f.status) return false;
      if (f.brand && (p.f.brand || '').trim().toLowerCase() !== f.brand.toLowerCase()) return false;
      if (q) { const hay = Object.values(p.f || {}).join(' ').toLowerCase(); if (!q.split(/\s+/).every(t => hay.includes(t))) return false; }
      return true;
    });
    if (this.sort === 'newest') list = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    return list;
  },
  refresh(resetScroll) {
    if (!this.grid || !document.body.contains(this.grid)) return;
    this.items = this.filtered();
    const sc = $('#shown-count'); if (sc) sc.textContent = this.items.length === App.products.length ? `${this.items.length} product${this.items.length === 1 ? '' : 's'}` : `${this.items.length} of ${App.products.length} shown`;
    const counts = { all: App.products.length, ready: 0, review: 0, nodetails: 0, nophoto: 0 };
    for (const p of App.products) counts[App.status(p)]++;
    $$('.chips .chip[data-k]').forEach(c => { const k = c.dataset.k, on = App.filter.status === k; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); const b = c.querySelector('b'); if (b) b.textContent = String(counts[k]); });
    const w = this.grid.clientWidth || window.innerWidth - 32;
    this.cols = Math.max(2, Math.floor((w + 12) / 172));
    const tileW = (w - (this.cols - 1) * 12) / this.cols;
    this.rowH = Math.round(tileW * 0.86 + 96 + 12);
    const rows = Math.ceil(this.items.length / this.cols);
    this.grid.style.height = Math.max(0, rows * this.rowH - 12) + 'px';
    this.grid.style.setProperty('--cols', this.cols);
    this.rendered = new Map();
    clear(this.grid);
    if (!this.items.length) this.grid.appendChild(h('div', { class: 'empty-filter' }, h('p', null, 'No products match.'), h('button', { class: 'btn ghost', onclick: () => { App.filter = { q: '', status: 'all', brand: '' }; ProductsView.render(ProductsView.el); } }, 'Clear filters')));
    if (resetScroll && window.scrollY > (this.grid.offsetTop || 0)) window.scrollTo(0, Math.max(0, this.grid.offsetTop - 80));
    this.paint();
  },
  paint() {
    if (!this.grid || !this.items.length) return;
    const rect = this.grid.getBoundingClientRect();
    const top = -rect.top, vh = window.innerHeight;
    const r0 = Math.max(0, Math.floor((top - 400) / this.rowH)), r1 = Math.min(Math.ceil(this.items.length / this.cols), Math.ceil((top + vh + 400) / this.rowH));
    const keep = new Set();
    for (let r = r0; r < r1; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c; if (i >= this.items.length) break;
      const p = this.items[i]; keep.add(p.id);
      if (this.rendered.has(p.id)) { const t = this.rendered.get(p.id); t.style.transform = `translate(${c * 100}%, ${r * this.rowH}px)`; t.style.left = `calc(${c} * 12px)`; continue; }
      const t = this.tile(p); t.style.transform = `translate(${c * 100}%, ${r * this.rowH}px)`; t.style.left = `calc(${c} * 12px)`;
      this.grid.appendChild(t); this.rendered.set(p.id, t);
    }
    for (const [id, t] of this.rendered) if (!keep.has(id)) { t.remove(); this.rendered.delete(id); }
  },
  tile(p) {
    const st = App.status(p), sel = App.selected.has(p.id);
    const img = h('img', { alt: '', decoding: 'async' });
    App.thumbURL(p).then(u => { if (u) img.src = u; else img.replaceWith(h('div', { class: 't-noimg' }, icon('camera'), h('span', null, 'Add photo'))); });
    const mrp = p.f.mrp ? fmtMoney(p.f.mrp) : '';
    const t = h('div', { class: 'tile' + (sel ? ' sel' : ''), role: 'listitem', tabindex: '0', dataset: { id: p.id } },
      h('div', { class: 't-img' }, img),
      h('div', { class: 't-body' },
        p.f.brand ? h('div', { class: 't-brand' }, p.f.brand) : null,
        h('div', { class: 't-name' + (p.f.name ? '' : ' muted') }, p.f.name || p.f.product || 'No name yet'),
        h('div', { class: 't-row' }, mrp ? h('span', { class: 'tag' }, mrp) : null, p.f.size ? h('span', { class: 't-size' }, p.f.size) : null)),
      st !== 'ready' ? h('span', { class: 't-status ' + st }, p.draft ? 'Unfinished' : STATUS_LABEL[st]) : null,
      App.selecting ? h('span', { class: 't-check' + (sel ? ' on' : '') }, icon('check')) : null);
    let pressT = 0, pressed = false;
    t.addEventListener('pointerdown', () => { pressed = false; pressT = setTimeout(() => { pressed = true; if (!App.selecting) { App.selecting = true; App.selected.add(p.id); if (navigator.vibrate) navigator.vibrate(12); ProductsView.render(ProductsView.el); } }, 480); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => t.addEventListener(ev, () => clearTimeout(pressT)));
    t.addEventListener('click', () => {
      if (pressed) return;
      if (App.selecting) { if (App.selected.has(p.id)) App.selected.delete(p.id); else App.selected.add(p.id); t.classList.toggle('sel'); const c = t.querySelector('.t-check'); if (c) c.classList.toggle('on'); ProductsView.updateSelCount(); return; }
      Editor.open({ product: p });
    });
    t.addEventListener('keydown', e => { if (e.key === 'Enter') t.click(); });
    t.addEventListener('contextmenu', e => e.preventDefault());
    return t;
  },
  selectionBar() {
    const n = App.selected.size;
    return h('div', { class: 'selbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Done selecting', onclick: () => { App.selecting = false; App.selected.clear(); ProductsView.render(ProductsView.el); } }, icon('x')),
      h('b', { id: 'selcount' }, n + ' selected'),
      h('button', { class: 'btn small ghost', onclick: () => { for (const p of ProductsView.items) App.selected.add(p.id); ProductsView.render(ProductsView.el); } }, 'Select all shown'),
      h('div', { class: 'selbar-acts' },
        h('button', { class: 'btn small', onclick: () => BulkEdit.open() }, icon('edit'), 'Edit'),
        h('button', { class: 'btn small', onclick: () => ProductsView.selMenu() }, icon('more'), 'More')));
  },
  updateSelCount() { const b = $('#selcount'); if (b) b.textContent = App.selected.size + ' selected'; },
  selMenu() {
    const ids = Array.from(App.selected);
    if (!ids.length) { UI.toast('Select products first'); return; }
    UI.sheet(ids.length + ' selected', [
      { icon: 'book', label: 'Make a catalogue of these', sub: 'Opens the catalogue with only these products', onClick: () => { App.S.cat.include = 'selected'; App.saveSettings(); go('catalogue'); } },
      { icon: 'up', label: 'Move to start of catalogue', onClick: async () => { const min = Math.min(...App.products.map(p => p.order || 0)); ids.forEach((id, i) => { App.byId.get(id).order = min - ids.length + i; }); await App.renumber(); UI.toast('Moved to the start'); ProductsView.refresh(); } },
      { icon: 'down', label: 'Move to end of catalogue', onClick: async () => { const max = Math.max(...App.products.map(p => p.order || 0)); ids.forEach((id, i) => { App.byId.get(id).order = max + 1 + i; }); await App.renumber(); UI.toast('Moved to the end'); ProductsView.refresh(); } },
      { icon: 'copy', label: 'Duplicate', sub: 'For size or colour variants', onClick: async () => { for (const id of ids) await App.duplicateProduct(App.byId.get(id)); UI.toast(`Duplicated ${ids.length}`); } },
      { sep: true },
      { icon: 'trash', label: 'Delete', sub: 'Removes photos and details from this phone', onClick: async () => { if (await UI.confirm(`Delete ${ids.length} product${ids.length > 1 ? 's' : ''}?`, 'This removes them from this phone. If you have a backup you can restore them.', 'Delete', true)) { await App.deleteProducts(ids); App.selecting = false; UI.toast('Deleted'); ProductsView.render(ProductsView.el); } } }
    ]);
  },
  menu() {
    UI.sheet('More', [
      { icon: 'file', label: 'Import product list (CSV)', sub: 'From Excel: File → Save as → CSV', onClick: () => CsvImport.run() },
      { icon: 'download', label: 'Export product list (CSV)', onClick: () => CsvImport.exportCSV() },
      { icon: 'shield', label: 'Back up everything', sub: 'One file with photos and details', onClick: () => Backup.create() },
      { icon: 'cloud', label: 'Restore or merge a backup', sub: 'Also used to combine work from several phones', onClick: () => Backup.restore() },
      { icon: 'check', label: 'Select products', onClick: () => { App.selecting = true; ProductsView.render(ProductsView.el); } },
      { icon: 'info', label: 'How to take good product photos', onClick: () => Help.photoTips() }
    ]);
  }
};
window.addEventListener('scroll', () => { if (App.view === 'products') requestAnimationFrame(() => ProductsView.paint()); }, { passive: true });
window.addEventListener('resize', debounce(() => { if (App.view === 'products') ProductsView.refresh(); }, 150));

const StatsStrip = {
  render() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const done = App.products.filter(p => p.createdAt >= today.getTime());
    const timed = done.filter(p => p.t > 0 && p.t < 15 * 60000);
    const avg = timed.length ? Math.round(timed.reduce((a, p) => a + p.t, 0) / timed.length / 1000) : 0;
    const ready = App.products.filter(p => App.status(p) === 'ready').length;
    return h('div', { class: 'stats' },
      h('div', null, h('b', null, String(App.products.length)), h('span', null, 'products')),
      h('div', null, h('b', null, String(ready)), h('span', null, 'ready for PDF')),
      h('div', null, h('b', null, String(done.length)), h('span', null, 'added today')),
      avg ? h('div', null, h('b', null, avg + 's'), h('span', null, 'per product')) : null);
  }
};

const Banners = {
  dismissed: new Set(),
  render() {
    const out = [];
    // remember=true: a dismissed banner stays hidden on this phone for 30 days
    const hiddenUntil = (key) => (App.S.hidden && App.S.hidden[key] || 0) + 30 * 864e5 > Date.now();
    const add = (key, kind, text, actLabel, act, remember) => {
      if (this.dismissed.has(key) || (remember && hiddenUntil(key))) return;
      out.push(h('div', { class: 'banner ' + kind }, icon(kind === 'bad' ? 'alert' : kind === 'tip' ? 'zap' : 'info'), h('p', null, text), actLabel ? h('button', { class: 'btn small', onclick: act }, actLabel) : null,
        h('button', { class: 'icon-btn small', 'aria-label': 'Dismiss', onclick: (e) => { this.dismissed.add(key); if (remember) { App.S.hidden = Object.assign({}, App.S.hidden, { [key]: Date.now() }); App.saveSettings(); } e.target.closest('.banner').remove(); } }, icon('x'))));
    };
    if (Install.can() && App.products.length) add('install', 'tip', ENV.isIOS ? 'Add the app to your home screen: it opens like an app and keeps your work safer.' : 'Install the app: it opens from your home screen, works offline, and you can share photos into it.', ENV.isIOS ? 'How' : 'Install', () => Install.run(), true);
    if (ENV.isFile || ENV.contentUri) add('file', 'bad', 'You opened a saved copy of this page (for example from WhatsApp). Work saved here may disappear and sharing can fail. Open the website link in Chrome or Safari instead.', App.S.appUrl ? 'Copy link' : null, () => { navigator.clipboard && navigator.clipboard.writeText(App.S.appUrl); UI.toast('Link copied'); });
    else if (ENV.inApp) add('inapp', 'bad', 'You are inside another app\'s browser. Open this page in Chrome or Safari so your products are saved in one place.', null);
    if (!App.persistentOK) add('nostore', 'bad', 'This browser is not letting the app save your work. Use Chrome or Safari (not private mode).', null);
    const n = App.products.length, last = App.S.lastBackup || 0;
    if (n >= 15 && Date.now() - last > 7 * 864e5) add('backup', 'warn', last ? `Last backup ${Math.round((Date.now() - last) / 864e5)} days ago. Back up your ${n} products.` : `Your ${n} products are only on this phone. Make a backup file.`, 'Back up', () => Backup.create());
    if (Banners.storageLow) add('storage', 'warn', 'This phone is running low on space for the app. Back up, then remove old products.', 'Back up', () => Backup.create());
    return out.length ? h('div', { class: 'banners' }, out) : null;
  }
};

const Onboarding = {
  render() {
    const S = App.S;
    const step = (done, title, text, btn, fn) => h('li', { class: done ? 'done' : '' }, h('span', { class: 'ob-dot' }, done ? icon('check') : null), h('div', null, h('b', null, title), h('p', { class: 'muted' }, text), btn ? h('button', { class: 'btn ' + (done ? 'ghost' : 'primary') + ' small', onclick: fn }, btn) : null));
    return h('section', { class: 'onboard' },
      h('div', { class: 'ob-hero' },
        h('div', { class: 'ob-tag' }, h('span', { class: 'tag big' }, '₹ MRP')),
        h('h2', null, 'Photograph a product, get a catalogue page.'),
        h('p', { class: 'muted' }, 'Straighten the photo with four corners, remove the background, add the details. Everything stays on this phone until you share the PDF.')),
      h('ol', { class: 'ob-steps' },
        Install.can() ? step(false, 'Install the app on this phone', ENV.isIOS ? 'It opens from your home screen like an app, works offline and keeps your work safer.' : 'It opens from your home screen, works offline, and you can share photos into it from Gallery or WhatsApp.', ENV.isIOS ? 'Show me how' : 'Install', () => Install.run()) : null,
        step(!!(S.biz.name && App.logo), 'Add your shop name and logo', 'Shown on every page. The logo goes top right, background removed.', 'Set up', () => go('settings')),
        step(false, 'Add your first product', 'Take a photo against a plain wall or sheet for the cleanest cut-out.', 'Take photo', () => Add.photo()),
        step(false, 'Create the PDF', 'Choose 1 to 10 products per page and share it on WhatsApp.', null)),
      h('div', { class: 'ob-more' },
        h('button', { class: 'btn ghost', onclick: () => Add.choose() }, icon('images'), 'Choose photos'),
        h('button', { class: 'btn ghost', onclick: () => CsvImport.run() }, icon('file'), 'Import product list'),
        h('button', { class: 'btn ghost', onclick: () => Backup.restore() }, icon('cloud'), 'Restore a backup')));
  }
};

/* ---------- adding products ---------- */
const Add = {
  sheet() {
    UI.sheet('Add products', [
      { icon: 'camera', label: 'Take photo', sub: 'Opens the camera', primary: true, onClick: () => Add.photo() },
      { icon: 'images', label: 'Choose photos', sub: 'Pick one to edit, or many to process automatically', onClick: () => Add.choose() },
      { icon: 'file', label: 'Import product list (CSV)', sub: 'Brand, size, name, MRP from Excel', onClick: () => CsvImport.run() },
      { icon: 'edit', label: 'Add details only', sub: 'Photo can be added later', onClick: () => Editor.open({ noPhoto: true }) },
      { sep: true },
      { icon: 'info', label: 'Photo tips', sub: 'Get clean cut-outs first time', onClick: () => Help.photoTips() }
    ]);
  },
  async photo(product) {
    const files = await UI.pickFiles({ capture: true });
    if (files[0]) Editor.open({ file: files[0], product });
  },
  async choose() {
    const files = await UI.pickFiles({ multiple: true });
    if (!files.length) return;
    if (files.length === 1) { Editor.open({ file: files[0] }); return; }
    Batch.add(files);
  },
  /** Files shared into the app (Android Share menu) or dropped on it: photos, a product list or a backup. */
  async receive(files) {
    const isImg = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(f.name || '');
    const zip = files.find(f => /zip/.test(f.type) || /\.zip$/i.test(f.name || ''));
    const csv = files.find(f => /csv|comma-separated/.test(f.type) || /\.(csv|tsv)$/i.test(f.name || ''));
    const imgs = files.filter(isImg);
    if (zip) { await Backup.restore(zip); return; }
    if (csv) await CsvImport.run(csv);
    if (imgs.length === 1 && !csv) Editor.open({ file: imgs[0] });
    else if (imgs.length) Batch.add(imgs);
    if (!zip && !csv && !imgs.length) UI.toast('These files can\'t be added. Share photos, a CSV product list or a backup file.', { type: 'bad', ms: 6000 });
  }
};

/* ---------- photos and files shared from other apps (via the service worker) ---------- */
const Inbox = {
  async take(stamp) {
    if (!('caches' in window)) return [];
    const c = await caches.open('share-inbox'), got = [];
    for (const r of await c.keys()) {
      const m = /\/share-inbox\/([^/]+)\/(\d+)$/.exec(new URL(r.url).pathname);
      if (!m) continue;
      if (m[1] === stamp) {
        const res = await c.match(r);
        if (res) {
          const blob = await res.blob();
          got.push({ i: +m[2], file: new File([blob], decodeURIComponent(res.headers.get('X-File-Name') || 'shared'), { type: blob.type || res.headers.get('Content-Type') || '' }) });
        }
        await c.delete(r);
      } else if (Date.now() - parseInt(m[1], 36) > 36e5) await c.delete(r); // leftovers older than an hour
    }
    return got.sort((a, b) => a.i - b.i).map(x => x.file);
  }
};

const Batch = {
  queue: [], running: false, done: 0, total: 0, failed: 0, panel: null,
  add(files) {
    this.queue.push(...files); this.total += files.length;
    UI.toast(`Processing ${files.length} photos. You can keep working.`, { icon: 'zap' });
    this.ensurePanel();
    if (!this.running) this.run();
  },
  ensurePanel() {
    if (this.panel && document.body.contains(this.panel)) return;
    this.panel = h('div', { class: 'batch', role: 'status' }, h('div', { class: 'pbar' }, h('i')), h('span', { class: 'b-txt' }, 'Preparing…'));
    document.body.appendChild(this.panel);
  },
  update(text) {
    if (!this.panel) return;
    this.panel.querySelector('.pbar i').style.width = Math.round(this.done / Math.max(1, this.total) * 100) + '%';
    this.panel.querySelector('.b-txt').textContent = text || `Processing photo ${Math.min(this.done + 1, this.total)} of ${this.total}`;
  },
  matchByName(fileName) {
    const base = codeKey(String(fileName).replace(/\.[a-z0-9]+$/i, ''));
    if (!base) return null;
    for (const p of App.products) {
      if ((p.imageName && codeKey(String(p.imageName).replace(/\.[a-z0-9]+$/i, '')) === base) || (p.f.code && codeKey(p.f.code) === base)) return (!p.img || !p.img.out) ? p : null;
    }
    return null;
  },
  async run() {
    this.running = true; await Wake.on();
    while (this.queue.length) {
      const file = this.queue.shift();
      this.update();
      try {
        const r = await PIPE.autoProcess(file, App.S);
        const match = this.matchByName(file.name);
        const p = match || App.newProduct();
        p.edit = r.edit; p.autoParams = r.autoParams; p.q = r.quality;
        p.review = !!(r.review || r.quality.warnings.length);
        p.srcName = file.name;
        const stale = await PIPE.store(p, { srcBlob: r.srcBlob, srcW: r.srcW, srcH: r.srcH, mask: r.mask, out: r.out }, App.S.photo.keepSource);
        IMG.release(r.out);
        await PIPE.commit(p, stale);
      } catch (e) { this.failed++; LOG.add('error', 'Batch photo failed: ' + file.name, e && e.message); }
      this.done++;
      await yieldUI();
    }
    this.running = false; await Wake.off();
    const ok = this.done - this.failed;
    this.update(`Done: ${ok} added${this.failed ? `, ${this.failed} could not be opened` : ''}`);
    setTimeout(() => { if (!this.running && this.panel) { this.panel.remove(); this.panel = null; } }, 4000);
    UI.toast(`${ok} products added. Check the ones marked "Check cut-out".`, { icon: 'check', action: { label: 'Show', fn: () => { App.filter.status = 'review'; go('products'); } } });
    this.done = 0; this.total = 0; this.failed = 0;
  }
};

const BulkEdit = {
  open() {
    const ids = Array.from(App.selected);
    if (!ids.length) { UI.toast('Select products first'); return; }
    const inputs = {};
    const keys = App.S.fields.filter(f => f.key !== 'name').map(f => f.key).concat(['badge']);
    const body = h('div', { class: 'form' },
      h('p', { class: 'muted small' }, 'Only the boxes you fill in are changed. Leave a box empty to keep each product\'s own value.'),
      keys.map(k => {
        const f = App.S.fields.find(x => x.key === k) || { label: 'Badge (e.g. New, 10% off)' };
        const inp = h('input', { type: 'text', list: 'dl-' + k, inputmode: k === 'mrp' ? 'decimal' : undefined, autocomplete: 'off' });
        inputs[k] = inp;
        return UI.field(f.label, inp);
      }),
      UI.toggle('Clear the badge on these products', false, v => { inputs._clearBadge = v; }));
    UI.modal({ title: `Edit ${ids.length} products`, body, actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: async () => {
      const changes = {}; for (const k of keys) { const v = inputs[k].value.trim(); if (v) changes[k] = v; }
      if (!Object.keys(changes).length && !inputs._clearBadge) { UI.toast('Nothing to change'); return false; }
      const list = ids.map(id => App.byId.get(id)).filter(Boolean);
      for (const p of list) { Object.assign(p.f, changes); if (inputs._clearBadge) delete p.f.badge; p.updatedAt = Date.now(); }
      await DB.putMany('products', list); Sync.post({ t: 'products', ids: list.map(p => p.id) }); App.markSaved(); App.changed();
      UI.toast(`Updated ${list.length} products`); ProductsView.render(ProductsView.el);
    } }] });
  }
};

const CsvImport = {
  async run(file) {
    const files = file instanceof Blob ? [file] : await UI.pickFiles({ accept: '.csv,.tsv,.txt,text/csv,text/plain' });
    if (!files[0]) return;
    if (/\.xlsx?$/i.test(files[0].name)) { UI.toast('Save the Excel sheet as CSV first (File → Save as → CSV)', { type: 'bad', ms: 7000 }); return; }
    let rows;
    try { rows = CSV.parse(await files[0].text()); } catch (e) { UI.toast('Could not read that file', { type: 'bad' }); return; }
    if (rows.length < 2) { UI.toast('The file has no product rows', { type: 'bad' }); return; }
    const headers = rows[0].map(x => String(x).trim()), data = rows.slice(1);
    const guess = CSV.guess(headers);
    const targets = [['name', 'Name'], ['brand', 'Brand'], ['size', 'Size'], ['mrp', 'MRP'], ['product', 'Product'], ['badge', 'Badge'], ['code', 'Code / SKU'], ['image', 'Photo file name']];
    const sels = {};
    const opt = (sel) => [h('option', { value: '-1' }, 'Not in file'), headers.map((hd, i) => h('option', { value: String(i), selected: sel === i }, hd || `Column ${i + 1}`))];
    const extras = Object.keys(guess).filter(k => k.startsWith('x:'));
    const extraOn = {};
    const preview = data.slice(0, 3).map(r => r.join(' | ')).join('\n');
    const body = h('div', { class: 'form' },
      h('p', { class: 'muted small' }, `${data.length} rows found. Match your columns:`),
      h('div', { class: 'map-grid' }, targets.map(([k, l]) => { const s = h('select', null, opt(guess[k])); sels[k] = s; return UI.field(l, s); })),
      extras.length ? h('div', null, h('p', { class: 'small' }, 'Other columns can become extra details on the page:'), extras.map(k => UI.toggle(k.slice(2), false, v => { extraOn[k] = v; }))) : null,
      h('details', null, h('summary', null, 'First rows'), h('pre', { class: 'pre' }, preview)),
      UI.toggle('Update products that already exist', true, v => { sels._update = v; }, 'Matches by code, or by brand + name + size'));
    sels._update = true;
    UI.modal({ title: 'Import product list', wide: true, body, actions: [{ label: 'Cancel' }, { label: `Import ${data.length}`, primary: true, onClick: async () => {
      const idx = {}; for (const [k] of targets) idx[k] = parseInt(sels[k].value, 10);
      if (idx.name < 0 && idx.product < 0 && idx.brand < 0) { UI.toast('Choose at least the Name column', { type: 'bad' }); return false; }
      // new custom fields
      const extraKeys = [];
      for (const k of extras) if (extraOn[k]) {
        const label = k.slice(2), ascii = normKey(label).slice(0, 20);
        const key = 'c_' + (ascii || 'f' + Array.from(label).map(ch => ch.codePointAt(0).toString(36)).join('').slice(0, 18));
        if (!App.S.fields.find(f => f.key === key)) App.S.fields.push({ key, label, on: true, showLabel: true, style: 'custom' });
        extraKeys.push([key, guess[k]]);
      }
      if (idx.code >= 0 && !App.S.fields.find(f => f.key === 'code')) App.S.fields.push({ key: 'code', label: 'Code', on: false, showLabel: true, style: 'custom' });
      App.saveSettings();
      // Match only against products that existed BEFORE this import, by code first, else by brand + name + size.
      // Keys keep Hindi and other scripts intact; a product without a name is never matched.
      const keyOf = p => (p.f.name ? [p.f.brand, p.f.name, p.f.size].map(matchKey).join('\u0001') : '');
      const existing = new Map(), byCode = new Map();
      for (const p of App.products) { const k = keyOf(p); if (k && !existing.has(k)) existing.set(k, p); if (p.f.code) byCode.set(codeKey(p.f.code), p); }
      const touched = new Set();
      let added = 0, updated = 0; const toSave = [];
      let order = App.products.reduce((m, p) => Math.max(m, p.order || 0), 0);
      for (const r of data) {
        const f = {};
        for (const [k] of targets) if (idx[k] >= 0 && k !== 'image') { const v = String(r[idx[k]] || '').trim(); if (v) f[k] = v; }
        for (const [key, col] of extraKeys) { const v = String(r[col] || '').trim(); if (v) f[key] = v; }
        if (!Object.keys(f).length) continue;
        let p = null;
        if (sels._update) { const k = keyOf({ f }); p = (f.code && byCode.get(codeKey(f.code))) || (k && existing.get(k)) || null; }
        if (p && touched.has(p.id)) p = null; // two rows in the file never collapse into one product
        if (p) { Object.assign(p.f, f); p.updatedAt = Date.now(); updated++; }
        else { p = App.newProduct(); p.order = ++order; p.f = f; added++; App.products.push(p); App.byId.set(p.id, p); }
        touched.add(p.id);
        if (idx.image >= 0 && r[idx.image]) p.imageName = String(r[idx.image]).trim();
        toSave.push(p);
      }
      await DB.putMany('products', toSave);
      Sync.post({ t: 'products', ids: toSave.map(p => p.id) });
      App.markSaved(); App.changed();
      UI.toast(`Imported: ${added} new, ${updated} updated. Add photos from the "No photo" filter.`, { icon: 'check', ms: 6000 });
      go('products');
    } }] });
  },
  exportCSV() {
    const fields = App.S.fields;
    const rows = [['id', ...fields.map(f => f.label), 'Badge', 'Status', 'Has photo']];
    for (const p of App.products.slice().sort((a, b) => a.order - b.order)) rows.push([p.id, ...fields.map(f => p.f[f.key] || ''), p.f.badge || '', STATUS_LABEL[App.status(p)], p.img && p.img.out ? 'yes' : 'no']);
    UI.download(new Blob([CSV.stringify(rows)], { type: 'text/csv;charset=utf-8' }), `products-${fileStamp()}.csv`);
    UI.toast('Product list downloaded');
  }
};

/* ---- 22-editor.js ---- */
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

/* ---- 23-catalogue.js ---- */
/* ===================== 23 · Catalogue builder: live preview, settings, export ===================== */
const CatalogueView = {
  L: null, el: null, io: null, renderGen: 0, lastExport: null,

  products() {
    const c = App.S.cat;
    const money = (p, dflt) => { const v = parseMoney(p.f.mrp); return v === null ? dflt : v; };
    let list = App.products.filter(p => !p.draft);
    if (c.include === 'ready') list = list.filter(p => App.status(p) === 'ready' || App.status(p) === 'nodetails');
    else if (c.include === 'photos') list = list.filter(p => p.img && p.img.out);
    else if (c.include === 'selected') list = list.filter(p => App.selected.has(p.id));
    if (c.brand) list = list.filter(p => (p.f.brand || '').trim().toLowerCase() === c.brand.toLowerCase());
    if (c.product) list = list.filter(p => (p.f.product || '').trim().toLowerCase() === c.product.toLowerCase());
    const by = {
      manual: (a, b) => (a.order || 0) - (b.order || 0),
      name: (a, b) => (a.f.name || '').localeCompare(b.f.name || ''),
      brand: (a, b) => (a.f.brand || '').localeCompare(b.f.brand || '') || (a.f.name || '').localeCompare(b.f.name || ''),
      mrpAsc: (a, b) => money(a, 1e12) - money(b, 1e12),
      mrpDesc: (a, b) => money(b, -1) - money(a, -1),
      newest: (a, b) => b.createdAt - a.createdAt
    }[c.sortBy] || ((a, b) => (a.order || 0) - (b.order || 0));
    return list.slice().sort(by);
  },
  groups(list) {
    const c = App.S.cat;
    if (c.groupBy !== 'brand' && c.groupBy !== 'product') return [{ name: null, items: list }];
    const m = new Map();
    for (const p of list) { const raw = (p.f[c.groupBy] || '').trim(); const k = raw.toLowerCase() || '~'; if (!m.has(k)) m.set(k, { name: raw || 'Other', items: [] }); m.get(k).items.push(p); }
    return Array.from(m.entries()).sort((a, b) => a[0] === '~' ? 1 : b[0] === '~' ? -1 : a[1].name.localeCompare(b[1].name)).map(e => e[1]);
  },
  build() {
    const list = this.products();
    const logo = App.logo ? { w: App.logo.w, h: App.logo.h } : null;
    const S = this.exportSettings();
    this.L = list.length ? LAYOUT.build(this.groups(list), S, logo) : null;
    this.count = list.length;
    return this.L;
  },
  exportSettings() { const S = App.S; return { cat: S.cat, biz: S.biz, fields: S.fields }; },

  render(main) {
    this.el = main;
    const c = App.S.cat;
    const set = (k, v, rebuild = true) => { c[k] = v; App.saveSettings(); if (rebuild) this.refresh(); };
    const t0 = performance.now();
    this.build();
    const empty = !this.L;
    const head = h('header', { class: 'top' },
      h('div', { class: 'top-row' }, h('span', { class: 'top-mark' }, icon('book')),
        h('div', { class: 'top-title' }, h('h1', null, 'Catalogue'), h('span', { class: 'muted small', id: 'cat-sum' })),
        h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => go('settings') }, icon('gear'))));
    const preview = h('section', { class: 'pv' },
      h('div', { class: 'pv-strip', id: 'pv-strip', tabindex: '0', 'aria-label': 'Page preview' }),
      h('div', { class: 'pv-foot' }, h('span', { id: 'pv-pos', class: 'small muted' }), h('label', { class: 'small linkish-label' }, h('input', { type: 'checkbox', onchange: e => { this.showLinks = e.target.checked; this.paintAll(); } }), ' Show tap areas')),
      h('p', { class: 'small excl', id: 'excl' }));

    const perPage = h('div', { class: 'perpage', role: 'radiogroup', 'aria-label': 'Products per page' },
      Array.from({ length: 10 }, (_, i) => i + 1).map(n => h('button', { class: 'pp' + (c.perPage === n ? ' on' : ''), role: 'radio', 'aria-checked': String(c.perPage === n), onclick: (e) => { $$('.pp', perPage).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); set('perPage', n); } }, this.gridGlyph(n), h('b', null, String(n)))));

    const themes = h('div', { class: 'swatches' }, Object.entries(THEMES).map(([k, t]) => h('button', { class: 'sw' + (c.theme === k ? ' on' : ''), title: t.name, onclick: (e) => { $$('.sw', themes).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); c.accent = ''; set('theme', k); const ac = $('#accent'); if (ac) ac.value = (THEMES[k].accent); } },
      h('span', { class: 'sw-page', style: { background: t.page, borderColor: t.dark ? t.page : '#0002' } }, h('i', { style: { background: t.accent } }), h('em', { style: { background: t.card } })), h('small', null, t.name))));

    const brands = App.brands(), prods = App.values('product');
    const panels = [
      h('section', { class: 'panel' },
        h('h3', null, 'Products per page'), perPage,
        h('h3', null, 'Style'), themes,
        h('div', { class: 'row2' },
          UI.field('Accent colour', h('input', { type: 'color', id: 'accent', value: c.accent || (THEMES[c.theme] || THEMES.classic).accent, onchange: e => set('accent', e.target.value) })),
          UI.field('Headings', UI.seg([{ value: 'sans', label: 'Modern' }, { value: 'serif', label: 'Elegant' }], c.font, v => set('font', v)))),
        UI.field('Catalogue title', h('input', { type: 'text', value: c.title, maxlength: 80, oninput: e => set('title', e.target.value) })),
        UI.field('Subtitle', h('input', { type: 'text', value: c.subtitle, placeholder: 'e.g. Festive collection 2026', maxlength: 120, oninput: e => set('subtitle', e.target.value) })),
        h('div', { class: 'row2' },
          UI.field('Prepared for (optional)', h('input', { type: 'text', value: c.forWho || '', placeholder: 'Customer or shop name', maxlength: 80, autocomplete: 'off', oninput: e => set('forWho', e.target.value) }), 'Shown on the cover and in the file name. Clear it before making the next customer\'s catalogue.'),
          UI.field('Prices valid until (optional)', h('input', { type: 'date', value: c.validTill || '', onchange: e => set('validTill', e.target.value) }), 'Printed on the cover and at the foot of every page.'))),
      h('details', { class: 'panel', open: c.include === 'selected' || undefined },
        h('summary', null, h('h3', null, 'Which products'), h('span', { class: 'small muted', id: 'which-sum' })),
        UI.field('Include', h('select', { onchange: e => set('include', e.target.value) },
          [['ready', 'Checked products with a photo'], ['photos', 'All products with a photo'], ['all', 'Everything, including no photo'], ['selected', `Only selected (${App.selected.size})`]].map(([v, l]) => h('option', { value: v, selected: c.include === v }, l)))),
        h('div', { class: 'row2' },
          UI.field('Brand', h('select', { onchange: e => set('brand', e.target.value) }, h('option', { value: '' }, 'All brands'), brands.map(b => h('option', { value: b, selected: c.brand === b }, b)))),
          UI.field('Product', h('select', { onchange: e => set('product', e.target.value) }, h('option', { value: '' }, 'All products'), prods.map(b => h('option', { value: b, selected: c.product === b }, b))))),
        h('div', { class: 'row2' },
          UI.field('Order', h('select', { onchange: e => set('sortBy', e.target.value) }, [['manual', 'As added'], ['brand', 'Brand, then name'], ['name', 'Name A–Z'], ['mrpAsc', 'MRP low to high'], ['mrpDesc', 'MRP high to low'], ['newest', 'Newest first']].map(([v, l]) => h('option', { value: v, selected: c.sortBy === v }, l)))),
          UI.field('Sections', h('select', { onchange: e => set('groupBy', e.target.value) }, [['none', 'No sections'], ['brand', 'One per brand'], ['product', 'One per product type']].map(([v, l]) => h('option', { value: v, selected: c.groupBy === v }, l)))))),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'Pages')),
        h('div', { class: 'row2' },
          UI.field('Paper', h('select', { onchange: e => set('page', e.target.value) }, ['A4', 'Letter', 'A5'].map(v => h('option', { value: v, selected: c.page === v }, v)))),
          UI.field('Direction', UI.seg([{ value: 'portrait', label: 'Upright' }, { value: 'landscape', label: 'Sideways' }], c.orient, v => set('orient', v)))),
        UI.field('Product card', UI.seg([{ value: 'soft', label: 'Soft' }, { value: 'outline', label: 'Outline' }, { value: 'minimal', label: 'None' }], c.card, v => set('card', v))),
        UI.toggle('Cover page', c.cover, v => set('cover', v), 'Logo, title, contact details and a WhatsApp QR code'),
        UI.toggle('Section pages', c.dividers, v => set('dividers', v), 'A title page before each brand or type'),
        UI.toggle('Contents page', c.contents, v => set('contents', v), 'Lists sections with page numbers'),
        UI.toggle('Index at the end', c.index, v => set('index', v), 'Every product A–Z with its page number'),
        UI.toggle('Soft shadow under products', c.shadow, v => set('shadow', v)),
        UI.toggle('Badges (New, Offer…)', c.badges, v => set('badges', v)),
        UI.toggle('Compact text', c.compact, v => set('compact', v), 'Puts size and type on one line. On automatically at 7+ per page'),
        UI.toggle('Page numbers', c.pageNo, v => set('pageNo', v)),
        UI.toggle('Shop contact in the footer', c.footContact, v => set('footContact', v)),
        UI.field('Note under every page', h('input', { type: 'text', value: c.note, maxlength: 140, oninput: e => set('note', e.target.value) }))),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'WhatsApp enquiries')),
        App.S.biz.whatsapp ? null : h('p', { class: 'warnline' }, icon('info'), 'Add your WhatsApp number in Settings to turn these on.'),
        UI.toggle('Tap a product to enquire', c.waLinks, v => set('waLinks', v), 'Opens WhatsApp with the product name and MRP filled in'),
        UI.toggle('QR code on the cover', c.qr, v => set('qr', v)),
        UI.field('Enquiry message', h('textarea', { rows: 2, placeholder: 'Hi{biz}! I am interested in {item}. Please share details.', oninput: e => set('waMsg', e.target.value) }, c.waMsg || ''), '{item} becomes the product name, size and MRP. {biz} becomes your shop name.')),
      h('details', { class: 'panel' },
        h('summary', null, h('h3', null, 'File')),
        UI.field('Quality', h('select', { onchange: e => set('quality', e.target.value) }, Object.entries(RENDER.QUALITY).map(([k, q]) => h('option', { value: k, selected: c.quality === k }, q.label)))),
        UI.field('Split into files of', h('select', { onchange: e => set('split', +e.target.value) }, [[0, 'One file'], [100, '100 products each'], [250, '250 products each'], [500, '500 products each'], [1000, '1,000 products each']].map(([v, l]) => h('option', { value: String(v), selected: +c.split === v }, l))), 'Big catalogues are easier to send and open in parts.'),
        h('p', { class: 'small muted', id: 'size-est' }))
    ];
    const cta = h('div', { class: 'cta' },
      h('button', { class: 'btn primary big', disabled: empty, onclick: () => this.exportPDF() }, icon('file'), 'Create PDF'),
      h('button', { class: 'btn ghost', disabled: empty, onclick: () => this.exportImages() }, icon('image'), 'Pages as images'),
      this.lastExport ? h('button', { class: 'btn ghost', onclick: () => this.showResult(this.lastExport) }, icon('share'), 'Last PDF') : null);
    clear(main).append(head,
      empty ? h('div', { class: 'empty-cat' }, h('p', null, App.products.length ? 'No products match these choices. Change "Which products" below.' : 'Add products first. Each one becomes a card on the page.'), App.products.length ? null : h('button', { class: 'btn primary', onclick: () => Add.sheet() }, icon('camera'), 'Add products')) : preview,
      h('div', { class: 'cat-panels' }, panels), cta);
    this.afterBuild();
    LOG.add('info', 'catalogue view ' + Math.round(performance.now() - t0) + 'ms');
  },
  gridGlyph(n) {
    const g = LAYOUT.grid(n, 535, 730, 10, s => s * 3.6);
    const W = 26, H = 34, gap = 2, rows = g.rows, cols = g.cols;
    const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
    let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    g.rowCounts.forEach((cnt, r) => { const rowW = cnt * cw + (cnt - 1) * gap, x0 = (W - rowW) / 2; for (let c = 0; c < cnt; c++) svg += `<rect x="${(x0 + c * (cw + gap)).toFixed(1)}" y="${(r * (ch + gap)).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="1.2"/>`; });
    const s = h('span', { class: 'pp-glyph' }); s.innerHTML = svg + '</svg>'; return s;
  },
  refresh: debounce(function () { const self = CatalogueView; if (App.view !== 'catalogue') return; const wasEmpty = !self.L; self.build(); if (!self.L !== wasEmpty || !$('#pv-strip')) { self.render(self.el); return; } self.afterBuild(); }, 220),
  afterBuild() {
    const L = this.L, sum = $('#cat-sum');
    if (sum) sum.textContent = L ? `${this.count} products, ${L.pages.length} pages` : 'No products yet';
    const ws = $('#which-sum'); if (ws) ws.textContent = L ? `${this.count} included` : '';
    const est = $('#size-est'); if (est && L) est.textContent = 'Estimated size: about ' + bytesFmt(this.estimate(L)) + (App.S.cat.split ? `, split into ${Math.ceil(this.count / App.S.cat.split)} files` : '');
    const ex = $('#excl');
    if (ex) {
      const c = App.S.cat; let review = 0, nophoto = 0, drafts = 0;
      for (const p of App.products) { if (p.draft) { drafts++; continue; } const st = App.status(p); if (st === 'review' && c.include === 'ready') review++; else if (st === 'nophoto' && c.include !== 'all') nophoto++; }
      const bits = [review ? `${review} flagged "Check cut-out"` : '', nophoto ? `${nophoto} without a photo` : '', drafts ? `${drafts} unfinished` : ''].filter(Boolean);
      clear(ex);
      if (bits.length && c.include !== 'selected') ex.append('Not included: ' + bits.join(', ') + '. ', h('button', { class: 'linkish small', onclick: () => { App.filter.status = review ? 'review' : nophoto ? 'nophoto' : 'review'; go('products'); } }, 'Show them'));
    }
    const strip = $('#pv-strip'); if (!strip || !L) return;
    const gen = ++this.renderGen;
    if (this.io) this.io.disconnect();
    clear(strip);
    const slots = L.pages.map((pg, i) => { const s = h('div', { class: 'pv-page', dataset: { i: String(i) }, style: { aspectRatio: pg.w + ' / ' + pg.h } }, h('span', { class: 'pv-no' }, String(i + 1))); strip.appendChild(s); return s; });
    this.io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; this.paintSlot(en.target, gen); }
        else if (!en.isIntersecting && en.target.dataset.done) { const cv = en.target.querySelector('canvas'); if (cv) { IMG.release(cv); cv.remove(); } delete en.target.dataset.done; }
      }
      const vis = entries.filter(e => e.isIntersecting).map(e => +e.target.dataset.i);
      if (vis.length) { const pos = $('#pv-pos'); if (pos) pos.textContent = `Page ${Math.min(...vis) + 1} of ${L.pages.length}`; }
    }, { root: strip, rootMargin: '0px 300px', threshold: 0.01 });
    slots.forEach(s => this.io.observe(s));
    const pos = $('#pv-pos'); if (pos) pos.textContent = `Page 1 of ${L.pages.length}`;
  },
  paintAll() { $$('.pv-page').forEach(s => { delete s.dataset.done; if (s.querySelector('canvas')) this.paintSlot(s, this.renderGen); }); },
  async paintSlot(slot, gen) {
    const L = this.L; if (!L) return;
    const pg = L.pages[+slot.dataset.i]; if (!pg) return;
    const w = slot.clientWidth || 220, dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = h('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(w * pg.h / pg.w * dpr);
    await RENDER.drawPage(c.getContext('2d'), pg, c.width / pg.w, async (src, pw) => src === 'logo' ? (App.logo && App.logo.bmp) : App.productBitmap(src.id, pw), { showLinks: this.showLinks });
    if (gen !== this.renderGen) return;
    const old = slot.querySelector('canvas'); if (old) old.remove();
    slot.appendChild(c);
  },
  estimate(L) {
    const Q = RENDER.QUALITY[App.S.cat.quality] || RENDER.QUALITY.standard;
    const bpp = Q.q <= 0.72 ? 0.085 : Q.q <= 0.8 ? 0.12 : 0.2;
    let bytes = 90000 + (App.logo ? 60000 : 0); const seen = new Set();
    for (const pg of L.pages) { bytes += 2500; for (const op of pg.ops) if (op.t === 'img' && op.src !== 'logo') { const key = op.src.id + Math.round(op.w); if (seen.has(key)) continue; seen.add(key); const px = (op.w / 72 * Q.dpi) * (op.h / 72 * Q.dpi); bytes += px * bpp + px * 0.03; } }
    return bytes;
  },
  async drawable(src, w, h) {
    if (src === 'logo') return App.logo && App.logo.bmp;
    const p = App.byId.get(src.id); if (!p || !p.img || !p.img.out) return null;
    const blob = await DB.getBlob(p.img.out); if (!blob) return null;
    const ow = p.img.ow || w, oh = p.img.oh || h;
    if (w && h && window.createImageBitmap && (w < ow * 0.9)) {
      try { return await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(w)), resizeHeight: Math.max(1, Math.round(oh * w / ow)), resizeQuality: 'high' }); } catch (e) { }
    }
    return IMG.decode(blob);
  },
  async checkBeforeExport() {
    const S = App.S;
    if (!S.biz.name && !App.logo) {
      const ok = await UI.confirm('No shop name or logo yet', 'Pages look more professional with your logo at the top. You can add it in Settings in a minute.', 'Create anyway');
      if (!ok) { go('settings'); return false; }
    }
    return true;
  },
  async exportPDF() {
    App.saveSettings.flush();
    this.build(); if (!this.L) { UI.toast('No products to include'); return; }
    if (!(await this.checkBeforeExport())) return;
    this.build();
    const L = this.L, S = this.exportSettings();
    const prog = UI.progress('Creating PDF', true);
    await Wake.on();
    const t0 = performance.now();
    try {
      const parts = await RENDER.exportPDF(L, S, (src, w, h) => this.drawable(src, w, h), (d, n, pi, np) => prog.set(d / n, `Page ${d} of ${n}` + (np > 1 ? ` (file ${pi + 1} of ${np})` : '')), () => prog.cancelled);
      prog.close();
      const res = { parts, pages: L.pages.length, products: this.count, ms: performance.now() - t0, at: Date.now() };
      this.lastExport = res;
      this.showResult(res);
    } catch (e) {
      prog.close();
      if (e.message === 'Cancelled') UI.toast('Stopped');
      else { LOG.add('error', 'PDF failed', e && e.stack); UI.toast('Could not create the PDF: ' + (e.message || e) + '. Try "Small" quality or split into files.', { type: 'bad', ms: 9000 }); }
    } finally { await Wake.off(); }
  },
  showResult(res) {
    const total = res.parts.reduce((a, p) => a + p.blob.size, 0);
    const shareAll = async () => {
      const r = await UI.share(res.parts.map(p => p.file), App.S.cat.title, App.S.biz.name ? `${App.S.cat.title} from ${App.S.biz.name}` : App.S.cat.title);
      if (r === 'unsupported') { UI.toast('Sharing files is not supported in this browser. Downloading instead.'); res.parts.forEach(p => UI.download(p.blob, p.name)); }
    };
    const body = h('div', { class: 'result' },
      h('div', { class: 'res-head' }, h('span', { class: 'res-ic' }, icon('check')), h('div', null, h('b', null, res.parts.length > 1 ? `${res.parts.length} PDF files ready` : 'Your PDF is ready'), h('p', { class: 'small muted' }, `${res.products} products, ${res.pages} pages, ${bytesFmt(total)}`))),
      res.parts.map(p => h('div', { class: 'res-file' }, icon('file'), h('div', { class: 'rf-name' }, h('span', null, p.name), h('small', { class: 'muted' }, bytesFmt(p.blob.size))),
        h('button', { class: 'icon-btn', 'aria-label': 'Download ' + p.name, onclick: () => UI.download(p.blob, p.name) }, icon('download')),
        h('button', { class: 'icon-btn', 'aria-label': 'Open ' + p.name, onclick: () => UI.open(p.blob) }, icon('eye')))),
      ENV.isIOS ? h('p', { class: 'small muted' }, 'On iPhone: Share → Save to Files keeps a copy, or pick WhatsApp to send it.') : null,
      total > 60 * 1048576 ? h('p', { class: 'warnline' }, icon('alert'), 'This is a large file. For WhatsApp, use "Small" quality or split into files.') : null);
    UI.modal({ title: 'PDF created', body, actions: [
      { label: 'Download', icon: 'download', onClick: () => { res.parts.forEach(p => UI.download(p.blob, p.name)); return false; } },
      { label: ENV.canShareFiles ? 'Share' : 'Open', icon: ENV.canShareFiles ? 'share' : 'eye', primary: true, onClick: async () => { if (ENV.canShareFiles) await shareAll(); else UI.open(res.parts[0].blob); return false; } }
    ] });
  },
  async exportImages() {
    App.saveSettings.flush();
    this.build(); if (!this.L) return;
    const L = this.L;
    const prog = UI.progress('Saving pages as images', true);
    await Wake.on();
    try {
      const files = await RENDER.exportImages(L, (src, w, h) => this.drawable(src, w, h), 1240, (d, n) => { if (prog.cancelled) throw new Error('Cancelled'); prog.set(d / n, `Page ${d} of ${n}`); });
      prog.close();
      const zipIt = async () => { if (files.length === 1) { UI.download(files[0], files[0].name); return; } const zip = await ZIP.write(files.map(f => ({ name: f.name, data: f }))); UI.download(zip, safeFileName(App.S.cat.title) + '-pages.zip'); UI.toast(`${files.length} page images saved in one zip file`); };
      // sharing needs a fresh tap, so offer it as a button rather than calling it after the long render
      UI.modal({ title: 'Page images ready', body: h('p', null, `${files.length} image${files.length === 1 ? '' : 's'}, 1240 pixels wide. Share them to WhatsApp Status or a chat, or save them.`),
        actions: [{ label: files.length === 1 ? 'Download' : 'Download zip', icon: 'download', onClick: () => { zipIt(); return false; } },
          ENV.canShareFiles && files.length <= 30 ? { label: 'Share', icon: 'share', primary: true, onClick: async () => { const r = await UI.share(files, App.S.cat.title); if (r === 'unsupported') zipIt(); return false; } } : { label: 'Done', primary: true }] });
    } catch (e) { prog.close(); if (e.message !== 'Cancelled') UI.toast('Could not save images: ' + e.message, { type: 'bad' }); }
    finally { await Wake.off(); }
  }
};

/* ---- 24-settings.js ---- */
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
        UI.field('AI download', UI.seg([{ value: 'fast', label: `Fast, about ${AI.MB.fast} MB` }, { value: 'best', label: `Best, about ${AI.MB.best} MB` }], S.photo.aiQuality, v => { S.photo.aiQuality = v; save(); })),
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
          h('button', { class: 'hl', onclick: () => Help.diagnostics() }, icon('info'), 'Diagnostics'),
          (typeof SITE !== 'undefined' && SITE.repo) ? h('a', { class: 'hl', href: SITE.repo, target: '_blank', rel: 'noopener' }, icon('file'), `Source code and licences · version ${APP.version}`) : null),
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
  async restore(file) {
    const f = file instanceof Blob ? file : (await UI.pickFiles({ accept: '.zip,application/zip,application/x-zip-compressed' }))[0];
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
    ], Install.prompt ? h('button', { class: 'btn primary', onclick: () => Install.run() }, 'Install now') : null);
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
    const info = [`${APP.name} ${APP.version}`, navigator.userAgent, `Protocol: ${location.protocol}`, `Saving: ${App.persistentOK ? 'yes' : 'NO (memory only)'}`, `Products: ${App.products.length}`, `Share files: ${ENV.canShareFiles}`, `Compression: ${ENV.compression}`, `WebP: ${IMG.supportsWebP}`, `AI: ${AI.describe()}`, `Isolated (multi-core): ${window.crossOriginIsolated === true}`, `App mode: ${ENV.standalone ? 'installed app' : 'browser tab'}`, '', LOG.text()].join('\n');
    UI.modal({ title: 'Diagnostics', wide: true, body: h('pre', { class: 'pre' }, info), actions: [{ label: 'Copy', primary: true, onClick: async () => { try { await navigator.clipboard.writeText(info); UI.toast('Copied'); } catch (e) { UI.toast('Select the text and copy it'); } return false; } }, { label: 'Close' }] });
  }
};

/* ---- 25-boot.js ---- */
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

/* ---------- installing the app on a phone ---------- */
const Install = {
  prompt: null,
  init() {
    // listen from the very start: the browser can offer installing before the app has finished loading
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; App.deferredInstall = e; this.refresh(); });
    window.addEventListener('appinstalled', () => { this.prompt = null; App.deferredInstall = null; if (App.S) UI.toast('Installed. Open the app from your home screen from now on.', { icon: 'check', ms: 6000 }); this.refresh(); });
  },
  refresh() { if (App.S && App.view === 'products' && !Editor.st && $('#main')) ProductsView.render($('#main')); },
  /** Worth offering: not already installed, served from the website, and the phone can install it. */
  can() { return !ENV.standalone && location.protocol === 'https:' && (!!this.prompt || ENV.isIOS); },
  async run() {
    if (!this.prompt) { Help.install(); return; }
    const p = this.prompt; this.prompt = null; App.deferredInstall = null;
    try { p.prompt(); await p.userChoice; } catch (e) { LOG.add('warn', 'install prompt failed', e && e.message); }
    this.refresh();
  }
};
Install.init();

/* ---------- offline support and update notice (service worker from the website) ---------- */
function startServiceWorker() {
  // only the website build has a service worker (the single-file copy works without one)
  if (typeof SITE === 'undefined' || SITE.build !== 'site') return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let told = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version took over: tell the user, let them reload when it suits them
    if (!hadController || told) return;
    told = true;
    UI.toast('A new version of the app is ready.', { icon: 'zap', ms: 15 * 60e3, action: { label: 'Reload', fn: () => location.reload() } });
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    LOG.add('info', 'offline support on');
    let last = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60e3) { last = Date.now(); reg.update().catch(() => { }); }
    });
  }).catch(() => { /* no sw.js next to the page (single-file copy): fine */ });
}

/* ---------- links that open the app: shortcuts (?action=) and shared files (?share=) ---------- */
function handleLaunch() {
  const q = new URLSearchParams(location.search);
  const share = q.get('share'), action = q.get('action');
  if ([...q.keys()].length) history.replaceState(history.state, '', location.pathname + location.hash);
  if (share) {
    Inbox.take(share).then(files => {
      if (files.length) Add.receive(files);
      else UI.toast('Nothing arrived from the other app. Try sharing again.', { type: 'bad' });
    }).catch(e => { LOG.add('error', 'shared files could not be read', e && e.message); UI.toast('Could not read the shared files.', { type: 'bad' }); });
  } else if (action === 'add') Add.sheet();
  else if (action === 'catalogue') go('catalogue');
}

/* ---------- drop photos, a CSV list or a backup onto the window (computers) ---------- */
function enableDrop() {
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
  document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length || Editor.st || !Presence.active) return;
    Add.receive(files);
  });
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
  Presence.init();
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
  enableDrop();
  go('products');
  handleLaunch();
  if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 400); }
  // protect data once there is something worth protecting
  if (App.products.length) DB.askPersist();
  const est = await DB.estimate(); if (est && est.quota && est.usage / est.quota > 0.85) { Banners.storageLow = true; }
  // single-file copy only: an inline manifest so "Add to Home screen" gets a name and icon
  // (the website build links a real manifest.webmanifest and icons instead)
  if ($('#manifest')) try {
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
  startServiceWorker();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
