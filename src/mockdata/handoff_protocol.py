"""P2P blind handoff message shapes (Vertex / FoxMQ mock — no cloud broker)."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

Vec3 = Tuple[float, float, float]


def auction_broadcast(task_id: str, coords: Vec3, deadline_s: float = 60.0) -> Dict[str, Any]:
    return {
        "type": "HANDOFF_AUCTION",
        "task": task_id,
        "coords": list(coords),
        "priority": "critical",
        "deadline": deadline_s,
        "transport": "p2p_vertex_mock",
    }


def bid_message(rover_id: str, distance_m: float, battery_pct: float, capacity: str) -> Dict[str, Any]:
    return {
        "type": "HANDOFF_BID",
        "rover_id": rover_id,
        "distance_m": distance_m,
        "battery_pct": battery_pct,
        "capacity": capacity,
    }


def winner_announcement(winner_id: str, task_coords: Vec3) -> Dict[str, Any]:
    return {
        "type": "HANDOFF_WINNER",
        "winner": winner_id,
        "task_coords": list(task_coords),
    }


def rescue_complete(victim_id: str, rover_id: str, t: float) -> Dict[str, Any]:
    return {"type": "RESCUE_COMPLETE", "victim_id": victim_id, "rover_id": rover_id, "t": t}


def timeline_defaults() -> Dict[str, float]:
    """Seconds relative to each multi-handoff cycle origin (T+0 sweep)."""
    return {
        "detect_s": 15.0,
        "auction_start_s": 16.0,
        "winner_s": 18.0,
        "rtb_done_s": 20.0,
        "rescue_arrival_s": 30.0,
        "cycle_reset_s": 35.0,
    }


def empty_replay() -> List[Dict[str, Any]]:
    return []
