"""Lightweight pub/sub for optional live UI hooks (same process)."""

from __future__ import annotations

from typing import Any, Callable, Dict, List

Listener = Callable[[Dict[str, Any]], None]


class HandoffEventBus:
    def __init__(self) -> None:
        self._listeners: List[Listener] = []

    def subscribe(self, fn: Listener) -> None:
        self._listeners.append(fn)

    def emit(self, event: Dict[str, Any]) -> None:
        for fn in list(self._listeners):
            fn(event)
