# GPB Catalogue

Live app: https://gpb-catalogue.web.app
Firebase project: `gpb-catalogue` (console: https://console.firebase.google.com/project/gpb-catalogue/hosting)

## What is in this folder
- `public/index.html` – the whole app, in one file
- `public/sw.js` – lets the app open without internet after the first visit
- `firebase.json` – hosting settings:
  - `no-cache`, so phones pick up a new version the next time they open the app
  - basic security headers
  - the old file name `/catalogue-maker.html` redirects to the home page
- `.firebaserc` – links this folder to the `gpb-catalogue` project
- `deploy.sh` – publishes the app
- `source/` – the app's source code (see `source/README.md`)

## Publish an update
Open Terminal in this folder, then run one of these:

    ./deploy.sh                                    # publish public/ as it is
    ./deploy.sh ~/Downloads/catalogue-maker.html   # use a new app file, then publish

## Good to know
- Products, photos and settings live on each phone, not in Firebase.
  Publishing an update never touches them.
- The project was created on Firebase's free Spark plan. Nothing is billed
  unless someone upgrades it to the Blaze plan.
- To use your own address (for example catalogue.gpbgroup.co.in), go to
  Firebase console → Hosting → Add custom domain. You will then add the DNS
  records it shows at your domain provider.
- Undo a bad update: Firebase console → Hosting → Release history → Roll back.
