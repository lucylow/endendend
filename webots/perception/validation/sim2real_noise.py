"""Domain randomization hooks for camera/LiDAR/IMU (training-time style)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np


@dataclass
class Sim2RealNoise:
    rng: Optional[np.random.Generator] = None

    def _g(self) -> np.random.Generator:
        return self.rng if self.rng is not None else np.random.default_rng()

    def lidar_scale_noise(self) -> Tuple[float, float]:
        """Returns (range_sigma_scale_mul, dropout_scale_mul)."""
        g = self._g()
        return float(g.uniform(0.85, 1.15)), float(g.uniform(0.8, 1.2))

    def imu_bias_walk(self, bg: np.ndarray, ba: np.ndarray, dt: float) -> Tuple[np.ndarray, np.ndarray]:
        g = self._g()
        return bg + g.normal(0.0, 1e-5, size=3) * dt, ba + g.normal(0.0, 2e-4, size=3) * dt

    def camera_exposure_jitter(self, image: np.ndarray) -> np.ndarray:
        """Simple multiplicative gain + read noise on float/uint8 images."""
        img = np.asarray(image, dtype=np.float32)
        g = self._g()
        gain = float(g.uniform(0.9, 1.1))
        out = np.clip(img * gain + g.normal(0.0, 1.5, size=img.shape), 0.0, 255.0)
        return out.astype(image.dtype, copy=False)
