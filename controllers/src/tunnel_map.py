"""Collective tunnel map (1 m cells along depth axis)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List


@dataclass
class TunnelMap:
    length_m: int
    cells: List[int] = field(init=False)

    def __post_init__(self) -> None:
        self.cells = [0] * max(1, int(self.length_m))

    def mark_explored(self, s0: float, s1: float, value: int = 2) -> None:
        a = max(0, min(len(self.cells) - 1, int(s0)))
        b = max(0, min(len(self.cells) - 1, int(s1)))
        if a > b:
            a, b = b, a
        for i in range(a, b + 1):
            self.cells[i] = max(self.cells[i], value)

    def merge(self, other: "TunnelMap") -> None:
        n = min(len(self.cells), len(other.cells))
        for i in range(n):
            self.cells[i] = max(self.cells[i], other.cells[i])

    def coverage(self) -> float:
        if not self.cells:
            return 0.0
        hit = sum(1 for c in self.cells if c >= 2)
        return hit / len(self.cells)

    def mark_targets(self, positions: Iterable[float]) -> None:
        for s in positions:
            i = max(0, min(len(self.cells) - 1, int(s)))
            self.cells[i] = max(self.cells[i], 4)
