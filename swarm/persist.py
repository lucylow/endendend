"""Persist exploration map snapshots (optional recovery after restart)."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Set, Tuple

DEFAULT_PATH = os.environ.get("SWARM_EXPLORATION_PATH", "exploration_state.json")

Cell = Tuple[int, int]


def save_exploration_state(path: str, explored: Set[Cell], node_id: str) -> None:
    payload = {
        "node_id": node_id,
        "explored_cells": [[c[0], c[1]] for c in explored],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def load_exploration_cells(path: str = DEFAULT_PATH) -> List[Cell]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        data: Dict[str, Any] = json.load(f)
    out: List[Cell] = []
    for item in data.get("explored_cells", []):
        if isinstance(item, (list, tuple)) and len(item) == 2:
            out.append((int(item[0]), int(item[1])))
    return out
