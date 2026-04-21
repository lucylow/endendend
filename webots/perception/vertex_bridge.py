"""In-process P2P perception sharing (poses, detections, map blobs) — no ROS master."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .types import AgentPose, Detection3D, SwarmMapMessage


@dataclass
class VertexPerceptionFrame:
    agent_id: str
    stamp_ns: int
    pose: Optional[AgentPose] = None
    detections: List[Detection3D] = field(default_factory=list)
    map_blob: Optional[bytes] = None


class VertexPerceptionBridge:
    """Thread-safe enough for single-process Webots + dashboard; swap for real Vertex transport."""

    def __init__(self) -> None:
        self._latest: Dict[str, VertexPerceptionFrame] = {}

    def publish(self, frame: VertexPerceptionFrame) -> None:
        self._latest[frame.agent_id] = frame

    def snapshot(self) -> Dict[str, VertexPerceptionFrame]:
        return dict(self._latest)

    def fuse_maps(self) -> SwarmMapMessage:
        """Trivial merge: concatenate detections; map fusion should call ``GmmMapFusion`` upstream."""
        det: List[Detection3D] = []
        poses: List[AgentPose] = []
        ts = 0
        for fr in self._latest.values():
            det.extend(fr.detections)
            if fr.pose is not None:
                poses.append(fr.pose)
            ts = max(ts, fr.stamp_ns)
        return SwarmMapMessage(components=[], agent_poses=poses, detections=det, timestamp_ns=ts)
