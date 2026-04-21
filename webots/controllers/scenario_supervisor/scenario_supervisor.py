#!/usr/bin/env python3
"""Webots supervisor: schedules failures, samples DEF poses, writes ``live_snapshot.json`` + optional replay."""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from controller import Supervisor  # type: ignore

from webots.sim.failure_injector import FailureEvent, FailureInjector, FailureKind
from webots.utils.replay_logger import ReplayLogger
from webots.utils.scenario_loader import ScenarioLoader
from webots.utils.telemetry_serializer import agent_row, world_snapshot


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--scenario", required=True)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--replay-dir", default="")
    return p.parse_known_args()[0]


def _load_agents(scenario: str) -> List[str]:
    loader = ScenarioLoader(_ROOT / "webots" / "config")
    try:
        return list(loader.load(scenario).agents)
    except FileNotFoundError:
        return []


def _schedule_defaults(inj: FailureInjector, scenario: str) -> None:
    if scenario == "fallen_comrade":
        inj.schedule(18.0, FailureEvent(FailureKind.ROVER_KILL, "RoverB", {"reason": "motor_burnout"}))
    elif scenario == "blind_handoff":
        inj.schedule(12.0, FailureEvent(FailureKind.BATTERY_WARN, "Aerial1", {"level": 0.22}))
    elif scenario == "tunnel_blackout":
        inj.schedule(5.0, FailureEvent(FailureKind.PACKET_LOSS_SPIKE, "mesh", {"loss": 0.65}))
        inj.schedule(22.0, FailureEvent(FailureKind.RELAY_REASSIGN, "RoverB", {"new_leader": "RoverC"}))


def _serialize_failure_events(events: List[FailureEvent]) -> List[Dict[str, Any]]:
    return [{"kind": e.kind.value, "target": e.target, "payload": e.payload} for e in events]


def main() -> None:
    args = _parse_args()
    scenario = args.scenario
    agent_ids = _load_agents(scenario) or ["RoverA", "RoverB", "RoverC", "RoverD", "RoverE"]
    sup = Supervisor()
    timestep = int(sup.getBasicTimeStep())
    t = 0.0
    inj = FailureInjector()
    _schedule_defaults(inj, scenario)

    replay: Optional[ReplayLogger] = None
    if args.replay_dir:
        replay = ReplayLogger(Path(args.replay_dir) / f"{scenario}_replay.jsonl", scenario)
        replay.open()

    snapshot_path = _ROOT / "webots" / "maps" / "live_snapshot.json"
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)

    killed: Set[str] = set()
    victims_meta: List[Dict[str, Any]] = []
    if scenario == "blind_handoff":
        v = sup.getFromDef("Victim01")
        if v:
            p = v.getPosition()
            victims_meta.append({"id": "Victim01", "position": [p[0], p[1], p[2]]})

    step_i = 0
    try:
        while sup.step(timestep) != -1:
            t += timestep / 1000.0
            fired = inj.step(t)
            for ev in fired:
                if ev.kind == FailureKind.ROVER_KILL:
                    killed.add(ev.target)

            agents: List[Dict[str, Any]] = []
            for rid in agent_ids:
                node = sup.getFromDef(rid)
                if node is None:
                    agents.append(agent_row(rid, [0.0, 0.0, 0.0], status="absent", battery=0.0))
                    continue
                pos = node.getPosition()
                if rid in killed:
                    st = "failed"
                else:
                    st = "active"
                agents.append(
                    agent_row(
                        rid,
                        [pos[0], pos[1], pos[2]],
                        status=st,
                        battery=max(0.0, 1.0 - t / 120.0),
                        role="aerial" if rid.startswith("Aerial") else "rover",
                    )
                )

            snap = world_snapshot(
                scenario=scenario,
                sim_time=t,
                agents=agents,
                mission_phase="run",
                victims=victims_meta,
                failure={"active": bool(inj.list_active()), "events": _serialize_failure_events(inj.list_active())},
                auction={"active": scenario == "blind_handoff" and t > 12, "bids": []},
            )
            if fired:
                snap["step_events"] = _serialize_failure_events(fired)

            step_i += 1
            if step_i % 5 == 0:
                snapshot_path.write_text(json.dumps(snap, indent=2) + "\n", encoding="utf-8")
            if replay:
                replay.log(t, snap, _serialize_failure_events(fired))

    except KeyboardInterrupt:
        pass
    except Exception:
        traceback.print_exc()
    finally:
        if replay:
            replay.close()


if __name__ == "__main__":
    main()
