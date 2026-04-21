"""Map image detections + drone pose to VICTIM_DETECTED wire payloads."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Tuple

from vision.victim_tracker import TrackedVictim


def bbox_center_norm(bbox: Tuple[float, float, float, float], frame_w: int, frame_h: int) -> Tuple[float, float]:
    x1, y1, x2, y2 = bbox
    cx = ((x1 + x2) * 0.5) / max(frame_w, 1)
    cy = ((y1 + y2) * 0.5) / max(frame_h, 1)
    return cx, cy


def estimate_world_location(
    gps_xyz: Tuple[float, float, float],
    bbox: Tuple[float, float, float, float],
    frame_w: int,
    frame_h: int,
    *,
    ground_range_m: float = 18.0,
    lateral_scale_m: float = 12.0,
) -> Tuple[float, float, float]:
    """Heuristic flat-world projection: offset East/North from bbox centering."""
    gx, gy, gz = gps_xyz
    cx, cy = bbox_center_norm(bbox, frame_w, frame_h)
    forward = (0.5 - cy) * ground_range_m
    lateral = (cx - 0.5) * lateral_scale_m
    return (gx + lateral, gy + forward, gz)


def tracked_to_victim_messages(
    drone_id: str,
    tracks: List[TrackedVictim],
    gps_xyz: Tuple[float, float, float],
    frame_size: Tuple[int, int],
) -> List[Dict[str, Any]]:
    fw, fh = frame_size
    now = time.time()
    out: List[Dict[str, Any]] = []
    for tr in tracks:
        loc = estimate_world_location(gps_xyz, tr.bbox, fw, fh)
        out.append(
            {
                "type": "VICTIM_DETECTED",
                "id": f"{drone_id}_yolo_t{tr.track_id}",
                "location": [round(loc[0], 2), round(loc[1], 2), round(loc[2], 2)],
                "confidence": round(tr.confidence, 4),
                "sensor": "yolov8_onnx",
                "drone_id": drone_id,
                "track_id": int(tr.track_id),
                "bbox": [tr.bbox[0], tr.bbox[1], tr.bbox[2], tr.bbox[3]],
                "timestamp": now,
            }
        )
    return out
