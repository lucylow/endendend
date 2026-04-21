"""Frontend-oriented world snapshots (WebSocket / REST payloads)."""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional


def world_snapshot(
    *,
    scenario: str,
    sim_time: float,
    agents: List[Dict[str, Any]],
    mission_phase: str = "idle",
    obstacles: Optional[List[Dict[str, Any]]] = None,
    victims: Optional[List[Dict[str, Any]]] = None,
    sectors: Optional[List[Dict[str, Any]]] = None,
    relay_chain: Optional[List[str]] = None,
    auction: Optional[Dict[str, Any]] = None,
    failure: Optional[Dict[str, Any]] = None,
    completed: bool = False,
    map_bounds: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """Stable schema for dashboard / replay consumers."""
    return {
        "type": "world_snapshot",
        "scenario": scenario,
        "sim_time": round(float(sim_time), 4),
        "mission_phase": mission_phase,
        "agents": agents,
        "obstacles": obstacles or [],
        "victims": victims or [],
        "sectors": sectors or [],
        "relay_chain": relay_chain or [],
        "auction_state": auction or {"active": False, "bids": []},
        "failure_state": failure or {"active": False},
        "completion": {"done": bool(completed)},
        "map_bounds": list(map_bounds) if map_bounds is not None else None,
    }


def agent_row(
    agent_id: str,
    position: List[float],
    status: str,
    battery: float = 1.0,
    role: str = "rover",
    meta: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "id": agent_id,
        "position": [round(float(p), 3) for p in position],
        "status": status,
        "battery": round(float(battery), 3),
        "role": role,
    }
    if meta:
        row["meta"] = dict(meta)
    return row


def merge_with_mock_track2(base: Dict[str, Any], mock_frame: Mapping[str, Any]) -> Dict[str, Any]:
    """Attach Track2 mock fields (global_map, reallocated) when bridging MockDataEngine."""
    out = dict(base)
    if "global_map" in mock_frame:
        out["global_map"] = mock_frame["global_map"]
    if "reallocated" in mock_frame:
        out["reallocated"] = mock_frame["reallocated"]
    if "rovers" in mock_frame:
        out["rovers"] = mock_frame["rovers"]
    return out
