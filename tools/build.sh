#!/bin/sh
# Rebuild the maps from the JSON data.
#   sh tools/build.sh        English map (SVG + 10-megapixel JPG) from data/insanity_procedure_map.json
#   sh tools/build.sh --fr   also the French map from data/fr/irresponsabilite_penale.json
# Needs Node.js 18+ and Python 3 with Pillow.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --no-audit --no-fund
TMP="$(mktemp -d)"
node scripts/build_map.mjs ../data/insanity_procedure_map.json geo/admin1_subset.geojson \
  ../maps/insanity_procedure_map.svg geo/zones_excluded.geojson
node scripts/render_png.mjs ../maps/insanity_procedure_map.svg "$TMP/map.png" 3740
python3 scripts/to_jpg.py "$TMP/map.png" ../maps/insanity_procedure_map.jpg
if [ "$1" = "--fr" ]; then
  node scripts/build_map.mjs ../data/fr/irresponsabilite_penale.json geo/admin1_subset.geojson \
    ../maps/fr/irresponsabilite_penale.svg geo/zones_excluded.geojson
  node scripts/render_png.mjs ../maps/fr/irresponsabilite_penale.svg ../maps/fr/irresponsabilite_penale.png 2000
fi
rm -rf "$TMP"
