"""Distance-vector routing table for multi-hop mesh (simulation / lab use)."""

from __future__ import annotations

import threading
import time
from typing import Dict, List, Optional, Tuple

RouteRow = Tuple[str, int, float, int]  # next_hop, cost, ts, version


class RoutingTable:
    """Per-destination ranked next hops (best-effort distance vector)."""

    def __init__(self, my_id: str, max_routes: int = 3) -> None:
        self.my_id = my_id
        self.max_routes = max_routes
        self.table: Dict[str, List[RouteRow]] = {}
        self._lock = threading.Lock()

    def add_route(
        self,
        dest: str,
        next_hop: str,
        cost: int,
        version: int,
    ) -> None:
        if dest == self.my_id:
            return
        if cost < 1 or cost > 64:
            return
        with self._lock:
            routes = list(self.table.get(dest, []))
            updated = False
            for i, (nh, c, _ts, v) in enumerate(routes):
                if nh == next_hop:
                    routes[i] = (next_hop, cost, time.time(), version)
                    updated = True
                    break
            if not updated:
                routes.append((next_hop, cost, time.time(), version))
            routes.sort(key=lambda x: (x[1], -x[3]))
            self.table[dest] = routes[: self.max_routes]

    def remove_routes_via(self, next_hop: str) -> None:
        with self._lock:
            for dest in list(self.table.keys()):
                kept = [r for r in self.table[dest] if r[0] != next_hop]
                if kept:
                    self.table[dest] = kept[: self.max_routes]
                else:
                    del self.table[dest]

    def get_best(self, dest: str) -> Optional[RouteRow]:
        with self._lock:
            routes = self.table.get(dest, [])
            return routes[0] if routes else None

    def get_next_hops(self, dest: str, k: int = 3) -> List[str]:
        with self._lock:
            routes = self.table.get(dest, [])
            return [r[0] for r in routes[:k]]

    def cleanup_stale(self, max_age: float = 30.0) -> None:
        with self._lock:
            now = time.time()
            for dest in list(self.table.keys()):
                fresh = [r for r in self.table[dest] if now - r[2] < max_age]
                if fresh:
                    self.table[dest] = fresh[: self.max_routes]
                else:
                    del self.table[dest]

    def advertise(self, max_destinations: Optional[int] = None) -> List[Tuple[str, int, int]]:
        """One best row per destination for DV exchange (optionally cap table size for large swarms)."""
        with self._lock:
            out: List[Tuple[str, int, int]] = []
            items = list(self.table.items())
            if max_destinations is not None and len(items) > max_destinations:
                items.sort(key=lambda kv: kv[0])
                items = items[:max_destinations]
            for dest, routes in items:
                if not routes:
                    continue
                nh, cost, _ts, ver = routes[0]
                out.append((dest, cost, ver))
            return out

    def snapshot(self) -> Dict[str, List[Dict[str, object]]]:
        with self._lock:
            snap: Dict[str, List[Dict[str, object]]] = {}
            for dest, routes in self.table.items():
                snap[dest] = [
                    {"next_hop": nh, "cost": c, "version": v} for nh, c, _ts, v in routes
                ]
            return snap
