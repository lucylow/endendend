"""Optional hooks for ROS / Webots: format + filter victim payloads before Vertex."""

from __future__ import annotations

from typing import Any, Dict, List


def filter_by_confidence(messages: List[Dict[str, Any]], min_conf: float) -> List[Dict[str, Any]]:
    return [m for m in messages if float(m.get("confidence", 0.0)) >= min_conf]


def stamp_sender(messages: List[Dict[str, Any]], sender_id: str) -> List[Dict[str, Any]]:
    for m in messages:
        m.setdefault("drone_id", sender_id)
    return messages
