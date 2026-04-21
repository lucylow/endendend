"""MQTT publish pacing with capped exponential backoff + jitter."""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class FoxMQBackoff:
    base_sec: float = 0.05
    max_sec: float = 30.0
    multiplier: float = 2.0
    _attempt: int = 0
    _next_ok_mono: float = 0.0

    def reset(self) -> None:
        self._attempt = 0
        self._next_ok_mono = 0.0

    def on_success(self) -> None:
        self._attempt = max(0, self._attempt - 1)

    def on_failure(self) -> None:
        self._attempt += 1
        raw = min(self.max_sec, self.base_sec * (self.multiplier ** self._attempt))
        jitter = random.uniform(0.0, self.base_sec)
        self._next_ok_mono = time.monotonic() + raw + jitter

    def wait_if_needed(self, *, now_mono: Optional[float] = None) -> float:
        """Sleep until next publish slot; returns seconds slept."""
        t = time.monotonic() if now_mono is None else float(now_mono)
        delay = max(0.0, self._next_ok_mono - t)
        if delay > 0:
            time.sleep(delay)
        return delay


def mqtt_publish_delay(attempt: int, *, base: float = 0.05, cap: float = 30.0) -> float:
    """Pure delay function for schedulers that do not want side effects."""
    return min(cap, base * (2.0 ** max(0, attempt))) + random.uniform(0.0, base)
