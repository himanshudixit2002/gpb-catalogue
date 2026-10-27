#!/usr/bin/env bash
# Publish the catalogue app to https://gpb-catalogue.web.app
#
#   ./deploy.sh                          publish what is in public/ now
#   ./deploy.sh ~/Downloads/new-app.html copy a new app file in first, then publish
#
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -gt 0 ]; then
  if [ ! -f "$1" ]; then echo "No file at: $1" >&2; exit 1; fi
  cp "$1" public/index.html
  echo "Copied $1 to public/index.html"
fi

if [ ! -f public/index.html ]; then echo "public/index.html is missing" >&2; exit 1; fi

firebase deploy --only hosting --project gpb-catalogue
echo
echo "Live at https://gpb-catalogue.web.app"
