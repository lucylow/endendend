"""Dynamic vs static obstacle tagging from point clusters."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Tuple

import numpy as np

ObstacleKind = Literal["dynamic", "static", "unknown"]


@dataclass
class ObstacleHypothesis:
    kind: ObstacleKind
    velocity_m_s: np.ndarray  # (3,)
    score: float


class ObstacleClassifier:
    def __init__(self, speed_static_thresh: float = 0.05) -> None:
        self.speed_static_thresh = speed_static_thresh

    def classify_cluster(self, centroid_prev: np.ndarray, centroid_now: np.ndarray, dt_s: float) -> ObstacleHypothesis:
        if dt_s < 1e-6:
            return ObstacleHypothesis("unknown", np.zeros(3), 0.0)
        v = (centroid_now - centroid_prev) / dt_s
        speed = float(np.linalg.norm(v))
        if speed < self.speed_static_thresh:
            return ObstacleHypothesis("static", v, 1.0 - speed / self.speed_static_thresh)
        return ObstacleHypothesis("dynamic", v, min(1.0, speed))
