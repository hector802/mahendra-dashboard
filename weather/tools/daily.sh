#!/usr/bin/env bash
# Make today's morning forecast Reels for every place in places.txt.
# usage: tools/daily.sh [OUTPUT_DIR]     (default: weather/out/YYYY-MM-DD)
# Exits non-zero if any place failed (e.g. the weather couldn't be fetched).
set -uo pipefail
cd "$(dirname "$0")"
DATE=$(TZ=Europe/London date +%F)
OUT=$(realpath -m "${1:-../out/$DATE}")
mkdir -p "$OUT"
./setup.sh || exit 1
(cd ../.. && exec python3 -m http.server 8765 >/dev/null 2>&1) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
status=0
while IFS='|' read -r name lat lon; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')
  if python3 fetch_weather.py "$lat" "$lon" "$OUT/$slug-weather.json"; then
    node render-daily.js --place "$name" --weather "$OUT/$slug-weather.json" --out "$OUT" || { echo "RENDER FAILED: $name" >&2; status=1; }
  else
    echo "WEATHER FAILED: $name (no video made rather than invent numbers)" >&2; status=1
  fi
done < places.txt
echo "Output: $OUT"; ls -1 "$OUT"
exit $status
