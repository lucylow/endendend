"""Orchestrates worldgen, exploration, heartbeat failure, reallocation, and map merge."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from mockdata.failure_engine import FailureConfig
from mockdata.foxmq_bridge import FoxMqExploredBridge
from mockdata import reallocation
from mockdata import rover_states
from mockdata import sectorizer
from mockdata import webots_bridge
from mockdata.worldgen import WorldGenerator

Bounds = Tuple[float, float, float, float]


class MockDataEngine:
    """Fallen comrade: five 20x20 sectors, RoverB fails at T+30s (3s detect), optional RoverC."""

    def __init__(
        self,
        seed: int = 42,
        explored_path: Optional[Path] = None,
        protocol_path: Optional[Path] = None,
        enable_second_failure: bool = True,
    ) -> None:
        self.seed = seed
        self.rng = random.Random(seed)
        world = WorldGenerator(seed).generate()
        self.grid: List[List[int]] = world["grid"]
        self.victims: List[Dict[str, float]] = world["victims"]
        self.initial_sector_bounds: Dict[str, Bounds] = {
            k: tuple(v) for k, v in world["sectors"].items()  # type: ignore[misc]
        }
        self.rovers: List[rover_states.RoverState] = []
        for rid in sectorizer.ROVER_IDS:
            self.rovers.append(
                rover_states.RoverState(id=rid, sector=self.initial_sector_bounds[rid])
            )
        self.t = 0.0
        self.reallocated_flag = False
        self.fail = FailureConfig()
        self._b_dead = False
        self._c_dead = False
        self._dead_history: List[str] = []
        root = Path(__file__).resolve().parents[2]
        default_explored = root / "data" / "worlds" / "explored_cells.json"
        self.fox = FoxMqExploredBridge(explored_path or default_explored)
        self.protocol_path = protocol_path or (root / "data" / "recordings" / "realloc_protocol.json")
        self.enable_second_failure = enable_second_failure
        self._realloc_events: List[Dict[str, Any]] = []

    def survivors(self) -> List[rover_states.RoverState]:
        return [r for r in self.rovers if r.state != "dead"]

    def _bounds_map(self) -> Dict[str, Bounds]:
        return {r.id: r.sector for r in self.rovers}

    def _maybe_kill(self, r: rover_states.RoverState) -> None:
        if r.state == "dead":
            return
        if r.heartbeat_stale(self.t, self.fail.heartbeat_timeout_s):
            r.state = "dead"
            r.battery = 0.0
            self._dead_history.append(r.id)

    def _reallocate_for(self, dead_id: str, dead_bounds: Bounds) -> None:
        surv = [x for x in self.survivors() if x.id != dead_id]
        ids = [x.id for x in surv]
        if not ids:
            return
        new_bounds = reallocation.reallocate_dead_sector(dead_bounds, ids, self._bounds_map())
        for s in surv:
            s.sector = new_bounds[s.id]
            s.state = "reallocating"
        self.reallocated_flag = True
        ev = {
            "t": round(self.t, 3),
            "dead": dead_id,
            "dead_bounds": dead_bounds,
            "assignments": {k: list(v) for k, v in new_bounds.items() if k in ids},
        }
        self._realloc_events.append(ev)
        self._append_protocol_file(ev)

    def _append_protocol_file(self, ev: Dict[str, Any]) -> None:
        self.protocol_path.parent.mkdir(parents=True, exist_ok=True)
        prev: List[Any] = []
        if self.protocol_path.exists():
            try:
                prev = json.loads(self.protocol_path.read_text(encoding="utf-8"))
                if not isinstance(prev, list):
                    prev = []
            except (json.JSONDecodeError, OSError):
                prev = []
        prev.append(ev)
        self.protocol_path.write_text(json.dumps(prev, indent=2), encoding="utf-8")

    def step(self, dt: float) -> None:
        self.t += dt
        b_bounds = self.initial_sector_bounds["RoverB"]

        for r in self.rovers:
            if r.state == "dead":
                continue
            stop_hb = False
            if r.id == "RoverB" and self.t >= self.fail.stop_heartbeat_b:
                stop_hb = True
            if r.id == "RoverC" and self.enable_second_failure and self.t >= self.fail.stop_heartbeat_c:
                stop_hb = True
            if stop_hb:
                if r.id == "RoverB" and not self._b_dead:
                    self._maybe_kill(r)
                if r.id == "RoverC" and not self._c_dead and self.enable_second_failure:
                    self._maybe_kill(r)
                continue

            if r.state == "reallocating":
                r.state = "exploring"
            r.update_exploring(dt, r.sector, self.t)

        # Commit RoverB failure + one-time realloc
        rb = next((x for x in self.rovers if x.id == "RoverB"), None)
        if rb and not self._b_dead and rb.state == "dead":
            self._b_dead = True
            self._reallocate_for("RoverB", b_bounds)

        # RoverC second failure (uses current sector at death time)
        rc = next((x for x in self.rovers if x.id == "RoverC"), None)
        if (
            rc
            and self.enable_second_failure
            and not self._c_dead
            and rc.state == "dead"
            and self._b_dead
        ):
            self._c_dead = True
            self._reallocate_for("RoverC", rc.sector)

        # FoxMQ merge (dedupe exploration)
        merged: Set[Tuple[int, int]] = set()
        for r in self.rovers:
            merged |= r.explored_cells
        self.fox.merge(merged)
        if int(self.t * 10) % 50 == 0:
            self.fox.sync_fs()

    def render_global_map(self) -> List[List[float]]:
        m = [[0.0 for _ in range(100)] for _ in range(100)]
        for z in range(100):
            for x in range(100):
                if self.grid[z][x]:
                    m[z][x] = 1.0
        for cx, cz in self.fox.cells:
            if 0 <= cx < 100 and 0 <= cz < 100:
                m[cz][cx] = max(m[cz][cx], 1.5)
        for r in self.rovers:
            if r.state == "dead":
                continue
            tint = 2.0 + 0.4 * (sum(ord(c) for c in r.id) % 5)
            for cx, cz in r.explored_cells:
                if 0 <= cx < 100 and 0 <= cz < 100:
                    if self.grid[cz][cx] == 0:
                        m[cz][cx] = max(m[cz][cx], min(6.0, tint))
        return m

    @property
    def global_map(self) -> List[List[float]]:
        return self.render_global_map()

    def to_frame(self) -> Dict[str, Any]:
        return webots_bridge.engine_to_track2_frame(self)

    def reset(self, seed: Optional[int] = None) -> None:
        if seed is not None:
            self.seed = seed
            self.rng = random.Random(seed)
        world = WorldGenerator(self.seed).generate()
        self.grid = world["grid"]
        self.victims = world["victims"]
        self.initial_sector_bounds = {k: tuple(v) for k, v in world["sectors"].items()}  # type: ignore[misc]
        self.rovers = []
        for rid in sectorizer.ROVER_IDS:
            self.rovers.append(rover_states.RoverState(id=rid, sector=self.initial_sector_bounds[rid]))
        self.t = 0.0
        self.reallocated_flag = False
        self._b_dead = False
        self._c_dead = False
        self._dead_history.clear()
        self._realloc_events.clear()
        self.fox.cells.clear()
