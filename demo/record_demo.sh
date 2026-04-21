#!/usr/bin/env bash
# Video-ready capture helper (requires Webots + X11 + ffmpeg on PATH).
set -euo pipefail
WORLD="${1:-worlds/blackout_swarm.wbt}"
OUT="${2:-artifacts/demo.mp4}"
mkdir -p "$(dirname "$OUT")"
echo "Starting Webots: $WORLD"
webots --batch --mode=fast "$WORLD" &
WB_PID=$!
sleep "${WEBOTS_BOOT_SEC:-12}"
if command -v curl >/dev/null 2>&1; then
  curl -fsS -X POST "http://127.0.0.1:8099/inject/kill/drone_2" || true
fi
sleep "${POST_FAIL_SEC:-15}"
if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -f x11grab -video_size 1280x720 -i "${DISPLAY:-:0.0}" -t 20 "$OUT" || true
fi
kill "$WB_PID" 2>/dev/null || true
echo "Done (output if ffmpeg ran): $OUT"
