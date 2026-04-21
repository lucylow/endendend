"""Orchestrates worldgen, exploration, heartbeat failure, reallocation, and map merge."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from mockdata.config import FallenComradeConfig
from mockdata.event_bus import EventBus
from mockdata.failure_engine import FailureConfig, FailureEngine
from mockdata.foxmq_bridge import FoxMqExploredBridge
from mockdata.protocol_log import ProtocolLogger
from mockdata.snapshot_store import SnapshotStore
from mockdata import reallocation
from mockdata import rover_states
from mockdata import sectorizer
from mockdata import webots_bridge
from mockdata.worldgen import WorldGenerator

Bounds = Tuple[float, float, float, float]


class MockDataEngine:
    """
    Fallen comrade: five 20x20 sectors, RoverB comm loss then heartbeat timeout so
    committed failure lands at T+30s (configurable via FallenComradeConfig).
    """

    def __init__(
        self,
        seed: int = 42,
        explored_path: Optional[Path] = None,
        protocol_path: Optional[Path] = None,
        enable_second_failure: bool = True,
    ) -> None:
        self.seed = seed
        self.rng = random.Random(seed)
        self.cfg = FallenComradeConfig(seed=seed)
        self.fail = FailureConfig(
            stop_heartbeat_b=self.cfg.rover_b_comm_loss_start_s,
            stop_heartbeat_c=self.cfg.rover_c_comm_loss_start_s,
            heartbeat_timeout_s=self.cfg.heartbeat_timeout_s,
        )
        self.failure_engine = FailureEngine(self.fail)
        self.protocol_log = ProtocolLogger()
        self.bus = EventBus()
        self.snap = SnapshotStore()

        root = Path(__file__).resolve().parents[2]
        default_explored = root / "data" / "worlds" / "explored_cells.json"
        self.fox = FoxMqExploredBridge(explored_path or default_explored)
        self.protocol_path = protocol_path or (root / "data" / "recordings" / "realloc_protocol.json")
        self.enable_second_failure = enable_second_failure
        self._realloc_events: List[Dict[str, Any]] = []

        world = WorldGenerator(seed).generate()
        self._apply_world(world)
        self.t = 0.0
        self.reallocated_flag = False
        self._b_dead = False
        self._c_dead = False
        self._dead_history: List[str] = []
        self._emit_world_spawn()

    def _apply_world(self, world: Dict[str, Any]) -> None:
        self.grid = world["grid"]
        self.victims = list(world["victims"])
        self.obstacles: List[Dict[str, Any]] = list(world.get("obstacles", []))
        self.initial_sector_bounds = {k: tuple(v) for k, v in world["sectors"].items()}  # type: ignore[misc]
        self.rovers = [
            rover_states.RoverState(id=rid, sector=self.initial_sector_bounds[rid], speed=self.cfg.speed_mps)
            for rid in sectorizer.ROVER_IDS
        ]

    def _emit_world_spawn(self) -> None:
        self.protocol_log.log(
            "WORLD_GENERATED",
            {
                "seed": self.seed,
                "victim_count": len(self.victims),
                "obstacle_count": len(self.obstacles),
            },
            sim_time_s=0.0,
        )
        self.bus.emit({"type": "WORLD_GENERATED", "seed": self.seed})
        for r in self.rovers:
            self.protocol_log.log("ROVER_SPAWNED", {"rover": r.id, "sector": list(r.sector)}, sim_time_s=0.0)
            self.bus.emit({"type": "ROVER_SPAWNED", "rover": r.id})

    def survivors(self) -> List[rover_states.RoverState]:
        return [r for r in self.rovers if r.state != "dead"]

    def _bounds_map(self) -> Dict[str, Bounds]:
        return {r.id: r.sector for r in self.rovers}

    def _maybe_kill(self, r: rover_states.RoverState) -> None:
        if r.state == "dead":
            return
        if r.heartbeat_stale(self.t, self.fail.heartbeat_timeout_s):
            self.protocol_log.log("HEARTBEAT_TIMEOUT", {"rover": r.id}, sim_time_s=self.t)
            self.bus.emit({"type": "HEARTBEAT_TIMEOUT", "rover": r.id, "sim_time": self.t})
            r.state = "dead"
            r.battery = 0.0
            r.task = "offline"
            self._dead_history.append(r.id)

    def _reallocate_for(self, dead_id: str, dead_bounds: Bounds) -> None:
        surv = self.failure_engine.survivors_for_realloc(self.rovers, dead_id)
        ids = [x.id for x in surv]
        if not ids:
            return
        new_bounds = reallocation.reallocate_dead_sector(dead_bounds, ids, self._bounds_map())
        for s in surv:
            s.sector = new_bounds[s.id]
            s.state = "reallocating"
            s.task = "reallocating"
        self.reallocated_flag = True
        ev = {
            "t": round(self.t, 3),
            "dead": dead_id,
            "dead_bounds": dead_bounds,
            "assignments": {k: list(v) for k, v in new_bounds.items() if k in ids},
        }
        self._realloc_events.append(ev)
        self._append_protocol_file(ev)
        self.protocol_log.log(
            "SECTOR_REALLOCATED",
            {"dead": dead_id, "assignments": ev["assignments"], "t": ev["t"]},
            sim_time_s=self.t,
        )
        self.bus.emit({"type": "SECTOR_REALLOCATED", **ev})

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

    def _detect_victims(self) -> None:
        for v in self.victims:
            if v.get("discovered"):
                continue
            vx = float(v["x"])
            vz = float(v["z"])
            for r in self.rovers:
                if r.state == "dead":
                    continue
                px, _, pz = r.position
                if (px - vx) ** 2 + (pz - vz) ** 2 < 2.25:
                    v["discovered"] = True
                    vid = str(v.get("id", ""))
                    if vid and vid not in r.assigned_victims:
                        r.assigned_victims.append(vid)
                    self.protocol_log.log("VICTIM_FOUND", {"victim": vid, "by": r.id}, sim_time_s=self.t)
                    self.bus.emit({"type": "VICTIM_FOUND", "victim": vid, "by": r.id, "sim_time": self.t})
                    break

    def step(self, dt: float) -> None:
        self.t += dt
        b_bounds = self.initial_sector_bounds["RoverB"]

        for r in self.rovers:
            if r.state == "dead":
                continue
            stop_hb = self.failure_engine.rover_should_stop_heartbeat(
                r.id, self.t, enable_c=self.enable_second_failure
            )
            if stop_hb:
                if r.id == "RoverB" and not self._b_dead:
                    self._maybe_kill(r)
                if r.id == "RoverC" and not self._c_dead and self.enable_second_failure:
                    self._maybe_kill(r)
                continue

            if r.state == "reallocating":
                r.state = "exploring"
            r.update_exploring(dt, r.sector, self.t, self.fox.cells)

        self._detect_victims()

        rb = next((x for x in self.rovers if x.id == "RoverB"), None)
        if rb and not self._b_dead and rb.state == "dead":
            self.protocol_log.log("ROVER_DEAD", {"rover": "RoverB"}, sim_time_s=self.t)
            self.bus.emit({"type": "ROVER_DEAD", "rover": "RoverB", "sim_time": self.t})
            self._b_dead = True
            self._reallocate_for("RoverB", b_bounds)

        rc = next((x for x in self.rovers if x.id == "RoverC"), None)
        if (
            rc
            and self.enable_second_failure
            and not self._c_dead
            and rc.state == "dead"
            and self._b_dead
        ):
            self.protocol_log.log("ROVER_DEAD", {"rover": "RoverC"}, sim_time_s=self.t)
            self.bus.emit({"type": "ROVER_DEAD", "rover": "RoverC", "sim_time": self.t})
            self._c_dead = True
            self._reallocate_for("RoverC", rc.sector)

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
        frame = webots_bridge.engine_to_track2_frame(self)
        self.snap.save(frame)
        return frame

    def reset(self, seed: Optional[int] = None) -> None:
        if seed is not None:
            self.seed = seed
            self.rng = random.Random(seed)
            self.cfg = FallenComradeConfig(seed=seed)
            self.fail = FailureConfig(
                stop_heartbeat_b=self.cfg.rover_b_comm_loss_start_s,
                stop_heartbeat_c=self.cfg.rover_c_comm_loss_start_s,
                heartbeat_timeout_s=self.cfg.heartbeat_timeout_s,
            )
            self.failure_engine = FailureEngine(self.fail)
        world = WorldGenerator(self.seed).generate()
        self.protocol_log.events.clear()
        self._apply_world(world)
        self.t = 0.0
        self.reallocated_flag = False
        self._b_dead = False
        self._c_dead = False
        self._dead_history.clear()
        self._realloc_events.clear()
        self.fox.cells.clear()
        self._emit_world_spawn()
