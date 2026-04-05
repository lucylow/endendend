"""
FoxMQ client wrapper for a replicated world map (hackathon reference).

Install the official FoxMQ / Tashi Python client for your environment, then
uncomment the real `foxmq` import and `connect()` implementation.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

import config

logger = logging.getLogger(__name__)

try:
    import foxmq  # type: ignore
except ImportError:
    foxmq = None  # type: ignore


class FoxMQClient:
    """Wrapper for FoxMQ distributed key-value store."""

    def __init__(self, node_id: str, host: str = config.FOXMQ_HOST, port: int = config.FOXMQ_PORT):
        self.node_id = node_id
        self.host = host
        self.port = port
        self.client = None
        self.connected = False
        self._callbacks: Dict[str, List[Callable[[str, Any], None]]] = {}

    def connect(self) -> None:
        if not foxmq:
            raise RuntimeError("FoxMQ library not found. Install the Tashi/FoxMQ Python package.")
        self.client = foxmq.Client(self.host, self.port)
        self.client.connect()
        self.connected = True
        logger.info("FoxMQ client connected for %s", self.node_id)

    def put(self, key: str, value: Any, ttl: Optional[float] = None, token: Optional[str] = None) -> None:
        if config.FOXMQ_AUTH_TOKEN and token != config.FOXMQ_AUTH_TOKEN:
            raise PermissionError("invalid FoxMQ auth token")
        if not self.connected:
            raise RuntimeError("Not connected")
        data = json.dumps(value)
        self.client.put(key, data, ttl=ttl)

    def get(self, key: str, default: Any = None) -> Any:
        if not self.connected:
            return default
        data = self.client.get(key)
        if data is None:
            return default
        return json.loads(data)

    def compare_and_swap(self, key: str, expected: Any, next_value: Any, token: Optional[str] = None) -> bool:
        """Atomic merge-friendly update when the broker supports CAS."""
        if config.FOXMQ_AUTH_TOKEN and token != config.FOXMQ_AUTH_TOKEN:
            raise PermissionError("invalid FoxMQ auth token")
        if not self.connected:
            return False
        if hasattr(self.client, "compare_and_swap"):
            return bool(self.client.compare_and_swap(key, json.dumps(expected), json.dumps(next_value)))
        # Fallback: optimistic read-modify-write (not linearizable).
        cur = self.get(key, None)
        if json.dumps(cur, sort_keys=True) != json.dumps(expected, sort_keys=True):
            return False
        self.put(key, next_value, token=token)
        return True

    def subscribe(self, key: str, callback: Callable[[str, Any], None]) -> None:
        if not self.connected:
            return
        if key not in self._callbacks:
            self._callbacks[key] = []
            self.client.watch(key, self._on_change)
        self._callbacks[key].append(callback)

    def _on_change(self, key: str, data: Optional[str]) -> None:
        value = json.loads(data) if data else None
        for cb in self._callbacks.get(key, []):
            cb(key, value)
