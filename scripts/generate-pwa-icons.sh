#!/bin/bash
# Génère les icônes PWA depuis scripts/pwa-icon.svg — outils macOS uniquement
# (qlmanage pour rasteriser le SVG, sips pour redimensionner), aucune dépendance npm.
# Usage : bash scripts/generate-pwa-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Rasterisation 1024px (qlmanage produit <nom>.svg.png dans le dossier cible)
qlmanage -t -s 1024 -o "$TMP" scripts/pwa-icon.svg >/dev/null
SRC="$TMP/pwa-icon.svg.png"
[ -f "$SRC" ] || { echo "échec qlmanage" >&2; exit 1; }

mkdir -p public/icons
sips -z 512 512 "$SRC" --out public/icons/icon-512.png >/dev/null
sips -z 192 192 "$SRC" --out public/icons/icon-192.png >/dev/null
sips -z 180 180 "$SRC" --out public/icons/apple-touch-icon.png >/dev/null

echo "OK :"
ls -la public/icons/
