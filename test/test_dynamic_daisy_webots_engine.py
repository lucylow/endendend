"""Unit tests for Webots Dynamic Daisy Chain Python engine (no Webots runtime)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "controllers" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dynamic_daisy_engine import DynamicDaisyEngine  # noqa: E402
from signal_model import TunnelSignalModel  # noqa: E402
from tunnel_geometry import build_tunnel_geometry  # noqa: E402


def test_link_quality_monotone_with_depth():
    rng = __import__("random").Random(1)
    geom = build_tunnel_geometry(7)
    m = TunnelSignalModel(geom, rng)
    shallow = m.link_quality((0, 2, 10), (1, 2, 12))["quality"]
    deep = m.link_quality((0, 2, 160), (2, 2, 175))["quality"]
    assert shallow > deep


def test_engine_tick_emits_chain_and_targets():
    eng = DynamicDaisyEngine(seed=3)
    pos = {f"drone_{i}": (float(i), 2.0, 12.0 + i * 4.0) for i in range(5)}
    payload, motion = eng.tick(0.02, pos)
    assert "relay_chain" in payload
    assert payload["relay_chain"][0] == "entrance"
    assert "drone_0" in motion
    assert "target_z" in motion["drone_0"]


def test_relay_failure_marks_drone1_dead_after_script_time():
    eng = DynamicDaisyEngine(seed=0)
    pos = {f"drone_{i}": (0.0, 2.0, 15.0 + i * 6.0) for i in range(5)}
    payload = {}
    while eng.t < 125.0:
        payload, _motion = eng.tick(0.02, pos)
    d1 = next(x for x in payload["rovers"] if x["id"] == "drone_1")
    assert d1["state"] == "dead"
