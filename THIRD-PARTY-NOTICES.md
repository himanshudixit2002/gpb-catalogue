# Third-party software and fonts

The app's own code is in `src/`, `site/`, `scripts/` and `build.py`. It also uses the
components below. Their licences travel with them.

| Component | Used for | Licence | Where |
|---|---|---|---|
| Poppins (The Poppins Project Authors) | Headings and text in the app and in PDFs | SIL Open Font License 1.1 | `fonts/poppins-*.ttf`, licence in `fonts/OFL-Poppins.txt` |
| Lora (The Lora Project Authors) | "Elegant" headings in PDFs | SIL Open Font License 1.1 | `fonts/lora-*.ttf`, licence in `fonts/OFL-Lora.txt` |
| @imgly/background-removal 1.7.0 (IMG.LY GmbH) | Optional AI cut-out | GNU AGPL 3.0 | fetched by `npm run vendor` into `vendor/imgly/1.7.0/`, licence in `LICENSE.md` there |
| @imgly/background-removal-data 1.7.0 (IMG.LY GmbH) | AI engine and model files | see `ThirdPartyLicenses.json` | `vendor/imgly/1.7.0/data/` |
| onnxruntime-web 1.21.0 (Microsoft) | Runs the AI model | MIT | bundled into `background-removal.mjs` |
| zod, lodash-es, ndarray | Used inside the AI library | MIT | bundled into `background-removal.mjs` |

The fonts are trimmed to the Latin letters and the ₹ sign so the app stays small.

**About the AGPL:** the AI library's licence asks that people who use the app over the
network can get its source code. This repository is public and contains everything
needed to rebuild the app, including the script that fetches the exact library version,
and the app links to it under Settings → Help. For other licensing options, IMG.LY can
be contacted at support@img.ly. This is general information, not legal advice.
