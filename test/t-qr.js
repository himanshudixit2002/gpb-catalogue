window.runTest = async function () {
  const texts = ['https://wa.me/919876543210', 'https://wa.me/919876543210?text=' + encodeURIComponent('Hi Sharma Traders! I am interested in Prestige Svachh Deluxe (5 L) – MRP ₹2,499. Please share details.'), 'https://sharmatraders.in', 'HELLO'];
  const out = [];
  for (const t of texts) {
    const q = QR.encode(t);
    let rows = [];
    for (let y = 0; y < q.size; y++) { let r = ''; for (let x = 0; x < q.size; x++) r += q.get(x, y) ? '1' : '0'; rows.push(r); }
    out.push({ text: t, version: q.version, size: q.size, mask: q.mask, rows });
  }
  return { qr: out };
};
