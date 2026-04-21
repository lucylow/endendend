"""CRDT-style replicated mission state (roles, chain, victims, heartbeats)."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


def _tiebreak(a: Tuple[int, str], b: Tuple[int, str]) -> bool:
    """True if a wins over b (higher lamport; then lexicographic node id)."""
    if a[0] != b[0]:
        return a[0] > b[0]
    return a[1] > b[1]


@dataclass
class ReplicatedState:
    """Leaderless merge rules: OR-set victims, LWW scalar map with signed lamport."""

    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    lamport: int = 0
    roles: Dict[str, str] = field(default_factory=dict)
    role_meta: Dict[str, Tuple[int, str]] = field(default_factory=dict)
    chain: List[str] = field(default_factory=list)
    chain_meta: Tuple[int, str] = (0, "")
    victims: Set[str] = field(default_factory=set)
    heartbeat: Dict[str, float] = field(default_factory=dict)
    pose_graph: Dict[str, Dict[str, float]] = field(default_factory=dict)
    pose_meta: Dict[str, Tuple[int, str]] = field(default_factory=dict)

    def tick_lamport(self, remote: int) -> int:
        with self._lock:
            self.lamport = max(self.lamport, int(remote)) + 1
            return self.lamport

    def set_role(self, drone_id: str, role: str, lamport: int, signer_id: str) -> None:
        with self._lock:
            cur = self.role_meta.get(drone_id, (-1, ""))
            cand = (int(lamport), str(signer_id))
            if _tiebreak(cand, cur) or drone_id not in self.roles:
                self.roles[drone_id] = str(role)
                self.role_meta[drone_id] = cand

    def set_chain(self, ordered: List[str], lamport: int, signer_id: str) -> None:
        with self._lock:
            cand = (int(lamport), str(signer_id))
            if _tiebreak(cand, self.chain_meta):
                self.chain = list(ordered)
                self.chain_meta = cand

    def add_victim(self, tag: str) -> None:
        with self._lock:
            self.victims.add(str(tag))

    def heartbeat_seen(self, node_id: str, ts: Optional[float] = None) -> None:
        with self._lock:
            self.heartbeat[node_id] = float(ts or time.time())

    def merge_pose(self, node_id: str, xyz: Dict[str, float], lamport: int, signer_id: str) -> None:
        with self._lock:
            cur = self.pose_meta.get(node_id, (-1, ""))
            cand = (int(lamport), str(signer_id))
            if _tiebreak(cand, cur):
                self.pose_graph[node_id] = dict(xyz)
                self.pose_meta[node_id] = cand

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "roles": dict(self.roles),
                "chain": list(self.chain),
                "victims": sorted(self.victims),
                "heartbeat": dict(self.heartbeat),
                "pose_graph": {k: dict(v) for k, v in self.pose_graph.items()},
                "lamport": self.lamport,
            }
