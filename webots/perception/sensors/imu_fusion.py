"""IMU noise specs and alias for multi-sensor EKF (XSens-class defaults)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .ekf_fusion import SwarmEKF


@dataclass
class ImuNoiseSpec:
    """Bias magnitudes for simulation injection (not identical to EKF process noise)."""

    gyro_bias_deg_s: float = 0.5
    accel_bias_g: float = 0.1
    rng: np.random.Generator | None = None

    def gyro_bias_rad_s(self) -> float:
        return float(np.deg2rad(self.gyro_bias_deg_s))

    def accel_bias_mps2(self) -> float:
        return float(self.accel_bias_g * 9.80665)

    def sample_constant_bias(self) -> tuple[np.ndarray, np.ndarray]:
        g = self.rng if self.rng is not None else np.random.default_rng()
        bg = g.normal(0.0, self.gyro_bias_rad_s(), size=3)
        ba = g.normal(0.0, self.accel_bias_mps2(), size=3)
        return bg.astype(np.float64), ba.astype(np.float64)


MultiSensorEKF = SwarmEKF

__all__ = ["ImuNoiseSpec", "MultiSensorEKF", "SwarmEKF"]
