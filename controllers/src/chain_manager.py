"""Ordered daisy chain bookkeeping (entrance → relays → lead)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ChainManager:
    """Stores Webots node ids along the backbone (excluding virtual entrance)."""

    chain_path: List[str] = field(default_factory=list)

    def set_from_plan(self, path: List[str]) -> None:
        self.chain_path = [p for p in path if p != "entrance"]
