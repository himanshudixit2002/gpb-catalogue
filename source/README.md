# Catalogue Maker – source code

The app is one HTML file built from the pieces in this folder.

## Rebuild the app
    python3 build.py
This writes `build/catalogue-maker.html`. No other software is needed.
To publish it, copy that file over `../public/index.html` and run `../deploy.sh`
(or run `../deploy.sh build/catalogue-maker.html`, which does both).

## What is where
- `src/index.html`, `src/style.css` – page shell and styles
- `src/00-…11-*.js` – engine: storage, fonts, PDF writer, photo processing,
  4-corner straightening, background removal, page layout, ZIP/CSV, QR codes
- `src/20-…25-*.js` – the app screens: products, photo editor, catalogue, settings
- `fonts/` – Poppins and Lora (SIL Open Font License 1.1), trimmed to Latin and ₹
- `sw.js` – optional offline support, served next to the app
- `test/` – browser tests (need Node and Playwright: `npm i playwright`)

The optional AI cut-out loads @imgly/background-removal from a CDN at run time.
That library is AGPL-licensed; check its licence terms for your use.
