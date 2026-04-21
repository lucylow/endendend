"""Lightweight pose-graph optimizer (g2o-inspired API, pure NumPy Gauss-Newton)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import numpy as np


def _rot2(theta: float) -> np.ndarray:
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s], [s, c]], dtype=np.float64)


@dataclass
class PoseEdge:
    i: int
    j: int
    delta_xy: np.ndarray  # (2,)
    delta_yaw: float
    info: np.ndarray  # (3,3) block on [dx, dy, dyaw]


@dataclass
class PoseGraphOptimizer:
    """2D pose graph: vertices hold (x, y, yaw)."""

    poses: Dict[int, np.ndarray] = field(default_factory=dict)  # id -> [x,y,yaw]
    edges: List[PoseEdge] = field(default_factory=list)

    def add_vertex(self, vid: int, xy_yaw: np.ndarray) -> None:
        self.poses[vid] = np.asarray(xy_yaw, dtype=np.float64).reshape(3).copy()

    def add_edge(self, edge: PoseEdge) -> None:
        self.edges.append(edge)

    def optimize(self, iterations: int = 20, step: float = 0.35) -> None:
        for _ in range(iterations):
            for e in self.edges:
                if e.i not in self.poses or e.j not in self.poses:
                    continue
                pi, pj = self.poses[e.i], self.poses[e.j]
                Ri = _rot2(float(pi[2]))
                pred = Ri @ e.delta_xy
                actual = pj[0:2] - pi[0:2]
                err_xy = actual - pred
                err_yaw = (pj[2] - pi[2]) - e.delta_yaw
                err_yaw = (err_yaw + np.pi) % (2 * np.pi) - np.pi
                J = np.zeros((3, 6))
                J[0:2, 0:2] = -np.eye(2)
                th = float(pi[2])
                c, s = np.cos(th), np.sin(th)
                dx, dy = float(e.delta_xy[0]), float(e.delta_xy[1])
                J[0:2, 2] = np.array([-s * dx - c * dy, c * dx - s * dy])
                J[0:2, 3:5] = np.eye(2)
                J[2, 2] = -1.0
                J[2, 5] = 1.0
                rhs = J.T @ e.info @ np.array([err_xy[0], err_xy[1], err_yaw])
                H = J.T @ e.info @ J
                try:
                    delta = np.linalg.solve(H + 1e-9 * np.eye(6), rhs)
                except np.linalg.LinAlgError:
                    continue
                self.poses[e.i] -= step * delta[0:3]
                self.poses[e.j] -= step * delta[3:6]
