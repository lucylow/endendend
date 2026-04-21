"""Split a dead rover's axis-aligned sector among survivors (equal strips along X)."""

from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from mockdata.sectorizer import Bounds

SurvivorId = str


def bounds_union(a: Bounds, b: Bounds) -> Bounds:
    return (
        min(a[0], b[0]),
        max(a[1], b[1]),
        min(a[2], b[2]),
        max(a[3], b[3]),
    )


def reallocate_dead_sector(
    dead_bounds: Bounds,
    survivors: Iterable[SurvivorId],
    current_bounds: Dict[SurvivorId, Bounds],
) -> Dict[SurvivorId, Bounds]:
    """
    Partition dead_bounds along X into len(survivors) equal strips and union each
    strip with that survivor's existing sector so exploration ownership stays coherent.
    """
    ids: List[SurvivorId] = list(survivors)
    n = len(ids)
    if n == 0:
        return dict(current_bounds)
    xmin, xmax, zmin, zmax = dead_bounds
    width = xmax - xmin
    step = width / float(n)
    out = {k: v for k, v in current_bounds.items() if k in ids}
    for i, sid in enumerate(ids):
        x0 = xmin + i * step
        x1 = xmin + (i + 1) * step
        strip: Bounds = (x0, x1, zmin, zmax)
        out[sid] = bounds_union(out.get(sid, strip), strip)
    return out
