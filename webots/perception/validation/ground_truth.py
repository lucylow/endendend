"""Simulated RTK + motion-capture ground truth for perception benchmarking."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np


@dataclass
class GroundTruthPublisher:
    """
    Forced GT at high rate: horizontal ~1 cm, vertical ~2 cm (RTK-style),
    plus optional sub-millimeter mocap jitter on top.
    """

    rtk_sigma_h_m: float = 0.01
    rtk_sigma_v_m: float = 0.02
    mocap_sigma_m: float = 0.0005
    mocap_sigma_deg: float = 0.05
    rng: Optional[np.random.Generator] = None

    def _g(self) -> np.random.Generator:
        return self.rng if self.rng is not None else np.random.default_rng()

    def noisy_pose(
        self,
        position_true_m: np.ndarray,
        yaw_true_rad: float,
        stamp_ns: int,
    ) -> Tuple[np.ndarray, float, np.ndarray]:
        g = self._g()
        p = np.asarray(position_true_m, dtype=np.float64).reshape(3)
        n_rtk = np.array(
            [
                g.normal(0.0, self.rtk_sigma_h_m),
                g.normal(0.0, self.rtk_sigma_v_m),
                g.normal(0.0, self.rtk_sigma_h_m),
            ],
            dtype=np.float64,
        )
        n_moc = g.normal(0.0, self.mocap_sigma_m, size=3)
        p_meas = p + n_rtk + 0.25 * n_moc
        yaw_meas = float(yaw_true_rad + np.deg2rad(g.normal(0.0, self.mocap_sigma_deg)))
        cov = np.diag(
            [
                self.rtk_sigma_h_m**2 + (0.25 * self.mocap_sigma_m) ** 2,
                self.rtk_sigma_v_m**2 + (0.25 * self.mocap_sigma_m) ** 2,
                self.rtk_sigma_h_m**2 + (0.25 * self.mocap_sigma_m) ** 2,
            ]
        ).astype(np.float64)
        _ = stamp_ns
        return p_meas, yaw_meas, cov


def pose_rmse(gt_traj: np.ndarray, est_traj: np.ndarray) -> float:
    """Root mean squared Euclidean error over (N,3) trajectories."""
    d = np.linalg.norm(gt_traj - est_traj, axis=1)
    return float(np.sqrt(np.mean(d * d)))
