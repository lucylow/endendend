"""Example Scenario 1 — Dynamic Daisy Chain (tunnel SAR, degrading RF).

Use these constants when scripting Webots runs or unit tests that mirror the
Vertex Swarm “Search & Rescue Swarms” track: autonomous relay formation with
no central cloud.

Timeline JSON (``NetworkSimulator`` + ``ScenarioRunner``):

    swarm/scenarios/scenario1_baseline_daisy_chain.json

Node ids ``d0``..``d4``: treat ``d0`` as entrance-side logger/coordinator in
simulation only; ``d4`` as the lead explorer’s network identity when you model
progressive depth. Events ramp **d4→d0** loss over time to force multi-hop
relays while keeping short-range hops healthier.
"""

from __future__ import annotations

import json
from pathlib import Path

_SCENARIO_DIR = Path(__file__).resolve().parent / "scenarios"
SCENARIO1_BASELINE_JSON = _SCENARIO_DIR / "scenario1_baseline_daisy_chain.json"

# --- Physical / RF model (prompt §2) ---
TUNNEL_LENGTH_M = 200.0
ENTRANCE_DEPTH_M = 0.0
# Approximate direct path loss to entrance vs explorer depth (tunable)
LOSS_FRACTION_AT_DEPTH_100M = 0.5
LOSS_FRACTION_AT_DEPTH_150M = 0.8

# --- Baseline test §5.1 ---
BASELINE_DRONE_COUNT = 5
BASELINE_NODE_IDS = tuple(f"d{i}" for i in range(BASELINE_DRONE_COUNT))
FIRST_RELAY_TRIGGER_DEPTH_M = 30.0
FIRST_RELAY_PLACEMENT_DEPTH_M = 15.0
RELAY_INSERTION_BAND_M = 20.0

# --- Link policy sketch (prompt §4.1) ---
MAX_DEPTH_DIFF_DIRECT_M = 20.0
DEPTH_LATENCY_MS_PER_M = 2.0


def load_scenario1_baseline_events() -> list:
    """Parse the packaged JSON timeline for ``ScenarioRunner``."""
    with open(SCENARIO1_BASELINE_JSON, encoding="utf-8") as f:
        return json.load(f)


def approximate_loss_to_entrance(depth_m: float) -> float:
    """Piecewise linear proxy: 0% at entrance, 50% @ 100m, 80% @ 150m, cap 90%."""
    d = max(0.0, float(depth_m))
    if d <= 100.0:
        return min(0.9, d / 100.0 * LOSS_FRACTION_AT_DEPTH_100M)
    if d <= 150.0:
        t = (d - 100.0) / 50.0
        return min(0.9, LOSS_FRACTION_AT_DEPTH_100M + t * (LOSS_FRACTION_AT_DEPTH_150M - LOSS_FRACTION_AT_DEPTH_100M))
    return 0.9
