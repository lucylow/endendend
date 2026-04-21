"""In-proc queue stand-in for FoxMQ (see also ``foxmq_bridge`` at package root)."""

from __future__ import annotations

from collections import deque
from typing import Any, Deque, Dict


class FoxMqBridge:
    def __init__(self, maxlen: int = 256) -> None:
        self._q: Deque[Dict[str, Any]] = deque(maxlen=maxlen)

    def publish(self, topic: str, payload: Dict[str, Any]) -> None:
        self._q.append({"topic": topic, "payload": payload})

    def drain(self) -> list:
        out = list(self._q)
        self._q.clear()
        return out
