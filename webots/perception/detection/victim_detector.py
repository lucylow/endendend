"""Victim / SAR class taxonomy + stubs for YOLOv8 ONNX bridge (ROS node stays canonical)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence

import numpy as np

from ..types import Detection3D

SAR_CLASS_NAMES = (
    "victim_adult",
    "victim_child",
    "fire",
    "smoke",
    "debris",
    "tunnel_collapse",
    "rescue_equipment",
)


@dataclass
class VictimDetectorConfig:
    conf_threshold: float = 0.5
    model_path: str = ""


def stub_detections_from_boxes(
    boxes_xyxy: np.ndarray,
    class_ids: Sequence[int],
    scores: Sequence[float],
    stamp_ns: int = 0,
) -> List[Detection3D]:
    """Build ``Detection3D`` list from pixel boxes (for tests without ONNX)."""
    out: List[Detection3D] = []
    boxes_xyxy = np.asarray(boxes_xyxy, dtype=np.float64).reshape(-1, 4)
    for row, cid, sc in zip(boxes_xyxy, class_ids, scores):
        cx = 0.5 * (row[0] + row[2])
        cy = 0.5 * (row[1] + row[3])
        name = SAR_CLASS_NAMES[int(cid) % len(SAR_CLASS_NAMES)]
        center = np.array([cx, cy, 1.0], dtype=np.float64) * 0.01  # dummy metric scale
        ext = np.array([0.5, 1.7, 0.4], dtype=np.float64)
        out.append(Detection3D(class_name=name, confidence=float(sc), center_m=center, extent_m=ext, stamp_ns=int(stamp_ns)))
    return out
