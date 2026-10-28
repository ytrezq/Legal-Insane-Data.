#!/bin/sh
# Rebuild the maps from the JSON data.
#   sh tools/build.sh        map (SVG + 10-megapixel JPG) from data/insanity_procedure_map.json
# Needs Node.js 18+ and Python 3 with Pillow.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --no-audit --no-fund
TMP="$(mktemp -d)"
node scripts/build_map.mjs ../data/insanity_procedure_map.json geo/admin1_subset.geojson \
  ../maps/insanity_procedure_map.svg geo/zones_excluded.geojson
node scripts/render_png.mjs ../maps/insanity_procedure_map.svg "$TMP/map.png" 3740
python3 scripts/to_jpg.py "$TMP/map.png" ../maps/insanity_procedure_map.jpg
rm -rf "$TMP"
