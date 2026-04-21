#!/usr/bin/env python3
"""Minimal judge demo: print one fused perception cycle + GMM merge sizes."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from webots.perception.mapping.gmm_map_fusion import GmmMapFusion  # noqa: E402
from webots.perception.pipeline import PerceptionPipeline  # noqa: E402


def main() -> None:
    pipe = PerceptionPipeline(dust=True)
    out = pipe.step(
        stamp_ns=1_000_000_000,
        imu=np.array([0.0, 0.0, 9.81, 0.0, 0.0, 0.01]),
        lidar_ranges=np.linspace(2.0, 8.0, 1080),
        true_position_m=np.array([1.0, 0.5, -2.0]),
        true_yaw_rad=0.1,
    )
    slim = {k: v for k, v in out.items() if k != "mapping"}
    print("pipeline:", {k: (v.tolist() if hasattr(v, "tolist") else v) for k, v in slim.items()})
    if out.get("mapping"):
        m = out["mapping"]
        print(
            "mapping:",
            m["world_cloud_points"],
            "pts →",
            m["gmm_map_components"],
            "GMM comps, pose_graph_vid",
            m["pose_graph_vertex_id"],
        )
    gmm = GmmMapFusion()
    xyz = np.random.default_rng(0).normal(size=(500, 3)) * 0.2 + np.array([1.0, 0.0, -2.0])
    comp = gmm.fit_local(xyz, k=16)
    fused = gmm.merge([comp, comp])
    print("gmm_components:", len(fused.components))


if __name__ == "__main__":
    main()
