"""Lightweight pub/sub for scenario events (logging, UI hooks, tests)."""

from __future__ import annotations

from typing import Any, Callable, Dict, List

Subscriber = Callable[[Dict[str, Any]], None]


class EventBus:
    def __init__(self) -> None:
        self._subs: List[Subscriber] = []

    def subscribe(self, fn: Subscriber) -> None:
        self._subs.append(fn)

    def emit(self, event: Dict[str, Any]) -> None:
        for fn in list(self._subs):
            fn(event)
