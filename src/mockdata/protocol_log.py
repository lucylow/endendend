"""Append-only protocol log for demos, CI, and replay tooling."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


@dataclass
class ProtocolLogger:
    events: List[Dict[str, Any]] = field(default_factory=list)

    def log(self, event_type: str, payload: Dict[str, Any], *, sim_time_s: float | None = None) -> None:
        row: Dict[str, Any] = {
            "ts_wall": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "type": event_type,
            "payload": payload,
        }
        if sim_time_s is not None:
            row["sim_time_s"] = round(sim_time_s, 6)
        self.events.append(row)

    def dump(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.events, indent=2), encoding="utf-8")
