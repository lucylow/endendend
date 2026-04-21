"""Serialize engine state to the JSON shape consumed by the Track 2 browser store."""

from __future__ import annotations

from typing import Any, Dict, List, TYPE_CHECKING

if TYPE_CHECKING:
    from mockdata.engine import MockDataEngine


def engine_to_track2_frame(engine: "MockDataEngine") -> Dict[str, Any]:
    rovers: List[Dict[str, Any]] = []
    for r in engine.rovers:
        hb_age = max(0.0, engine.t - r.heartbeat)
        rovers.append(
            {
                "id": r.id,
                "position": list(r.position),
                "battery": round(r.battery, 2),
                "state": r.state,
                "sector": {"bounds": list(r.sector)},
                "telemetry": {
                    "speed_mps": r.speed,
                    "heartbeat_age_s": round(hb_age, 3),
                    "explored_unique_cells": len(r.explored_cells),
                    "task": r.task,
                    "assigned_victims": list(r.assigned_victims),
                },
            }
        )
    events = engine.protocol_log.events[-48:]
    obstacles = engine.obstacles
    if len(obstacles) > 800:
        obstacles = list(obstacles[:800])
    return {
        "time": round(engine.t, 3),
        "global_map": engine.global_map,
        "reallocated": engine.reallocated_flag,
        "rovers": rovers,
        "victims": engine.victims,
        "obstacles": obstacles,
        "events": events,
        "scenario_meta": {
            "rover_b_comm_loss_start_s": engine.cfg.rover_b_comm_loss_start_s,
            "heartbeat_timeout_s": engine.cfg.heartbeat_timeout_s,
            "expected_rover_b_dead_s": engine.cfg.rover_b_expected_dead_s,
        },
    }
