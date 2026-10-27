/* ===================== 00 · Utilities ===================== */
'use strict';
const APP = { name: 'Catalogue Maker', version: '2.0.0', build: '2026-10-27' };

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
function safeFileName(s) {
  return String(s || 'catalogue').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'catalogue';
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
