#!/usr/bin/env bash
# Build the app and publish it on Firebase Hosting.
#
#   ./deploy.sh            build, then publish to the live site https://gpb-catalogue.web.app
#   ./deploy.sh preview    build, then publish to a temporary preview link (kept 7 days) to try first
#
# The first run also downloads the AI cut-out files (about 285 MB, once) into vendor/.
set -euo pipefail
cd "$(dirname "$0")"

[ -d node_modules ] || npm ci --no-audit --no-fund
npm run --silent vendor
python3 build.py

if [ "${1:-}" = "preview" ]; then
  firebase hosting:channel:deploy preview --expires 7d --project gpb-catalogue
else
  firebase deploy --only hosting --project gpb-catalogue
  echo
  echo "Live at https://gpb-catalogue.web.app"
fi
