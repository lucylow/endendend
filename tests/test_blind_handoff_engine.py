"""BlindHandoffEngine: multi-cycle rescue + auction winner."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from mockdata.handoff_engine import BlindHandoffEngine  # noqa: E402


def test_engine_rescue_increments() -> None:
    eng = BlindHandoffEngine(seed=7)
    dt = 1.0 / 60.0
    before = eng.rescues_completed
    for _ in range(int(45.0 / dt)):
        eng.step(dt)
    assert eng.rescues_completed >= before + 1
    assert eng.auction.winner is None or isinstance(eng.auction.winner, str)


def test_auction_collects_three_bids() -> None:
    eng = BlindHandoffEngine(seed=42)
    dt = 1.0 / 120.0
    for _ in range(int(19.0 / dt)):
        eng.step(dt)
    assert len(eng.auction.bids) == 3
    for _ in range(int(3.0 / dt)):
        eng.step(dt)
    assert eng.auction.winner in ("RoverHeavy1", "RoverLight2", "RoverLight3", None)
    assert eng.auction.winner is not None
    assert eng.auction.winner in {g.id for g in eng.ground}


def test_battery_below_threshold_at_auction() -> None:
    eng = BlindHandoffEngine(seed=42)
    dt = 0.05
    target = float(eng.timeline["auction_start_s"])
    steps = int(target / dt)
    for _ in range(steps):
        eng.step(dt)
    assert eng.aerial.battery < float(eng.config.low_battery_threshold)
