"""Persist deterministic replay slices to disk (hackathon / video tooling)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


def write_replay_file(events: List[Dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(events, indent=2) + "\n", encoding="utf-8")


def blind_handoff_replay_path(root: Path) -> Path:
    return root / "data" / "worlds" / "blind_handoff_replays.json"
