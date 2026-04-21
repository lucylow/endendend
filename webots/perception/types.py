"""Shared perception datatypes (sim-agnostic, NumPy-first)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np


@dataclass
class PointCloud:
    """Cartesian points in the sensor frame (meters). Optional per-point fields."""

    xyz: np.ndarray  # (N, 3) float64
    intensity: Optional[np.ndarray] = None  # (N,) in [0, 1]
    stamp_ns: int = 0
    frame_id: str = "lidar"

    def __post_init__(self) -> None:
        if self.xyz.ndim != 2 or self.xyz.shape[1] != 3:
            raise ValueError("PointCloud.xyz must be (N, 3)")
        if self.intensity is not None and self.intensity.shape[0] != self.xyz.shape[0]:
            raise ValueError("intensity length must match xyz rows")


@dataclass
class Detection3D:
    class_name: str
    confidence: float
    center_m: np.ndarray  # (3,)
    extent_m: np.ndarray  # (3,) axis-aligned extent
    stamp_ns: int = 0


@dataclass
class AgentPose:
    agent_id: str
    position_m: np.ndarray  # (3,)
    yaw_rad: float
    stamp_ns: int = 0
    covariance_pose6: Optional[np.ndarray] = None  # (6, 6) optional


@dataclass
class SwarmMapMessage:
    """In-process map bundle (see proto/swarm_map.proto for wire format)."""

    components: List[Tuple[np.ndarray, np.ndarray, float]] = field(default_factory=list)
    # Each GMM component: (mean (3,), cov (3,3), weight)
    agent_poses: List[AgentPose] = field(default_factory=list)
    detections: List[Detection3D] = field(default_factory=list)
    timestamp_ns: int = 0
