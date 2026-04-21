"""Aggregate metrics + JSONL overlay stream for dashboards / replay."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from .pipeline import PerceptionPipeline
from .vertex_bridge import VertexPerceptionBridge


@dataclass
class LiveMetrics:
    fusion_latency_ms: float = 0.0
    point_count: int = 0
    position_error_m: float = 0.0


class PerceptionSupervisor:
    def __init__(self, log_path: Optional[Path] = None) -> None:
        self.pipe = PerceptionPipeline()
        self.bridge = VertexPerceptionBridge()
        self.log_path = log_path
        self._history: List[Dict[str, Any]] = []

    def tick(
        self,
        agent_id: str,
        stamp_ns: int,
        imu: np.ndarray,
        lidar_ranges: Optional[np.ndarray],
        true_position_m: np.ndarray,
        true_yaw_rad: float,
    ) -> LiveMetrics:
        t0 = time.perf_counter()
        out = self.pipe.step(
            stamp_ns=stamp_ns,
            imu=imu,
            lidar_ranges=lidar_ranges,
            true_position_m=true_position_m,
            true_yaw_rad=true_yaw_rad,
        )
        lat = (time.perf_counter() - t0) * 1000.0
        m = LiveMetrics(
            fusion_latency_ms=float(lat),
            point_count=int(out["point_count"]),
            position_error_m=float(out["position_error_m"]),
        )
        def _jsonify(obj: Any) -> Any:
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, dict):
                return {k: _jsonify(v) for k, v in obj.items()}
            return obj

        row = {"agent": agent_id, "metrics": asdict(m), "out": _jsonify(out)}
        self._history.append(row)
        if self.log_path is not None:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
        return m
