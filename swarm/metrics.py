"""Lightweight metrics collector for swarm coordination observability.

Provides counters, histograms, and a serialisable summary for dashboards.
Thread-safe — safe to call from multiple drone controllers or scenario runners.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple


class Metrics:
    """Accumulates counters and time-windowed histograms."""

    def __init__(self, window_sec: float = 60.0) -> None:
        self._lock = threading.Lock()
        self._counters: Dict[str, int] = defaultdict(int)
        self._histograms: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
        self._window = window_sec

    # -- Counters ----------------------------------------------------------

    def inc(self, name: str, value: int = 1) -> None:
        with self._lock:
            self._counters[name] += value

    def get_counter(self, name: str) -> int:
        with self._lock:
            return self._counters.get(name, 0)

    # -- Histograms --------------------------------------------------------

    def record(self, name: str, value: float) -> None:
        with self._lock:
            self._histograms[name].append((time.time(), value))

    def _recent(self, name: str) -> List[float]:
        cutoff = time.time() - self._window
        entries = self._histograms.get(name, [])
        return [v for t, v in entries if t >= cutoff]

    # -- Summary -----------------------------------------------------------

    def get_summary(self) -> Dict[str, Any]:
        with self._lock:
            out: Dict[str, Any] = {}
            for k, v in self._counters.items():
                out[k] = v
            for k in self._histograms:
                recent = self._recent(k)
                if recent:
                    out[f"{k}_avg"] = sum(recent) / len(recent)
                    out[f"{k}_max"] = max(recent)
                    out[f"{k}_min"] = min(recent)
                    out[f"{k}_count"] = len(recent)
            return out

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._histograms.clear()


# Module-level singleton for convenience
_global: Optional[Metrics] = None
_init_lock = threading.Lock()


def get_metrics() -> Metrics:
    global _global
    if _global is None:
        with _init_lock:
            if _global is None:
                _global = Metrics()
    return _global
