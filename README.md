# GPB Catalogue

Photograph a product, straighten it with four corners, remove the background, add the
details, and make a catalogue PDF to share on WhatsApp. Built for a sales team working
on their phones; 10,000+ products are fine.

**Live app:** https://gpb-catalogue.web.app

Everything runs on the phone. Products and photos are saved in the phone's browser and
never leave it until someone shares a PDF. The website serves every file the app needs,
including the AI cut-out, so nothing loads from other sites.

## What it does
- **Photos:** automatic corners, drag the 4 corners with a magnifier to straighten, Quick
  or AI background removal, erase/restore brush, auto colour, rotate.
- **Details:** Brand, Size, Name, MRP, Product (your order, your labels, extra fields), shown
  centred under the photo. Empty boxes are left out.
- **Catalogues:** 1 to 10 products per page, 7 themes, cover with logo and WhatsApp QR,
  sections, contents and index, A4/Letter/A5, "Prepared for" a customer and "Prices valid
  until", tap-to-enquire WhatsApp links, split files for big catalogues, page images.
- **Team:** Excel/CSV import, photos matched to products by code, backups that restore or
  merge on other phones, one working copy at a time across tabs.
- **App:** installs to the home screen, works offline, receives photos, product lists and
  backups shared from other apps (Android), shows a notice when a new version is published.

## Publish a new version
You need Python 3, Node.js and the Firebase CLI (`firebase login` once).

    ./deploy.sh preview    # build and publish to a temporary preview link to try first
    ./deploy.sh            # build and publish to the live site

The first run downloads the AI files (about 285 MB, once) into `vendor/`.
To undo a bad release: Firebase console → Hosting → Release history → Roll back.

## How it is put together
| Path | What it is |
|---|---|
| `src/` | The app: `00`–`11` engine (storage, fonts, PDF writer, photo processing, layout, ZIP/CSV, QR), `20`–`25` screens, `ai-worker.mjs` |
| `site/` | Website files: `site.json` (name, address), `sw.js` (offline, updates, sharing), icons, robots.txt |
| `build.py` | Builds the site into `public/` and a single-file copy into `build/` |
| `scripts/vendor.mjs` | Fetches and bundles the AI library and model files into `vendor/` |
| `public/` | What Firebase serves. `public/vendor/` is not in git (large AI files) |
| `test/` | Browser tests (`npm i -D playwright`, then `node test/e2e.js` and so on) |
| `firebase.json` | Hosting: security and cross-origin isolation headers, caching, redirects |

The AI cut-out runs in a background worker and uses several processor cores, because
the site sends the cross-origin isolation headers. Phones download the Fast model
(about 55 MB) or the Best one (about 100 MB) once, the first time they use it.

## Licences
See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The optional AI library is AGPL.
