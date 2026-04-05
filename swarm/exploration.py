"""Decentralized grid exploration: gossip of explored cells + timed claims."""

from __future__ import annotations

import random
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from swarm import config
from swarm.config import GRID_CELL_SIZE, GRID_HEIGHT, GRID_WIDTH, WORLD_BOUNDS

Cell = Tuple[int, int]


def _cell_key(cell: Cell) -> str:
    return f"{cell[0]},{cell[1]}"


def _parse_cell(obj: Any) -> Optional[Cell]:
    if isinstance(obj, (list, tuple)) and len(obj) == 2:
        ix, iy = int(obj[0]), int(obj[1])
        return (ix, iy)
    return None


class GridMap:
    """Local view of explored cells and soft reservations (claims) from gossip."""

    def __init__(self, claim_timeout: float = 10.0) -> None:
        self.explored: Set[Cell] = set()
        # cell -> (owner_drone_id, claim_time_wallclock)
        self.claimed: Dict[Cell, Tuple[str, float]] = {}
        self.claim_timeout = claim_timeout

    def cell_from_position(self, x: float, y: float) -> Cell:
        xmin, _xmax, ymin, _ymax = WORLD_BOUNDS
        ix = int((x - xmin) / GRID_CELL_SIZE)
        iy = int((y - ymin) / GRID_CELL_SIZE)
        ix = max(0, min(GRID_WIDTH - 1, ix))
        iy = max(0, min(GRID_HEIGHT - 1, iy))
        return (ix, iy)

    def cell_center_meters(self, cell: Cell) -> Tuple[float, float]:
        xmin, _xmax, ymin, _ymax = WORLD_BOUNDS
        cx = xmin + (cell[0] + 0.5) * GRID_CELL_SIZE
        cy = ymin + (cell[1] + 0.5) * GRID_CELL_SIZE
        return (cx, cy)

    def is_explored(self, cell: Cell) -> bool:
        return cell in self.explored

    def mark_explored(self, cell: Cell) -> None:
        self.explored.add(cell)
        self.claimed.pop(cell, None)

    def set_foreign_claim(self, cell: Cell, owner: str, ts: Optional[float] = None) -> None:
        if owner == "":
            return
        t = time.time() if ts is None else ts
        self.claimed[cell] = (owner, t)

    def claim_for_self(self, cell: Cell, my_id: str) -> None:
        self.claimed[cell] = (my_id, time.time())

    def release_self_claim(self, cell: Cell, my_id: str) -> None:
        cur = self.claimed.get(cell)
        if cur and cur[0] == my_id:
            del self.claimed[cell]

    def is_blocked_for(self, cell: Cell, my_id: str) -> bool:
        """True if another drone holds a non-stale claim on this cell."""
        cur = self.claimed.get(cell)
        if not cur:
            return False
        owner, ts = cur
        if owner == my_id:
            return False
        if time.time() - ts > self.claim_timeout:
            return False
        return True

    def cleanup_stale_claims(self) -> None:
        now = time.time()
        stale = [c for c, (_o, ts) in self.claimed.items() if now - ts > self.claim_timeout]
        for c in stale:
            del self.claimed[c]


