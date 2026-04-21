"""Global coverage ledger: first rover to visit a cell owns the exploration credit."""

from __future__ import annotations

from typing import TYPE_CHECKING, Set, Tuple

if TYPE_CHECKING:
    from mockdata import rover_states

Cell = Tuple[int, int]


def try_mark_explored(rover: "rover_states.RoverState", cell: Cell, grid_coverage: Set[Cell]) -> bool:
    if cell in grid_coverage:
        return False
    grid_coverage.add(cell)
    rover.explored_cells.add(cell)
    return True
