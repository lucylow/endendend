"""Lightweight IoU tracker (no SORT dependency)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from vision.yolo_onnx import Detection


def _iou(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    ua = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1) + max(0.0, bx2 - bx1) * max(0.0, by2 - by1) - inter + 1e-9
    return inter / ua


@dataclass
class TrackedVictim:
    track_id: int
    bbox: Tuple[float, float, float, float]
    confidence: float
    hits: int


class VictimTracker:
    """Greedy IoU association each frame."""

    def __init__(self, *, iou_match: float = 0.3, max_age: int = 30, min_hits: int = 2) -> None:
        self.iou_match = iou_match
        self.max_age = max_age
        self.min_hits = min_hits
        self._tracks: Dict[int, TrackedVictim] = {}
        self._miss: Dict[int, int] = {}
        self._next_id = 1

    def update(self, dets: List[Detection]) -> List[TrackedVictim]:
        boxes = [(d.x1, d.y1, d.x2, d.y2) for d in dets]
        pre_ids = list(self._tracks.keys())
        used_track: set[int] = set()
        used_det: set[int] = set()
        pairs: List[Tuple[float, int, int]] = []
        for tid, tr in self._tracks.items():
            tb = tr.bbox
            for di, bb in enumerate(boxes):
                pairs.append((_iou(tb, bb), tid, di))
        pairs.sort(reverse=True)
        for iou_v, tid, di in pairs:
            if tid in used_track or di in used_det:
                continue
            if iou_v < self.iou_match:
                break
            used_track.add(tid)
            used_det.add(di)
            det = dets[di]
            self._tracks[tid] = TrackedVictim(
                tid,
                (det.x1, det.y1, det.x2, det.y2),
                det.score,
                self._tracks[tid].hits + 1,
            )
            self._miss[tid] = 0

        for tid in pre_ids:
            if tid in used_track:
                continue
            self._miss[tid] = self._miss.get(tid, 0) + 1
            if self._miss[tid] > self.max_age:
                self._tracks.pop(tid, None)
                self._miss.pop(tid, None)

        for di, det in enumerate(dets):
            if di in used_det:
                continue
            tid = self._next_id
            self._next_id += 1
            self._tracks[tid] = TrackedVictim(tid, (det.x1, det.y1, det.x2, det.y2), det.score, 1)
            self._miss[tid] = 0

        return [tr for tr in self._tracks.values() if tr.hits >= self.min_hits]
