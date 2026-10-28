#!/bin/sh
# Régénère la carte à partir des données.
#   sh outils/construire.sh    carte (SVG + JPG de 10 mégapixels) à partir de donnees/irresponsabilite_penale.json
# Nécessite Node.js 18+ et Python 3 avec Pillow.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --no-audit --no-fund
TMP="$(mktemp -d)"
node scripts/carte.mjs ../donnees/irresponsabilite_penale.json geo/admin1_sous_ensemble.geojson \
  ../cartes/irresponsabilite_penale.svg geo/zones_exclues.geojson
node scripts/rendu_png.mjs ../cartes/irresponsabilite_penale.svg "$TMP/carte.png" 3740
python3 scripts/vers_jpg.py "$TMP/carte.png" ../cartes/irresponsabilite_penale.jpg
rm -rf "$TMP"
