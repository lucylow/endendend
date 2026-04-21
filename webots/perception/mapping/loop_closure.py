"""Inter-agent loop closure: appearance-free geometric consensus (prototype)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np

from .g2o_slam import PoseEdge, PoseGraphOptimizer


@dataclass
class LoopClosureConfig:
    rendezvous_dist_m: float = 0.5
    info_strength: float = 500.0


def inter_agent_loop_closure(
    agent_xy_yaw: Dict[str, np.ndarray],
    cfg: LoopClosureConfig | None = None,
) -> Tuple[PoseGraphOptimizer, float]:
    """
    When two agents are within ``rendezvous_dist_m``, add a tight relative pose edge.

    Returns optimizer and mean rendezvous alignment error (m) after optimization.
    """
    cfg = cfg or LoopClosureConfig()
    opt = PoseGraphOptimizer()
    ids = list(agent_xy_yaw.keys())
    for i, a in enumerate(ids):
        opt.add_vertex(i, np.asarray(agent_xy_yaw[a], dtype=np.float64).reshape(3))
    for i, a in enumerate(ids):
        for j, b in enumerate(ids):
            if j <= i:
                continue
            pa = np.asarray(agent_xy_yaw[a][0:2], dtype=np.float64)
            pb = np.asarray(agent_xy_yaw[b][0:2], dtype=np.float64)
            if np.linalg.norm(pa - pb) > cfg.rendezvous_dist_m:
                continue
            ya = float(agent_xy_yaw[a][2])
            yb = float(agent_xy_yaw[b][2])
            Ri = np.array([[np.cos(ya), -np.sin(ya)], [np.sin(ya), np.cos(ya)]])
            delta_xy = Ri.T @ (pb - pa)
            delta_yaw = yb - ya
            inf = np.eye(3) * cfg.info_strength
            opt.add_edge(PoseEdge(i, j, delta_xy, delta_yaw, inf))
    opt.optimize(iterations=30)
    errs: list[float] = []
    for i, a in enumerate(ids):
        for j, b in enumerate(ids):
            if j <= i:
                continue
            pa = opt.poses[i][0:2]
            pb = opt.poses[j][0:2]
            if np.linalg.norm(pa - pb) < cfg.rendezvous_dist_m * 2.0:
                errs.append(float(np.linalg.norm(pa - pb)))
    mean_err = float(np.mean(errs)) if errs else 0.0
    return opt, mean_err
