"""RGB-D + depth filtering hooks; ONNX YOLO remains in ``endendend_vision`` for ROS runtime."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np


def bilateral_filter_depth(depth_m: np.ndarray, sigma_space: float = 2.0, sigma_range: float = 0.05) -> np.ndarray:
    """Lightweight separable approximation: Gaussian on depth + range weight (CPU-friendly)."""
    d = np.asarray(depth_m, dtype=np.float64, copy=True)
    if d.size == 0:
        return d
    flat = d.reshape(-1)
    out = flat.copy()
    n = flat.size
    for i in range(n):
        lo, hi = max(0, i - 3), min(n, i + 4)
        wsum = 0.0
        acc = 0.0
        for j in range(lo, hi):
            ds = abs(flat[j] - flat[i])
            ws = float(np.exp(-0.5 * ((i - j) / sigma_space) ** 2))
            wr = float(np.exp(-0.5 * (ds / sigma_range) ** 2))
            w = ws * wr
            acc += w * flat[j]
            wsum += w
        out[i] = acc / max(wsum, 1e-9)
    return out.reshape(depth_m.shape)


@dataclass
class RealSenseD455Config:
    width: int = 1280
    height: int = 720
    fx: float = 600.0
    fy: float = 600.0
    cx: float = 640.0
    cy: float = 360.0


class CameraPerceptionPipeline:
    """Depth → 3D rays; RGB path is delegated to ROS ``Yolov8OnnxDetector`` in production."""

    def __init__(self, cfg: Optional[RealSenseD455Config] = None) -> None:
        self.cfg = cfg or RealSenseD455Config()

    def depth_to_points(self, depth_m: np.ndarray, subsample: int = 4) -> np.ndarray:
        """Unproject central crop with optional subsampling; returns (N,3) in camera frame."""
        d = bilateral_filter_depth(np.asarray(depth_m, dtype=np.float64))
        h, w = d.shape
        xs = np.arange(0, w, subsample)
        ys = np.arange(0, h, subsample)
        pts: list[np.ndarray] = []
        c = self.cfg
        for y in ys:
            for x in xs:
                z = float(d[int(y), int(x)])
                if z <= 0.05 or z > 40.0:
                    continue
                x3 = (float(x) - c.cx) / c.fx * z
                y3 = (float(y) - c.cy) / c.fy * z
                pts.append(np.array([x3, y3, z], dtype=np.float64))
        if not pts:
            return np.zeros((0, 3), dtype=np.float64)
        return np.stack(pts, axis=0)
