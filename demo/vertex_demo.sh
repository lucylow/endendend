#!/usr/bin/env bash
# Judge-friendly smoke: PBFT + leaderless vote + partition heal (no ROS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"
export VERTEX_SWARM_SECRET="${VERTEX_SWARM_SECRET:-judge-demo-32byte-secret-key}"
export VERTEX_FOXMQ_MOCK=1
MODE="${1:-default}"
echo "vertex_demo mode=${MODE}"
python -m vertex_swarm.validation.bft_benchmark
python -m vertex_swarm.validation.partition_tester
echo "vertex_demo complete"
