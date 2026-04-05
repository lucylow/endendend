"""Peer liveness from HEARTBEAT messages; stale/dead classification for failover."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Set


@dataclass(frozen=True)
class PeerLiveness:
    """Snapshot for one peer at a point in time."""

    node_id: str
    last_seen: float
    stake: float
    state: str  # "ok" | "stale" | "dead"


class HeartbeatMonitor:
    """Tracks last-seen times and optional stake hints; emits stale/dead transitions."""

    def __init__(
        self,
        *,
        stale_sec: float = 8.0,
        dead_sec: float = 24.0,
        now_fn: Optional[Callable[[], float]] = None,
    ) -> None:
        self.stale_sec = float(stale_sec)
        self.dead_sec = float(dead_sec)
        self._now = now_fn or time.time
        self._last_seen: Dict[str, float] = {}
        self._stake: Dict[str, float] = {}
        self._dead: Set[str] = set()
        self._stale_reported: Set[str] = set()

    def record(self, peer_id: str, *, stake: float = 0.0, now: Optional[float] = None) -> None:
        t = now if now is not None else self._now()
        self._last_seen[peer_id] = t
        self._stake[peer_id] = float(stake)
        if peer_id in self._dead:
            self._dead.discard(peer_id)
        self._stale_reported.discard(peer_id)

    def forget(self, peer_id: str) -> None:
        self._last_seen.pop(peer_id, None)
        self._stake.pop(peer_id, None)
        self._dead.discard(peer_id)
        self._stale_reported.discard(peer_id)

    def peer_state(self, peer_id: str, *, now: Optional[float] = None) -> Optional[PeerLiveness]:
        t0 = now if now is not None else self._now()
        last = self._last_seen.get(peer_id)
        if last is None:
            return None
        age = t0 - last
        if peer_id in self._dead or age >= self.dead_sec:
            st = "dead"
        elif age >= self.stale_sec:
            st = "stale"
        else:
            st = "ok"
        return PeerLiveness(peer_id, last, self._stake.get(peer_id, 0.0), st)

    def tick(
        self,
        *,
        now: Optional[float] = None,
        on_stale: Optional[Callable[[str], None]] = None,
        on_dead: Optional[Callable[[str], None]] = None,
    ) -> List[str]:
        """Update state; invoke callbacks once per peer per transition; return newly dead ids."""
        t0 = now if now is not None else self._now()
        newly_dead: List[str] = []
        for peer_id, last in list(self._last_seen.items()):
            age = t0 - last
            if age >= self.stale_sec and peer_id not in self._stale_reported:
                self._stale_reported.add(peer_id)
                if on_stale is not None:
                    on_stale(peer_id)
            if age >= self.dead_sec and peer_id not in self._dead:
                self._dead.add(peer_id)
                newly_dead.append(peer_id)
                if on_dead is not None:
                    on_dead(peer_id)
        return newly_dead

    def is_alive(self, peer_id: str, *, now: Optional[float] = None) -> bool:
        st = self.peer_state(peer_id, now=now)
        return st is not None and st.state == "ok"

    def all_known_peers(self) -> List[str]:
        return sorted(self._last_seen.keys())
