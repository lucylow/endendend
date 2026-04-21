"""Caches the latest Track-2 JSON snapshot for bridges / recorders."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, Optional

if TYPE_CHECKING:
    from mockdata.handoff_engine import BlindHandoffEngine

from mockdata.handoff_webots_bridge import handoff_engine_to_track2_frame


class SnapshotStore:
    def __init__(self) -> None:
        self.last_snapshot: Optional[Dict[str, Any]] = None

    def save(self, frame: Dict[str, Any]) -> None:
        """Used by `MockDataEngine` (Fallen Comrade) each tick."""
        self.last_snapshot = frame

    def build(self, engine: "BlindHandoffEngine") -> Dict[str, Any]:
        """Build a browser/Webots frame from the blind handoff engine."""
        try:
            snap = handoff_engine_to_track2_frame(engine)
            self.last_snapshot = snap
            return snap
        except Exception:
            if self.last_snapshot is not None:
                return self.last_snapshot
            raise
