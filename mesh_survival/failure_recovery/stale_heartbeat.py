"""Dual-interval liveness: fast critical path + slower full sync; GREEN→BLACK tiers."""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, Optional


class HeartbeatTier(str, Enum):
    GREEN = "GREEN"  # 0–200ms
    YELLOW = "YELLOW"  # 200–500ms
    RED = "RED"  # 500ms–2s
    BLACK = "BLACK"  # >2s


_MS_GREEN = 200.0
_MS_YELLOW = 500.0
_MS_RED = 2000.0


def tier_from_age_ms(age_ms: float) -> HeartbeatTier:
    a = float(age_ms)
    if a <= _MS_GREEN:
        return HeartbeatTier.GREEN
    if a <= _MS_YELLOW:
        return HeartbeatTier.YELLOW
    if a <= _MS_RED:
        return HeartbeatTier.RED
    return HeartbeatTier.BLACK


def voting_weight(tier: HeartbeatTier) -> float:
    if tier == HeartbeatTier.GREEN:
        return 1.0
    if tier == HeartbeatTier.YELLOW:
        return 0.45
    if tier == HeartbeatTier.RED:
        return 0.0
    return 0.0


@dataclass
class StaleHeartbeatTracker:
    """Fast (200ms-class) + slow (2s) last-seen; tier drives consensus weight + emergency."""

    fast_stale_ms: float = 200.0
    slow_stale_ms: float = 2000.0
    now_fn: Callable[[], float] = time.monotonic

    def __post_init__(self) -> None:
        self._fast: Dict[str, float] = {}
        self._slow: Dict[str, float] = {}

    def record_fast(self, peer_id: str, *, now: Optional[float] = None) -> None:
        t = self.now_fn() if now is None else float(now)
        self._fast[peer_id] = t

    def record_slow(self, peer_id: str, *, now: Optional[float] = None) -> None:
        t = self.now_fn() if now is None else float(now)
        self._slow[peer_id] = t

    def forget(self, peer_id: str) -> None:
        self._fast.pop(peer_id, None)
        self._slow.pop(peer_id, None)

    def age_ms(self, peer_id: str, *, now: Optional[float] = None) -> Optional[float]:
        t = self.now_fn() if now is None else float(now)
        last = self._fast.get(peer_id)
        if last is None:
            return None
        return (t - last) * 1000.0

    def tier(self, peer_id: str, *, now: Optional[float] = None) -> Optional[HeartbeatTier]:
        age = self.age_ms(peer_id, now=now)
        if age is None:
            return None
        return tier_from_age_ms(age)

    def needs_slow_resync(self, peer_id: str, *, now: Optional[float] = None) -> bool:
        t = self.now_fn() if now is None else float(now)
        last = self._slow.get(peer_id)
        if last is None:
            return True
        return (t - last) * 1000.0 >= self.slow_stale_ms

    def emergency_black(self, peer_id: str, *, now: Optional[float] = None) -> bool:
        tr = self.tier(peer_id, now=now)
        return tr == HeartbeatTier.BLACK
