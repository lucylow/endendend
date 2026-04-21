"""Lightweight distributed pose graph edges (pairwise relative constraints)."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


@dataclass
class PoseEdge:
    a: str
    b: str
    dx: float
    dy: float
    dz: float
    lamport: int
    signer: str


@dataclass
class DistributedPoseGraph:
    """Merge edges by (a,b) lexicographic key; last lamport wins."""

    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    _edges: Dict[Tuple[str, str], PoseEdge] = field(default_factory=dict)

    def upsert(self, edge: PoseEdge) -> None:
        key = tuple(sorted((edge.a, edge.b)))
        with self._lock:
            cur = self._edges.get(key)
            if cur is None or edge.lamport >= cur.lamport:
                self._edges[key] = edge

    def edges(self) -> List[PoseEdge]:
        with self._lock:
            return list(self._edges.values())
