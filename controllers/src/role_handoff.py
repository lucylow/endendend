"""Role transitions when a relay drops (auto recovery)."""

from __future__ import annotations

from typing import List, Set


def remove_failed_from_chain(chain_path: List[str], failed_id: str) -> List[str]:
    return [x for x in chain_path if x != failed_id]


def next_standby_for_gap(
    candidates: List[str],
    occupied: Set[str],
    scorer,
) -> str | None:
    best: str | None = None
    best_v = -1.0
    for c in candidates:
        if c in occupied:
            continue
        v = scorer(c)
        if v > best_v:
            best_v = v
            best = c
    return best
