"""Gossip-clock divergence → partition suspicion; merge hints for reconciliation."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Mapping, Optional, Set, Tuple


class GossipClock:
    """Lamport-style scalar map per node id (lightweight split-brain signal)."""

    def __init__(self) -> None:
        self._v: Dict[str, int] = {}

    def tick_local(self, node_id: str) -> int:
        cur = self._v.get(node_id, 0) + 1
        self._v[node_id] = cur
        return cur

    def observe(self, remote: Mapping[str, int]) -> None:
        for k, val in remote.items():
            if not isinstance(val, int):
                continue
            self._v[k] = max(self._v.get(k, 0), val)

    def vector(self) -> Dict[str, int]:
        return dict(self._v)

    def merge_final(self, other: Mapping[str, int]) -> Dict[str, int]:
        """Vertex-style merge: per-key max for monotonic clocks."""
        out = dict(self._v)
        for k, val in other.items():
            if isinstance(val, int):
                out[k] = max(out.get(k, 0), val)
        return out


@dataclass
class PartitionDetector:
    """divergence > threshold ⇒ PARTITIONED; reconnect uses merged clock + signed roles."""

    divergence_threshold: int = 12
    _seen: Set[Tuple[str, str, int]] = field(default_factory=set)

    def clock_divergence(self, a: Mapping[str, int], b: Mapping[str, int]) -> int:
        keys: Iterable[str] = set(a.keys()) | set(b.keys())
        total = 0
        for k in keys:
            total += abs(int(a.get(k, 0)) - int(b.get(k, 0)))
        return total

    def status(
        self,
        local: Mapping[str, int],
        remote: Mapping[str, int],
    ) -> Tuple[str, int]:
        div = self.clock_divergence(local, remote)
        st = "PARTITIONED" if div > self.divergence_threshold else "HEALTHY"
        return st, div

    def remember_proof(self, role_holder: str, role: str, epoch: int) -> None:
        """Signed role proofs dedupe (caller supplies epoch/signature off-wire)."""
        self._seen.add((role_holder, role, epoch))

    def has_proof(self, role_holder: str, role: str, epoch: int) -> bool:
        return (role_holder, role, epoch) in self._seen
