"""Append-only protocol log for replay / judge demos."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class ProtocolLogger:
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []

    def log(self, event_type: str, payload: Dict[str, Any], *, sim_time_s: Optional[float] = None) -> None:
        row: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "type": event_type,
            "payload": payload,
        }
        if sim_time_s is not None:
            row["sim_time_s"] = float(sim_time_s)
        self.events.append(row)

    def dump(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.events, indent=2) + "\n", encoding="utf-8")
