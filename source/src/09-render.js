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
    const baseName = safeFileName([S.biz.name, S.cat.title].filter(Boolean).join(' ') || 'Catalogue') + '-' + fileStamp();
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
