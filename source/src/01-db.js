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
