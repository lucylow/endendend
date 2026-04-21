#!/usr/bin/env python3
"""
16-state IMU EKF: position, velocity, quaternion, gyro bias (3), accel bias (3).

Predict: body-frame IMU; update: position (LiDAR / VO / GPS), optional ZUPT, optional
Mahalanobis gating on position updates.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from scipy.spatial.transform import Rotation as R

logger = logging.getLogger(__name__)


class SwarmEKF:
    """IMU propagation with position corrections (sim-side prototype)."""

    STATE_SIZE = 16
    G = np.array([0.0, 0.0, -9.81])

    def __init__(self, dt: float = 0.01) -> None:
        self.dt = dt
        self.x = np.zeros(self.STATE_SIZE)
        self.x[9] = 1.0  # qw (qx,qy,qz,qw)
        self.P = np.eye(self.STATE_SIZE) * 0.1
        self.Q = np.eye(self.STATE_SIZE) * 1e-4
        self.R_pos = np.eye(3) * (0.02**2)
        self.is_stationary = False
        self.mahalanobis_gate = 9.0  # ~3σ in 3D

    def predict(self, imu: Optional[np.ndarray]) -> None:
        dt = self.dt
        pos = self.x[0:3].copy()
        vel = self.x[3:6].copy()
        quat = self.x[6:10].copy()
        bg = self.x[10:13].copy()
        ba = self.x[13:16].copy()

        rot = R.from_quat(quat)
        R_wb = rot.as_matrix()

        if imu is not None and imu.shape[0] >= 6:
            accel_b = imu[0:3] - ba
            gyro_b = imu[3:6] - bg
        else:
            accel_b = np.zeros(3)
            gyro_b = np.zeros(3)

        accel_w = R_wb @ accel_b + self.G
        vel_new = vel + accel_w * dt
        pos_new = pos + vel * dt + 0.5 * accel_w * dt * dt

        if self.is_stationary:
            vel_new *= 0.05
            gyro_b *= 0.1

        dq = R.from_rotvec(gyro_b * dt).as_quat()
        quat_new = (R.from_quat(quat) * R.from_quat(dq)).as_quat()
        quat_new /= max(np.linalg.norm(quat_new), 1e-12)

        self.x[0:3] = pos_new
        self.x[3:6] = vel_new
        self.x[6:10] = quat_new
        self.x[10:13] = bg
        self.x[13:16] = ba

        F = np.eye(self.STATE_SIZE)
        F[0:3, 3:6] = np.eye(3) * dt
        speed = float(np.linalg.norm(vel_new))
        terrain = 0.2 if speed > 0.5 else 0.05
        Q = self.Q * (terrain + speed * 0.02)
        self.P = F @ self.P @ F.T + Q

    def update_position(self, z: np.ndarray, R: Optional[np.ndarray] = None) -> bool:
        """World-frame position (3,). Returns False if rejected by gating."""
        z = np.asarray(z, dtype=float).reshape(3)
        h = self.x[0:3]
        y = z - h
        H = np.zeros((3, self.STATE_SIZE))
        H[:, 0:3] = np.eye(3)
        Rm = R if R is not None else self.R_pos
        S = H @ self.P @ H.T + Rm
        d2 = float(y.T @ np.linalg.solve(S, y))
        if d2 > self.mahalanobis_gate:
            logger.debug("EKF position update rejected (d²=%.3f)", d2)
            return False
        K = self.P @ H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        I = np.eye(self.STATE_SIZE)
        self.P = (I - K @ H) @ self.P
        return True

    def update_lidar(self, z: np.ndarray) -> bool:
        return self.update_position(z, self.R_pos)

    def zero_velocity_update(self, sigma_v: float = 0.02) -> None:
        """ZUPT during hover: drive velocity variance down."""
        Rv = np.eye(3) * (sigma_v**2)
        z = np.zeros(3)
        H = np.zeros((3, self.STATE_SIZE))
        H[:, 3:6] = np.eye(3)
        y = z - self.x[3:6]
        S = H @ self.P @ H.T + Rv
        K = self.P @ H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        I = np.eye(self.STATE_SIZE)
        self.P = (I - K @ H) @ self.P


def _demo_step() -> None:
    ekf = SwarmEKF(dt=0.01)
    ekf.P *= 10.0
    imu = np.array([0.0, 0.0, 9.81, 0.0, 0.0, 0.05])
    for _ in range(50):
        ekf.predict(imu)
    ekf.update_lidar(np.array([0.1, -0.05, 1.2]))
    logger.info("Fused position: %s", ekf.x[0:3])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    _demo_step()
