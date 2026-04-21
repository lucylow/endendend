"""Signal-aware mock Vertex hop (probabilistic delivery)."""

from __future__ import annotations

import logging
import random
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class MockVertexNode:
    def __init__(self, node_id: str, rng: random.Random) -> None:
        self.id = node_id
        self.rng = rng
        self._rx: Optional[Callable[[Dict[str, Any]], None]] = None

    def on_receive(self, cb: Callable[[Dict[str, Any]], None]) -> None:
        self._rx = cb

    def send(self, quality_loss: float, target_id: str, msg: Dict[str, Any]) -> bool:
        if self.rng.random() > quality_loss:
            logger.info("delivered %s -> %s type=%s", self.id, target_id, msg.get("type"))
            return True
        logger.warning("lost %s -> %s", self.id, target_id)
        return False
