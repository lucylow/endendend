"""Persist deterministic replay slices to disk (hackathon / video tooling)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


def load_protocol_events(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return raw if isinstance(raw, list) else []


def write_replay_file(events: List[Dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.dumps(events, indent=2) + "\n"
    except (TypeError, ValueError) as e:
        raise ValueError(f"replay events are not JSON-serializable: {e}") from e
    try:
        path.write_text(payload, encoding="utf-8")
    except OSError as e:
        raise OSError(f"cannot write replay file {path}: {e}") from e


def blind_handoff_replay_path(root: Path) -> Path:
    return root / "data" / "worlds" / "blind_handoff_replays.json"
