"""Explorer→base chain utility: maximize bottleneck delivery (widest path)."""

from __future__ import annotations

import heapq
from typing import Dict, List, Optional, Sequence, Tuple

from mesh_survival.topology.connectivity_matrix import ConnectivityMatrix


def widest_path_capacity(
    mat: ConnectivityMatrix,
    source: str,
    sink: str,
    *,
    min_edge_delivery: float = 0.02,
) -> Tuple[float, List[str]]:
    """Maximin path capacity; returns (capacity, node_path). Empty path if disconnected."""
    best_cap: Dict[str, float] = {source: 1.0}
    prev: Dict[str, Optional[str]] = {source: None}
    pq: List[Tuple[float, str]] = [(-1.0, source)]
    while pq:
        neg_cap, u = heapq.heappop(pq)
        cap_u = -neg_cap
        if u == sink:
            path: List[str] = []
            cur: Optional[str] = sink
            while cur is not None:
                path.append(cur)
                cur = prev.get(cur)
            path.reverse()
            return cap_u, path
        for v in mat.neighbors(u):
            d = mat.delivery(u, v)
            if d is None or d < min_edge_delivery:
                continue
            new_cap = min(cap_u, d)
            if new_cap > best_cap.get(v, 0.0):
                best_cap[v] = new_cap
                prev[v] = u
                heapq.heappush(pq, (-new_cap, v))
    return 0.0, []


def chain_score(
    ordered: Sequence[str],
    mat: ConnectivityMatrix,
    *,
    min_edge_delivery: float = 0.02,
) -> float:
    """Product of edge deliveries along ordered chain (soft min-cut style objective)."""
    if len(ordered) < 2:
        return 0.0
    p = 1.0
    for a, b in zip(ordered, ordered[1:]):
        d = mat.delivery(str(a), str(b))
        if d is None or d < min_edge_delivery:
            return 0.0
        p *= d
    return p
