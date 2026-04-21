"""End-to-end perception: LiDAR cloud + IMU EKF + GT validation + optional local mapping."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
from scipy.spatial.transform import Rotation as R

from .mapping.g2o_slam import PoseEdge, PoseGraphOptimizer
from .mapping.gmm_map_fusion import GmmMapFusion
from .sensors.ekf_fusion import SwarmEKF
from .sensors.imu_fusion import ImuNoiseSpec
from .sensors.lidar_pipeline import LidarPerceptionPipeline
from .types import SwarmMapMessage
from .validation.ground_truth import GroundTruthPublisher


def _world_xyz_from_body_cloud(xyz_b: np.ndarray, quat_xyzw: np.ndarray, t_w_m: np.ndarray) -> np.ndarray:
    """Map LiDAR points (body / sensor frame) into world coordinates using EKF attitude + position."""
    pts = np.asarray(xyz_b, dtype=np.float64).reshape(-1, 3)
    if pts.size == 0:
        return pts
    rot = R.from_quat(np.asarray(quat_xyzw, dtype=np.float64).reshape(4))
    return (rot.as_matrix() @ pts.T).T + np.asarray(t_w_m, dtype=np.float64).reshape(1, 3)


def _planar_xz_yaw_from_state(pos_m: np.ndarray, quat_xyzw: np.ndarray) -> np.ndarray:
    """2D pose on the Webots floor plane (X–Z, Y up): [x, z, yaw] with yaw about +Y."""
    Rm = R.from_quat(np.asarray(quat_xyzw, dtype=np.float64).reshape(4)).as_matrix()
    fwd = Rm @ np.array([1.0, 0.0, 0.0], dtype=np.float64)
    yaw = float(np.arctan2(fwd[0], fwd[2]))
    p = np.asarray(pos_m, dtype=np.float64).reshape(3)
    return np.array([p[0], p[2], yaw], dtype=np.float64)


def _wrap_pi(a: float) -> float:
    return float((a + np.pi) % (2 * np.pi) - np.pi)


def _swarm_map_to_jsonable(msg: SwarmMapMessage) -> Dict[str, Any]:
    comps_out: List[Dict[str, Any]] = []
    for mean, cov, w in msg.components:
        comps_out.append(
            {
                "mean_m": mean.reshape(3).tolist(),
                "cov_m2": cov.reshape(9).tolist(),
                "weight": float(w),
            }
        )
    return {"timestamp_ns": int(msg.timestamp_ns), "components": comps_out}


class PerceptionPipeline:
    """
    One control-cycle tick: process LiDAR, propagate EKF with IMU,
    apply a position correction (here: noisy pseudo-lidar fix from simulator pose).

    When ``enable_local_mapping`` is True, the same scan is registered in the world
    frame and compressed with ``GmmMapFusion``; odometry edges tighten a small 2D
    pose graph on the floor plane for dashboard / replay (not full SLAM).
    """

    def __init__(
        self,
        dt: float = 0.01,
        dust: bool = False,
        rng: Optional[np.random.Generator] = None,
        *,
        enable_local_mapping: bool = True,
        map_max_points: int = 1400,
        map_gmm_k: int = 28,
        map_keyframe_every: int = 12,
        pose_graph_info: float = 180.0,
    ) -> None:
        self.rng = rng or np.random.default_rng()
        self.lidar = LidarPerceptionPipeline(dust_scenario=dust)
        if rng is not None:
            self.lidar.cfg.rng = rng
        self.ekf = SwarmEKF(dt=dt)
        spec = ImuNoiseSpec(rng=self.rng)
        bg, ba = spec.sample_constant_bias()
        self.ekf.x[10:13] = bg
        self.ekf.x[13:16] = ba
        self.gt = GroundTruthPublisher(rng=self.rng)
        self._lidar_meas_sigma = 0.03
        self.enable_local_mapping = enable_local_mapping
        self.map_max_points = int(map_max_points)
        self.map_gmm_k = int(map_gmm_k)
        self.map_keyframe_every = max(1, int(map_keyframe_every))
        self.pose_graph_info = float(pose_graph_info)
        self._map = GmmMapFusion(max_components=80)
        self._pose_graph = PoseGraphOptimizer()
        self._pg_vertex_id = -1
        self._last_kf_planar: Optional[np.ndarray] = None
        self._steps_since_kf = 0

    def step(
        self,
        stamp_ns: int,
        imu: np.ndarray,
        lidar_ranges: Optional[np.ndarray],
        true_position_m: np.ndarray,
        true_yaw_rad: float,
    ) -> Dict[str, Any]:
        cloud = self.lidar.process_webots(lidar_ranges, int(stamp_ns))
        self.ekf.predict(np.asarray(imu, dtype=np.float64).reshape(-1))

        p_true = np.asarray(true_position_m, dtype=np.float64).reshape(3)
        z = p_true + self.rng.normal(0.0, self._lidar_meas_sigma, size=3)
        self.ekf.update_position(z, R=np.eye(3) * (self._lidar_meas_sigma**2))

        p_gt, yaw_gt, cov = self.gt.noisy_pose(p_true, true_yaw_rad, int(stamp_ns))
        fused = self.ekf.x[0:3].copy()
        quat = self.ekf.x[6:10].copy()
        err = float(np.linalg.norm(fused - p_gt))

        out: Dict[str, Any] = {
            "stamp_ns": int(stamp_ns),
            "point_count": int(cloud.xyz.shape[0]),
            "fused_position_m": fused,
            "ground_truth_position_m": p_gt,
            "ground_truth_yaw_rad": yaw_gt,
            "pose_gt_cov": cov,
            "position_error_m": err,
        }

        if not self.enable_local_mapping:
            out["mapping"] = None
            return out

        world_xyz = _world_xyz_from_body_cloud(cloud.xyz, quat, fused)
        n = int(world_xyz.shape[0])
        if n > self.map_max_points:
            pick = self.rng.choice(n, size=self.map_max_points, replace=False)
            world_xyz_s = world_xyz[pick]
        else:
            world_xyz_s = world_xyz

        local_components = self._map.fit_local(world_xyz_s, k=self.map_gmm_k)
        swarm_map = self._map.merge([local_components], timestamp_ns=int(stamp_ns))

        planar = _planar_xz_yaw_from_state(fused, quat)
        self._steps_since_kf += 1
        need_kf = (
            self._last_kf_planar is None
            or self._steps_since_kf >= self.map_keyframe_every
            or float(np.linalg.norm(planar[0:2] - self._last_kf_planar[0:2])) > 0.12
            or abs(_wrap_pi(planar[2] - self._last_kf_planar[2])) > 0.06
        )
        if need_kf:
            self._pg_vertex_id += 1
            vid = self._pg_vertex_id
            self._pose_graph.add_vertex(vid, planar.copy())
            if self._last_kf_planar is not None and vid > 0:
                pi = self._last_kf_planar
                pj = planar
                ya = float(pi[2])
                Ri = np.array([[np.cos(ya), -np.sin(ya)], [np.sin(ya), np.cos(ya)]], dtype=np.float64)
                delta_xy = Ri.T @ (pj[0:2] - pi[0:2])
                delta_yaw = _wrap_pi(pj[2] - pi[2])
                inf = np.eye(3, dtype=np.float64) * self.pose_graph_info
                self._pose_graph.add_edge(PoseEdge(vid - 1, vid, delta_xy, delta_yaw, inf))
                self._pose_graph.optimize(iterations=6, step=0.4)
            self._last_kf_planar = planar.copy()
            self._steps_since_kf = 0

        pg_pose = self._pose_graph.poses.get(self._pg_vertex_id)
        out["mapping"] = {
            "world_cloud_points": int(world_xyz.shape[0]),
            "gmm_local_components": len(local_components),
            "gmm_map_components": len(swarm_map.components),
            "swarm_map": _swarm_map_to_jsonable(swarm_map),
            "planar_pose_xz_yaw": planar.tolist(),
            "pose_graph_vertex_id": int(self._pg_vertex_id),
            "pose_graph_optimized_xz_yaw": (
                None if pg_pose is None else np.asarray(pg_pose, dtype=np.float64).reshape(3).tolist()
            ),
        }
        return out