class ExplorationManager:
    """Gossip exploration updates, merge peer maps, greedy nearest-unexplored targets."""

    def __init__(self, my_id: str, vertex: Any) -> None:
        self.my_id = my_id
        self.vertex = vertex
        self.map = GridMap()
        self.current_target: Optional[Cell] = None
        self.last_broadcast = 0.0
        self.broadcast_interval = 5.0
        self._epidemic_seen: Dict[str, float] = {}
        self._epidemic_ttl_sec = 45.0

    def _prune_epidemic(self) -> None:
        now = time.time()
        stale = [k for k, ts in self._epidemic_seen.items() if now - ts > self._epidemic_ttl_sec]
        for k in stale:
            del self._epidemic_seen[k]

    def _network_size(self) -> int:
        fn = getattr(self.vertex, "registered_peer_count", None)
        if callable(fn):
            return int(fn()) + 1
        return 2

    def _use_scalable_exploration(self) -> bool:
        if not getattr(config, "SCALABLE_EXPLORATION_ENABLED", False):
            return False
        if bool(getattr(self.vertex, "_mesh_routing", False)):
            return False
        return self._network_size() >= int(getattr(config, "SCALABLE_PEER_COUNT_THRESHOLD", 16))

    def update(self) -> None:
        now = time.time()
        self.map.cleanup_stale_claims()
        if now - self.last_broadcast > self.broadcast_interval:
            self._broadcast_updates()
            self.last_broadcast = now

    def _broadcast_updates(self) -> None:
        cells: List[List[int]] = [[c[0], c[1]] for c in self.map.explored]
        claims_out: List[Dict[str, Any]] = []
        for cell, (owner, _ts) in self.map.claimed.items():
            claims_out.append({"cell": [cell[0], cell[1]], "owner": owner})
        payload: Dict[str, Any] = {
            "type": "EXPLORATION_UPDATE",
            "cells": cells,
            "claims": claims_out,
            "sender": self.my_id,
        }
        if self._use_scalable_exploration():
            payload["relay_ttl"] = int(getattr(config, "EXPLORATION_RELAY_TTL", 5))
            payload["epidemic_id"] = f"{self.my_id}:{time.time_ns()}:{random.randint(0, 1_000_000)}"
            self.vertex.broadcast_sampled(
                payload,
                fanout=int(getattr(config, "EXPLORATION_GOSSIP_FANOUT", 3)),
            )
        else:
            self.vertex.broadcast(payload)

    def handle_exploration_update(self, sender: str, msg: Dict[str, Any]) -> None:
        if sender == self.my_id:
            return
        raw_eid = msg.get("epidemic_id")
        eid: Optional[str] = raw_eid if isinstance(raw_eid, str) and raw_eid else None
        if eid:
            self._prune_epidemic()
            if eid in self._epidemic_seen:
                return
            self._epidemic_seen[eid] = time.time()
        ts = time.time()
        for item in msg.get("cells", []):
            cell = _parse_cell(item)
            if cell is not None:
                self.map.mark_explored(cell)
        for entry in msg.get("claims", []):
            if isinstance(entry, dict):
                cell = _parse_cell(entry.get("cell"))
                owner = str(entry.get("owner", ""))
            else:
                cell = None
                owner = ""
            if cell is None or not owner or owner == self.my_id:
                continue
            if self.map.is_explored(cell):
                continue
            self.map.set_foreign_claim(cell, owner, ts)

        relay = int(msg.get("relay_ttl", 0) or 0)
        if relay > 0 and self._use_scalable_exploration() and eid:
            out: Dict[str, Any] = {
                "type": "EXPLORATION_UPDATE",
                "cells": list(msg.get("cells", [])),
                "claims": list(msg.get("claims", [])),
                "sender": str(msg.get("sender", sender)),
                "relay_ttl": relay - 1,
                "epidemic_id": eid,
            }
            self.vertex.broadcast_sampled(
                out,
                fanout=int(getattr(config, "EXPLORATION_GOSSIP_FANOUT", 3)),
            )

    def choose_next_target(self, current_pos: Tuple[float, float]) -> Optional[Cell]:
        cx, cy = self.map.cell_from_position(current_pos[0], current_pos[1])
        if self.current_target is not None:
            if not self.map.is_explored(self.current_target) and not self.map.is_blocked_for(
                self.current_target, self.my_id
            ):
                return self.current_target
            self.current_target = None

        best: Optional[Tuple[int, Cell]] = None
        for ix in range(GRID_WIDTH):
            for iy in range(GRID_HEIGHT):
                cell = (ix, iy)
                if self.map.is_explored(cell):
                    continue
                if self.map.is_blocked_for(cell, self.my_id):
                    continue
                dist = abs(ix - cx) + abs(iy - cy)
                cand = (dist, cell)
                if best is None or cand[0] < best[0]:
                    best = cand
        if best is None:
            self.current_target = None
            return None
        _d, cell = best
        self.map.claim_for_self(cell, self.my_id)
        self.current_target = cell
        return cell

    def reached_target(self, cell: Cell) -> None:
        self.map.mark_explored(cell)
        self.map.release_self_claim(cell, self.my_id)
        self.current_target = None

    def snapshot_for_ui(self) -> Dict[str, Any]:
        """Compact state for dashboards / WebSocket payloads."""
        claims: Dict[str, str] = {}
        for c, (owner, ts) in self.map.claimed.items():
            age = time.time() - ts
            if age <= self.map.claim_timeout:
                claims[_cell_key(c)] = owner
        return {
            "explored_cells": [[c[0], c[1]] for c in self.map.explored],
            "claims": claims,
            "current_target": list(self.current_target) if self.current_target else None,
        }


class GridMap1D:
    """Tunnel axis coverage: cell indices along depth (optional simplification)."""

    def __init__(self, tunnel_length: float = 500.0, cell_size: float = 10.0) -> None:
        self.explored: Set[int] = set()
        self.claimed: Dict[int, Tuple[str, float]] = {}
        self.cell_size = cell_size
        self.num_cells = max(1, int(tunnel_length / cell_size))
        self.claim_timeout = 10.0

    def cell_from_depth(self, depth: float) -> int:
        i = int(depth / self.cell_size)
        return max(0, min(self.num_cells - 1, i))

    def mark_explored(self, idx: int) -> None:
        self.explored.add(idx)
        self.claimed.pop(idx, None)
