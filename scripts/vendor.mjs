// Puts the AI cut-out files in vendor/imgly/<version>/ so the website serves them itself
// (no outside CDN). Run with `npm run vendor`; it does nothing if the files are already there.
//
//   background-removal.mjs   @imgly/background-removal + onnxruntime-web, bundled into one module
//   data/resources.json      index of the engine and model files
//   data/<sha256>            4 MB pieces: WebAssembly engine, Fast model (44 MB), Best model (88 MB)
//   LICENSE.md, ThirdPartyLicenses.json
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.devDependencies['@imgly/background-removal'];
const DATA_URL = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/package.tgz`;
const DATA_SHA256 = { '1.7.0': 'a44fdaf4f3b06a952dcd9a61720bac1e6bc41392aa474e68863a2e54ca2d0df5' }[VERSION];
const KEEP = ['/onnxruntime-web/ort-wasm-simd-threaded.wasm', '/onnxruntime-web/ort-wasm-simd-threaded.mjs', '/models/isnet_quint8', '/models/isnet_fp16'];
const OUT = path.join(ROOT, 'vendor', 'imgly', VERSION);
const CACHE = path.join(ROOT, '.cache');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function complete() {
  const res = path.join(OUT, 'data', 'resources.json');
  if (!fs.existsSync(path.join(OUT, 'background-removal.mjs')) || !fs.existsSync(res)) return false;
  const r = JSON.parse(fs.readFileSync(res, 'utf8'));
  return KEEP.every(k => r[k] && r[k].chunks.every(c => {
    const p = path.join(OUT, 'data', c.name);
    return fs.existsSync(p) && fs.statSync(p).size === c.offsets[1] - c.offsets[0];
  }));
}

if (complete() && !process.argv.includes('--force')) {
  console.log(`AI files ready in vendor/imgly/${VERSION}`);
  process.exit(0);
}

// 1. bundle the library (needs `npm ci` first)
const { build } = await import('esbuild');
const ortStandard = path.join(ROOT, 'node_modules', 'onnxruntime-web', 'dist', 'ort.min.mjs');
fs.mkdirSync(OUT, { recursive: true });
await build({
  stdin: { contents: "export { segmentForeground, removeBackground, preload } from '@imgly/background-removal';", resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'browser', target: ['es2020'], minify: true, legalComments: 'eof',
  outfile: path.join(OUT, 'background-removal.mjs'), logLevel: 'warning',
  plugins: [{
    name: 'ort-standard-build',
    setup(b) {
      // the standard build loads its WebAssembly glue and worker threads from data/, where the library points it
      b.onResolve({ filter: /^onnxruntime-web$/ }, () => ({ path: ortStandard }));
      b.onResolve({ filter: /^onnxruntime-web\/webgpu$/ }, () => ({ path: 'onnxruntime-web/webgpu', external: true })); // GPU build unused
    }
  }]
});
fs.copyFileSync(path.join(ROOT, 'node_modules', '@imgly', 'background-removal', 'LICENSE.md'), path.join(OUT, 'LICENSE.md'));
console.log('bundled background-removal.mjs', Math.round(fs.statSync(path.join(OUT, 'background-removal.mjs')).size / 1024), 'KB');

// 2. engine and model files (downloaded once into .cache/, checked against a known checksum)
fs.mkdirSync(CACHE, { recursive: true });
const tgz = path.join(CACHE, `imgly-data-${VERSION}.tgz`);
if (!fs.existsSync(tgz) || (DATA_SHA256 && sha256(fs.readFileSync(tgz)) !== DATA_SHA256)) {
  console.log('downloading', DATA_URL, '(about 285 MB, one time)…');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
}
const got = sha256(fs.readFileSync(tgz));
if (DATA_SHA256 && got !== DATA_SHA256) throw new Error(`checksum mismatch for ${tgz}: ${got}`);
const unpack = path.join(CACHE, `imgly-data-${VERSION}`);
fs.rmSync(unpack, { recursive: true, force: true }); fs.mkdirSync(unpack, { recursive: true });
execFileSync('tar', ['-xzf', tgz, '-C', unpack]);
const dist = path.join(unpack, 'package', 'dist');
const all = JSON.parse(fs.readFileSync(path.join(dist, 'resources.json'), 'utf8'));
const keep = {};
fs.rmSync(path.join(OUT, 'data'), { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
let bytes = 0;
for (const k of KEEP) {
  if (!all[k]) throw new Error('missing in data package: ' + k);
  keep[k] = all[k];
  for (const c of all[k].chunks) {
    const buf = fs.readFileSync(path.join(dist, c.name));
    if (sha256(buf) !== c.name) throw new Error('corrupt piece ' + c.name);
    fs.writeFileSync(path.join(OUT, 'data', c.name), buf); bytes += buf.length;
  }
}
fs.writeFileSync(path.join(OUT, 'data', 'resources.json'), JSON.stringify(keep, null, 1));
fs.copyFileSync(path.join(unpack, 'package', 'ThirdPartyLicenses.json'), path.join(OUT, 'ThirdPartyLicenses.json'));
fs.rmSync(unpack, { recursive: true, force: true });
console.log(`AI files ready in vendor/imgly/${VERSION}: ${Math.round(bytes / 1048576)} MB (engine, Fast and Best models)`);
