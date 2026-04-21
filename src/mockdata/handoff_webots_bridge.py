"""Serialize BlindHandoffEngine → Track 2 browser / Webots JSON frame."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

if TYPE_CHECKING:
    from mockdata.handoff_engine import BlindHandoffEngine


def handoff_engine_to_track2_frame(engine: "BlindHandoffEngine") -> Dict[str, Any]:
    tl = engine.timeline
    lt = engine.cycle_local()
    auction_active = (
        engine._auction_open
        and engine.auction.winner is None
        and lt >= tl["auction_start_s"]
        and lt < tl["winner_s"]
    )
    task_coords = None
    if engine.aerial.victim_detected and engine.aerial.victim_detected.get("coords"):
        c = engine.aerial.victim_detected["coords"]
        task_coords = [float(c[0]), float(c[1]), float(c[2])]

    bids_out: Dict[str, Any] = {}
    for rid, row in engine.auction.bids.items():
        bids_out[rid] = {
            "score": float(row.get("score", 0.0)),
            "distance": float(row.get("distance", 0.0)),
            "battery": float(row.get("battery", 0.0)),
            "capacity": str(row.get("capacity", "")),
        }

    ground: List[Dict[str, Any]] = []
    for g in engine.ground:
        gx, gy, gz = g.position
        ground.append(
            {
                "id": g.id,
                "position": [gx, gy, gz],
                "battery": round(g.battery, 2),
                "state": "exploring",
                "sector": {"bounds": [-100.0, 100.0, -100.0, 100.0]},
            }
        )

    aerial_payload: Dict[str, Any] = {
        "position": [float(engine.aerial.position[0]), float(engine.aerial.position[1]), float(engine.aerial.position[2])],
        "battery": round(float(engine.aerial.battery), 2),
        "mode": engine.aerial.mode,
    }
    if engine.aerial.victim_detected:
        aerial_payload["victim_detected"] = engine.aerial.victim_detected

    return {
        "time": round(engine.t, 3),
        "cycle_t": round(lt, 3),
        "timeline": {k: float(v) for k, v in engine.timeline.items()},
        "global_map": [],
        "reallocated": False,
        "rovers": [],
        "aerial": aerial_payload,
        "ground_rovers": ground,
        "auction": {
            "active": auction_active,
            "bids": bids_out,
            "winner": engine.auction.winner,
            "task": {"coords": task_coords} if task_coords else None,
        },
        "rescues_completed": engine.rescues_completed,
    }
