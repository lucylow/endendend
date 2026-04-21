#!/usr/bin/env python3
"""Run quick perception benchmark (latency + pose RMSE vs simulator truth)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from webots.perception.validation.perception_benchmark import PerceptionBenchmark  # noqa: E402


def main() -> None:
    b = PerceptionBenchmark(seed=42)
    r = b.run_quick(steps=300)
    print(f"p50 latency ms: {r.fusion_latency_ms_p50:.3f}")
    print(f"p99 latency ms: {r.fusion_latency_ms_p99:.3f}")
    print(f"pose RMSE m (vs true traj): {r.pose_rmse_m:.4f}")


if __name__ == "__main__":
    main()
