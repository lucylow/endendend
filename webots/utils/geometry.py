"""2D geometry helpers for arena bounds, sectors, and overlap checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple


@dataclass(frozen=True)
class Vec2:
    x: float
    z: float

    def __add__(self, o: "Vec2") -> "Vec2":
        return Vec2(self.x + o.x, self.z + o.z)

    def __sub__(self, o: "Vec2") -> "Vec2":
        return Vec2(self.x - o.x, self.z - o.z)


@dataclass(frozen=True)
class Rect:
    """Axis-aligned rectangle in XZ (Webots floor plane)."""

    min_x: float
    max_x: float
    min_z: float
    max_z: float

    @property
    def width(self) -> float:
        return self.max_x - self.min_x

    @property
    def depth(self) -> float:
        return self.max_z - self.min_z

    def center(self) -> Vec2:
        return Vec2((self.min_x + self.max_x) / 2, (self.min_z + self.max_z) / 2)

    def contains(self, p: Vec2) -> bool:
        return self.min_x <= p.x <= self.max_x and self.min_z <= p.z <= self.max_z

    def overlaps(self, o: "Rect") -> bool:
        return not (
            self.max_x < o.min_x
            or o.max_x < self.min_x
            or self.max_z < o.min_z
            or o.max_z < self.min_z
        )


def distance(a: Vec2, b: Vec2) -> float:
    dx, dz = a.x - b.x, a.z - b.z
    return (dx * dx + dz * dz) ** 0.5


def split_stripes_along_x(arena: Rect, count: int) -> List[Rect]:
    """Divide arena into ``count`` vertical stripes (constant Z span)."""
    w = arena.width / count
    out: List[Rect] = []
    for i in range(count):
        min_x = arena.min_x + i * w
        out.append(Rect(min_x, min_x + w, arena.min_z, arena.max_z))
    return out


def grid_cells(arena: Rect, cols: int, rows: int) -> List[Rect]:
    cw, rh = arena.width / cols, arena.depth / rows
    cells: List[Rect] = []
    for r in range(rows):
        for c in range(cols):
            min_x = arena.min_x + c * cw
            min_z = arena.min_z + r * rh
            cells.append(Rect(min_x, min_x + cw, min_z, min_z + rh))
    return cells


def grid_partition(
    arena: Rect,
    cols: int,
    rows: int,
    rng,
    block_fraction: float,
) -> Tuple[List[Rect], List[Rect]]:
    """Return (free_cells, blocked_cells) using deterministic ``rng``."""
    cells = grid_cells(arena, cols, rows)
    n_block = int(round(len(cells) * block_fraction))
    idx = list(range(len(cells)))
    rng.shuffle(idx)
    blocked = {idx[i] for i in range(min(n_block, len(idx)))}
    free = [cells[i] for i in range(len(cells)) if i not in blocked]
    blocked_cells = [cells[i] for i in blocked]
    return free, blocked_cells


def rects_no_overlap(candidates: Sequence[Rect], min_margin: float = 0.5) -> bool:
    inflated = [
        Rect(r.min_x - min_margin, r.max_x + min_margin, r.min_z - min_margin, r.max_z + min_margin)
        for r in candidates
    ]
    for i, a in enumerate(inflated):
        for b in inflated[i + 1 :]:
            if a.overlaps(b):
                return False
    return True


def clamp_to_rect(p: Vec2, r: Rect) -> Vec2:
    return Vec2(max(r.min_x, min(r.max_x, p.x)), max(r.min_z, min(r.max_z, p.z)))


def polygon_centroid(points: Iterable[Vec2]) -> Vec2:
    pts = list(points)
    if not pts:
        return Vec2(0.0, 0.0)
    sx = sum(p.x for p in pts)
    sz = sum(p.z for p in pts)
    n = len(pts)
    return Vec2(sx / n, sz / n)
