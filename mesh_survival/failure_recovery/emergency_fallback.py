"""Local-only mode when mesh consensus is unavailable (blackout / full partition)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class EmergencyController:
    local_only: bool = False
    reason: str = ""

    def activate(self, reason: str) -> None:
        self.local_only = True
        self.reason = reason

    def clear(self) -> None:
        self.local_only = False
        self.reason = ""

    def should_broadcast_global(self) -> bool:
        return not self.local_only

    def scope_topic(self, base: str, subswarm_id: Optional[str]) -> str:
        if self.local_only and subswarm_id:
            return f"{base}/local/{subswarm_id}"
        return base
