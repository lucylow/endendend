"""Battery drain profiles for aerial sweep vs ground convoy (mock, judge-sync friendly)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BatteryProfile:
    """Percent per second (negative = drain)."""

    aerial_sweep_pct_s: float = 0.55
    aerial_post_detect_pct_s: float = 4.5
    ground_idle_pct_s: float = 0.08
    ground_transit_pct_s: float = 0.18


DEFAULT_PROFILE = BatteryProfile()
