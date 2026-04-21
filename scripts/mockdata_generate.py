"""Emit static JSON assets for Fallen Comrade + Blind Handoff (world, victims, auction replay)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from mockdata.handoff_engine import BlindHandoffEngine  # noqa: E402
from mockdata.worldgen import WorldGenerator  # noqa: E402
from mockdata.worldgen_airground import AirGroundWorld  # noqa: E402


def _write_blind_handoff_assets() -> None:
    handoff_public = ROOT / "public" / "data" / "handoff"
    handoff_public.mkdir(parents=True, exist_ok=True)
    world = AirGroundWorld().generate(42)
    (handoff_public / "world_airground.json").write_text(json.dumps(world, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'world_airground.json').relative_to(ROOT)}")
    victims_proc = {"bounds": world["bounds"], "victims": world["victims"]}
    (handoff_public / "victims_proc.json").write_text(json.dumps(victims_proc, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'victims_proc.json').relative_to(ROOT)}")

    eng = BlindHandoffEngine(seed=42, world=world)
    dt = 1.0 / 60.0
    for _ in range(int(42.0 / dt)):
        eng.step(dt)
    replay = eng.replay_log()
    (handoff_public / "auction_replays.json").write_text(json.dumps(replay, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'auction_replays.json').relative_to(ROOT)}")

    worlds_data = ROOT / "data" / "worlds"
    worlds_data.mkdir(parents=True, exist_ok=True)
    (worlds_data / "victims_proc.json").write_text(json.dumps(victims_proc, indent=2) + "\n", encoding="utf-8")
    (worlds_data / "auction_replays.json").write_text(json.dumps(replay, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(worlds_data / 'victims_proc.json').relative_to(ROOT)} (mirror)")


def main() -> None:
    out_dir = ROOT / "public" / "data" / "fallen"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "grid_100x100.json"
    WorldGenerator(42).write_json(path)
    print(f"Wrote {path.relative_to(ROOT)}")

    rec_dir = ROOT / "data" / "recordings"
    rec_dir.mkdir(parents=True, exist_ok=True)
    proto = rec_dir / "realloc_protocol.json"
    if not proto.exists():
        proto.write_text("[]\n", encoding="utf-8")
        print(f"Initialized {proto.relative_to(ROOT)}")

    explored = ROOT / "data" / "worlds" / "explored_cells.json"
    explored.parent.mkdir(parents=True, exist_ok=True)
    if not explored.exists():
        explored.write_text(json.dumps({"cells": []}, indent=2) + "\n", encoding="utf-8")
        print(f"Initialized {explored.relative_to(ROOT)}")

    _write_blind_handoff_assets()


if __name__ == "__main__":
    main()
