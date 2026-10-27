/* AI cut-out, run off the main thread so the screen stays responsive.
   Served from the same folder as the self-hosted library (vendor/imgly/<version>/).
   Messages in:  { id, w, h, rgba: ArrayBuffer, model, publicPath }
   Messages out: { ready, isolated, threads } once, then per job
                 { id, progress: { key, cur, total } } … { id, alpha: Uint8Array } | { id, error } */
import { segmentForeground } from './background-removal.mjs';

self.onmessage = async (e) => {
  const { id, w, h, rgba, model, publicPath } = e.data || {};
  if (!id) return;
  const progress = (key, cur, total) => self.postMessage({ id, progress: { key, cur, total } });
  try {
    // raw pixels in and out: no JPEG/PNG encoding on either side
    const input = new Blob([rgba], { type: `image/x-rgba8;width=${w};height=${h}` });
    const out = await segmentForeground(input, { publicPath, model, output: { format: 'image/x-rgba8' }, progress });
    const px = new Uint8Array(await out.arrayBuffer());
    const n = w * h, alpha = new Uint8Array(n);
    if (px.length < n * 4) throw new Error(`AI returned ${px.length} bytes for a ${w}×${h} photo`);
    for (let i = 0; i < n; i++) alpha[i] = px[i * 4 + 3];
    self.postMessage({ id, alpha }, [alpha.buffer]);
  } catch (err) {
    self.postMessage({ id, error: (err && err.message) || String(err) });
  }
};

self.postMessage({ ready: true, isolated: self.crossOriginIsolated === true, threads: self.navigator.hardwareConcurrency || 1 });
