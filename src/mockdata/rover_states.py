"""Stateful rovers with heartbeat, exploration marks, and simple kinematics."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple

from mockdata.exploration import try_mark_explored
from mockdata.utils import cells_from_footprint

from mockdata.sectorizer import Bounds, sector_center

Vec3 = Tuple[float, float, float]


@dataclass
class RoverState:
    id: str
    sector: Bounds
    state: str = "exploring"  # exploring | dead | reallocating
    position: Vec3 = (0.0, 0.5, 0.0)
    battery: float = 100.0
    heartbeat: float = 0.0  # last simulation time (seconds) with a successful heartbeat
    explored_cells: Set[Tuple[int, int]] = field(default_factory=set)
    speed: float = 1.2
    task: str = "patrol"
    assigned_victims: List[str] = field(default_factory=list)
    _target: Vec3 | None = None

    def __post_init__(self) -> None:
        if self.position == (0.0, 0.5, 0.0):
            self.position = sector_center(self.sector)

    def touch_heartbeat(self, sim_t: float) -> None:
        if self.state != "dead":
            self.heartbeat = sim_t

    def mark_explored(self, grid_cells: List[Tuple[int, int]]) -> None:
        for c in grid_cells:
            self.explored_cells.add(c)

    def set_target_near(self, bounds: Bounds, rng: float) -> None:
        """Pick a random target inside bounds (rng = deterministic hash substitute)."""
        xmin, xmax, zmin, zmax = bounds
        # use simple LCG-ish mix from rng float
        u = (math.sin(rng * 12.9898) * 43758.5453) % 1.0
        v = (math.cos(rng * 78.233) * 12345.6789) % 1.0
        u = abs(u)
        v = abs(v)
        x = xmin + 2 + u * max(0.1, (xmax - xmin - 4))
        z = zmin + 2 + v * max(0.1, (zmax - zmin - 4))
        self._target = (x, 0.5, z)

    def update_exploring(
        self,
        dt: float,
        bounds: Bounds,
        t_clock: float,
        grid_coverage: Optional[Set[Tuple[int, int]]] = None,
    ) -> List[Tuple[int, int]]:
        self.touch_heartbeat(t_clock)
        self.task = "patrol"
        self.battery = max(0.0, self.battery - 0.02 * dt * (0.4 + 0.1 * math.sin(t_clock)))
        if self._target is None:
            self.set_target_near(bounds, t_clock + hash(self.id) % 997 / 997.0)
        tx, _, tz = self._target  # type: ignore[misc]
        px, py, pz = self.position
        dx, dz = tx - px, tz - pz
        dist = math.hypot(dx, dz) or 1e-6
        step = min(self.speed * dt, dist)
        self.position = (px + dx / dist * step, py, pz + dz / dist * step)
        if dist < 0.75:
            self._target = None
        gx = int(round(self.position[0] - 0.5))
        gz = int(round(self.position[2] - 0.5))
        newly: List[Tuple[int, int]] = []
        if grid_coverage is not None:
            for cell in cells_from_footprint(gx, gz, 1):
                if try_mark_explored(self, cell, grid_coverage):
                    newly.append(cell)
        else:
            for cell in cells_from_footprint(gx, gz, 1):
                if cell not in self.explored_cells:
                    self.explored_cells.add(cell)
                    newly.append(cell)
        return newly

    def heartbeat_stale(self, sim_now: float, timeout_s: float = 3.0) -> bool:
        if self.state == "dead":
            return False
        return (sim_now - self.heartbeat) > timeout_s
