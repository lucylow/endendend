"""Append-only JSONL replay log for simulation steps and mission events."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, TextIO


@dataclass
class ReplayEntry:
    wall_time: float
    sim_time: float
    scenario: str
    snapshot: Dict[str, Any]
    events: List[Dict[str, Any]]


class ReplayLogger:
    def __init__(self, path: Path, scenario: str) -> None:
        self.path = Path(path)
        self.scenario = scenario
        self._fh: Optional[TextIO] = None

    def open(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = self.path.open("a", encoding="utf-8")

    def close(self) -> None:
        if self._fh:
            self._fh.close()
            self._fh = None

    def log(self, sim_time: float, snapshot: Dict[str, Any], events: Optional[List[Dict[str, Any]]] = None) -> None:
        if not self._fh:
            self.open()
        assert self._fh is not None
        row = {
            "wall_time": time.time(),
            "sim_time": sim_time,
            "scenario": self.scenario,
            "snapshot": snapshot,
            "events": events or [],
        }
        self._fh.write(json.dumps(row, separators=(",", ":")) + "\n")
        self._fh.flush()

    def __enter__(self) -> "ReplayLogger":
        self.open()
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


def read_replay(path: Path) -> Iterable[Dict[str, Any]]:
    with Path(path).open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)
