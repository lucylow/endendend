"""JSON schema hints for Three.js / React overlays (LiDAR, boxes, pose graph)."""

from __future__ import annotations

from typing import Any, Dict, List


def overlay_frame_schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "required": ["stamp_ns", "agents"],
        "properties": {
            "stamp_ns": {"type": "integer"},
            "agents": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "pose": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3},
                        "lidar_xyz": {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
                        "detections": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "score": {"type": "number"},
                                    "center_m": {"type": "array", "items": {"type": "number"}},
                                },
                            },
                        },
                    },
                },
            },
            "loop_edges": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
        },
    }


def empty_overlay(stamp_ns: int) -> Dict[str, Any]:
    return {"stamp_ns": int(stamp_ns), "agents": [], "loop_edges": []}
