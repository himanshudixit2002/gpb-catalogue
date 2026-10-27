window.runTest = async function () {
  const cases = [];
  const enc = new TextEncoder();
  const mk = (name, u8) => { const z = Deflate.zlib(u8); let s = ''; for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000)); let o = ''; for (let i = 0; i < u8.length; i += 0x8000) o += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); cases.push({ name, n: u8.length, z: z.length, zb64: btoa(s), ob64: btoa(o) }); };
  mk('empty', new Uint8Array(0));
  mk('one', new Uint8Array([65]));
  mk('text', enc.encode('BT /F1 12 Tf 1 0 0 1 72 720 Tm [<0012003A> -40 <0045>] TJ ET\n'.repeat(300)));
  const r = new Uint8Array(70000); for (let i = 0; i < r.length; i++) r[i] = (Math.random() * 256) | 0; mk('random', r);
  const a = new Uint8Array(600 * 600); for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) a[y * 600 + x] = Math.hypot(x - 300, y - 300) < 200 ? 255 : Math.hypot(x - 300, y - 300) < 204 ? 128 : 0; mk('alpha', a);
  const runs = new Uint8Array(100000); for (let i = 0; i < runs.length; i++) runs[i] = (i >> 9) & 1 ? 7 : (i % 251); mk('mixed', runs);
  return { cases };
};
