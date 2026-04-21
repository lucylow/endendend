"""JSON snapshots for polling, recording, and frontend hydration."""

from __future__ import annotations

from typing import Any, Dict, Optional


class SnapshotStore:
    def __init__(self) -> None:
        self.last: Optional[Dict[str, Any]] = None

    def save(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        self.last = snapshot
        return snapshot
