#!/usr/bin/env bash
# Launch Webots simulation with the specified world file.
# Usage: ./scripts/run_webots.sh worlds/tunnel.wbt [--mode fast]

set -euo pipefail

WORLD="${1:?Usage: $0 <world.wbt> [--mode fast|realtime]}"
MODE="${2:---mode=fast}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

echo "▶ Launching Webots: $WORLD ($MODE)"
echo "  PYTHONPATH=$PYTHONPATH"

if command -v webots &>/dev/null; then
    exec webots "$MODE" --stdout --stderr "$WORLD"
else
    echo "⚠  Webots not found — running headless simulation instead"
    exec python3 -m swarm.webots_controller --headless --max-steps 500
fi
