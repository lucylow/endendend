"""Undirected latency / loss view for live mesh health and reachability checks."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set, Tuple


@dataclass
class ConnectivityMatrix:
    """Symmetric edge metrics: latency_ms, delivery_estimate in (0,1]."""

    _lat: Dict[Tuple[str, str], float] = field(default_factory=dict)
    _deliv: Dict[Tuple[str, str], float] = field(default_factory=dict)

    def _key(self, a: str, b: str) -> Tuple[str, str]:
        return (a, b) if a <= b else (b, a)

    def set_link(self, a: str, b: str, *, latency_ms: float, delivery: float) -> None:
        k = self._key(a, b)
        self._lat[k] = float(latency_ms)
        self._deliv[k] = min(1.0, max(0.0, float(delivery)))

    def remove_link(self, a: str, b: str) -> None:
        k = self._key(a, b)
        self._lat.pop(k, None)
        self._deliv.pop(k, None)

    def latency(self, a: str, b: str) -> Optional[float]:
        return self._lat.get(self._key(a, b))

    def delivery(self, a: str, b: str) -> Optional[float]:
        return self._deliv.get(self._key(a, b))

    def neighbors(self, node: str) -> List[str]:
        out: Set[str] = set()
        for u, v in self._lat.keys():
            if u == node:
                out.add(v)
            elif v == node:
                out.add(u)
        return sorted(out)

    def reachable(self, src: str, dst: str, *, min_delivery: float = 0.05) -> bool:
        if src == dst:
            return True
        seen: Set[str] = {src}
        stack = [src]
        while stack:
            n = stack.pop()
            for m in self.neighbors(n):
                if m in seen:
                    continue
                d = self.delivery(n, m)
                if d is None or d < min_delivery:
                    continue
                if m == dst:
                    return True
                seen.add(m)
                stack.append(m)
        return False

    def mean_latency_ms(self, pairs: Iterable[Tuple[str, str]]) -> float:
        vals: List[float] = []
        for a, b in pairs:
            L = self.latency(a, b)
            if L is not None:
                vals.append(L)
        return sum(vals) / len(vals) if vals else 0.0
