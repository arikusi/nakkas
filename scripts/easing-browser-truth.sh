#!/usr/bin/env bash
# Browser ground truth for the frame sampler's easing math.
#
# Freezes the reference animation (3s cubic-bezier(0.68,-0.55,0.265,1.55),
# translateX 0 -> 560px) at t=0.75s / 1.5s / 2.25s inside a real Chromium
# using the negative animation-delay trick, and prints the computed
# translateX per time point. Compare against what bakeFrame produces for the
# same keyframes: on 2026-07-09 the values matched to a tenth of a pixel
# (browser -46.4 / 339.7 / 609.9 == sampler 23.6 / 409.7 / 679.9 on a track
# starting at x=70).
#
# Usage: scripts/easing-browser-truth.sh [path-to-chromium]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CHROME="${1:-}"
if [ -z "$CHROME" ]; then
  CHROME=$(command -v chromium || command -v google-chrome-stable || \
    find "$HOME/.cache/ms-playwright" -path "*chrome-linux*/chrome" -type f 2>/dev/null | head -1)
fi
if [ -z "$CHROME" ]; then
  echo "no chromium found; pass a path: scripts/easing-browser-truth.sh /path/to/chrome" >&2
  exit 1
fi

"$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=500 \
  --dump-dom "file://$HERE/easing-browser-truth.html" 2>/dev/null \
  | grep -oE "BROWSER-TRUTH t=0\.75s tx=-?[0-9.]+[^<\`]*"
