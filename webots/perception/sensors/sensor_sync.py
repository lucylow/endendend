#!/usr/bin/env python3
"""
Hardware-timestamped multi-sensor synchronization.

Provides ``SensorSynchronizer`` (buffer + fuse window) and small helpers
``SensorClock`` / ``align_stamp`` for deterministic replay alignment.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from queue import Empty, PriorityQueue
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class SensorData:
    timestamp_ns: int
    sensor_type: str
    data: Any
    frame_id: int


class SensorClock:
    """Monotonic period from nominal rate (for stamping synthetic sensors)."""

    def __init__(self, rate_hz: float) -> None:
        self.period_ns = int(round(1e9 / max(rate_hz, 1e-6)))

    def tick(self, index: int, t0_ns: int) -> int:
        return int(t0_ns + index * self.period_ns)


def align_stamp(stamp_ns: int, ref_stamp_ns: int, max_skew_ns: int) -> bool:
    """True if ``stamp_ns`` is within ``max_skew_ns`` of ``ref_stamp_ns``."""
    return abs(int(stamp_ns) - int(ref_stamp_ns)) <= int(max_skew_ns)


class SensorSynchronizer:
    """Buffer per-sensor readings and fuse by nearest-neighbor inside a window."""

    def __init__(self, max_latency_ns: int = 25_000_000) -> None:
        self.sensor_queues: Dict[str, deque[SensorData]] = {}
        self.fusion_queue: PriorityQueue[tuple[int, Dict[str, SensorData]]] = PriorityQueue()
        self.max_latency_ns = max_latency_ns
        self._lock = threading.Lock()

    def register_sensor(self, sensor_name: str) -> None:
        self.sensor_queues[sensor_name] = deque(maxlen=100)

    def push_data(self, sensor_name: str, data: SensorData) -> None:
        if sensor_name not in self.sensor_queues:
            self.register_sensor(sensor_name)
        with self._lock:
            self.sensor_queues[sensor_name].append(data)
            if self._check_fusion_ready():
                self._fuse_frame()

    def _check_fusion_ready(self) -> bool:
        now_ns = time.time_ns()
        window_start = now_ns - self.max_latency_ns
        for queue in self.sensor_queues.values():
            recent = [d for d in queue if d.timestamp_ns >= window_start]
            if not recent:
                return False
        return True

    def _fuse_frame(self) -> None:
        now_ns = time.time_ns()
        window_start = now_ns - self.max_latency_ns
        fused: Dict[str, SensorData] = {}
        for sensor_name, queue in self.sensor_queues.items():
            candidates = [d for d in queue if window_start <= d.timestamp_ns <= now_ns]
            if not candidates:
                return
            closest = min(candidates, key=lambda d: abs(d.timestamp_ns - now_ns))
            fused[sensor_name] = closest
        if len(fused) != len(self.sensor_queues):
            return
        fusion_ts = min(d.timestamp_ns for d in fused.values())
        self.fusion_queue.put((fusion_ts, fused))

    def get_fused_frame(self, timeout_s: float = 0.05) -> Optional[SensorData]:
        try:
            ts, frame = self.fusion_queue.get(timeout=timeout_s)
            return SensorData(ts, "fused", frame, 0)
        except Empty:
            return None


if __name__ == "__main__":
    sync = SensorSynchronizer()
    sync.register_sensor("lidar")
    sync.register_sensor("camera")
    sync.register_sensor("imu")
    t0 = time.time_ns()
    sync.push_data("lidar", SensorData(t0, "lidar", {"ranges": 1}, 0))
    sync.push_data("camera", SensorData(t0 + 500_000, "camera", {"image": 2}, 1))
    sync.push_data("imu", SensorData(t0 + 200_000, "imu", {"w": 3}, 2))
    fused = sync.get_fused_frame()
    print("fused:", fused)
    clk = SensorClock(200.0)
    print("align:", align_stamp(clk.tick(3, t0), t0 + clk.period_ns * 3, 50_000))
