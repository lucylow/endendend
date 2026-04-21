"""Automated latency + pose error metrics for the perception pipeline."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from ..pipeline import PerceptionPipeline
from .ground_truth import GroundTruthPublisher, pose_rmse


@dataclass
class BenchmarkReport:
    fusion_latency_ms_p50: float = 0.0
    fusion_latency_ms_p99: float = 0.0
    pose_rmse_m: float = 0.0
    extras: Dict[str, Any] = field(default_factory=dict)


class PerceptionBenchmark:
    def __init__(self, seed: int = 0) -> None:
        self.rng = np.random.default_rng(seed)
        self.gt = GroundTruthPublisher(rng=self.rng)

    def run_quick(self, steps: int = 200) -> BenchmarkReport:
        pipe = PerceptionPipeline(rng=self.rng, enable_local_mapping=False)
        lat: List[float] = []
        true_hist: List[np.ndarray] = []
        est_pos: List[np.ndarray] = []
        true_p = np.array([0.0, 1.0, 0.5])
        true_yaw = 0.0
        for i in range(steps):
            t0 = time.perf_counter()
            stamp = int(i * 5_000_000)
            true_p = true_p + np.array([0.01, 0.0, 0.0]) * np.sin(i / 20.0)
            imu = np.array([0.0, 0.0, 9.81, 0.0, 0.0, 0.02], dtype=np.float64)
            scan = np.full(400, 5.0 + 0.05 * np.sin(i / 10.0), dtype=np.float64)
            out = pipe.step(
                stamp_ns=stamp,
                imu=imu,
                lidar_ranges=scan,
                true_position_m=true_p,
                true_yaw_rad=true_yaw,
            )
            lat.append((time.perf_counter() - t0) * 1000.0)
            _ = self.gt.noisy_pose(true_p, true_yaw, stamp)
            true_hist.append(true_p.copy())
            est_pos.append(np.asarray(out["fused_position_m"], dtype=np.float64).reshape(3))
        lat_sorted = sorted(lat)
        p99 = lat_sorted[int(0.99 * (len(lat_sorted) - 1))]
        p50 = lat_sorted[len(lat_sorted) // 2]
        rmse = pose_rmse(np.stack(true_hist), np.stack(est_pos))
        return BenchmarkReport(
            fusion_latency_ms_p50=float(p50),
            fusion_latency_ms_p99=float(p99),
            pose_rmse_m=float(rmse),
            extras={"steps": steps},
        )


if __name__ == "__main__":
    b = PerceptionBenchmark()
    r = b.run_quick(120)
    print(r)
