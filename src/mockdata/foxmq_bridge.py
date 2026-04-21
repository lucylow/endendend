"""File-backed shared exploration ledger (FoxMQ stand-in for demos and restarts)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Set, Tuple

Cell = Tuple[int, int]


class FoxMqExploredBridge:
    def __init__(self, state_path: Path | None = None) -> None:
        self.state_path = state_path
        self.cells: Set[Cell] = set()
        if state_path and state_path.exists():
            try:
                raw = json.loads(state_path.read_text(encoding="utf-8"))
                for item in raw.get("cells", []):
                    if isinstance(item, (list, tuple)) and len(item) == 2:
                        self.cells.add((int(item[0]), int(item[1])))
            except (json.JSONDecodeError, OSError, ValueError):
                pass

    def merge(self, cells: Iterable[Cell]) -> None:
        for c in cells:
            self.cells.add(c)

    def sync_fs(self) -> None:
        if not self.state_path:
            return
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"cells": [list(c) for c in sorted(self.cells)]}
        self.state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
