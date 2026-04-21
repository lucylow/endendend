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
from mockdata.replay_engine import blind_handoff_replay_path, load_protocol_events, write_replay_file  # noqa: E402
from mockdata.validators import validate_blind_handoff_world, validate_world_bundle  # noqa: E402
from mockdata.worldgen import WorldGenerator  # noqa: E402
from mockdata.worldgen_airground import AirGroundWorld  # noqa: E402


def _write_blind_handoff_assets() -> None:
    handoff_public = ROOT / "public" / "data" / "handoff"
    handoff_public.mkdir(parents=True, exist_ok=True)
    world = AirGroundWorld().generate(42)
    ok_bh, errs_bh = validate_blind_handoff_world(world)
    if not ok_bh:
        raise SystemExit("validate_blind_handoff_world failed: " + "; ".join(errs_bh))
    (handoff_public / "world_airground.json").write_text(json.dumps(world, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'world_airground.json').relative_to(ROOT)}")
    victims_proc = {"bounds": world["bounds"], "victims": world["victims"]}
    (handoff_public / "victims_proc.json").write_text(json.dumps(victims_proc, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'victims_proc.json').relative_to(ROOT)}")

    eng = BlindHandoffEngine(seed=42, world=world)
    dt = 1.0 / 60.0
    for _ in range(int(48.0 / dt)):
        eng.step(dt)
    replay = eng.replay_log()
    (handoff_public / "auction_replays.json").write_text(json.dumps(replay, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(handoff_public / 'auction_replays.json').relative_to(ROOT)}")

    worlds_data = ROOT / "data" / "worlds"
    worlds_data.mkdir(parents=True, exist_ok=True)
    (worlds_data / "victims_proc.json").write_text(json.dumps(victims_proc, indent=2) + "\n", encoding="utf-8")
    (worlds_data / "auction_replays.json").write_text(json.dumps(replay, indent=2) + "\n", encoding="utf-8")
    (worlds_data / "blind_handoff_world.json").write_text(json.dumps(world, indent=2) + "\n", encoding="utf-8")
    (worlds_data / "blind_handoff_victims.json").write_text(json.dumps(victims_proc, indent=2) + "\n", encoding="utf-8")
    write_replay_file(replay, blind_handoff_replay_path(ROOT))
    wbt_src = ROOT / "worlds" / "blind_handoff_track2.wbt"
    wbt_dst = worlds_data / "blind_handoff.wbt"
    if wbt_src.exists():
        wbt_dst.write_bytes(wbt_src.read_bytes())
    print(f"Wrote {(worlds_data / 'blind_handoff_world.json').relative_to(ROOT)}")
    print(f"Wrote {(worlds_data / 'blind_handoff_victims.json').relative_to(ROOT)}")
    print(f"Wrote {(blind_handoff_replay_path(ROOT)).relative_to(ROOT)}")
    if wbt_dst.exists():
        print(f"Wrote {wbt_dst.relative_to(ROOT)}")
    print(f"Wrote {(worlds_data / 'victims_proc.json').relative_to(ROOT)} (mirror)")


def _write_fallen_comrade_data_worlds() -> None:
    worlds = ROOT / "data" / "worlds"
    worlds.mkdir(parents=True, exist_ok=True)
    gen = WorldGenerator(42)
    bundle = gen.generate()
    ok, errs = validate_world_bundle(bundle)
    if not ok:
        raise SystemExit("validate_world_bundle failed: " + "; ".join(errs))

    (worlds / "fallen_comrade_world.json").write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(worlds / 'fallen_comrade_world.json').relative_to(ROOT)}")

    grid_only = {"seed": bundle["seed"], "grid_size": 100, "grid": bundle["grid"]}
    (worlds / "fallen_comrade_grid.json").write_text(json.dumps(grid_only, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(worlds / 'fallen_comrade_grid.json').relative_to(ROOT)}")

    sectors = {"seed": bundle["seed"], "sectors": bundle["sectors"]}
    (worlds / "fallen_comrade_sectors.json").write_text(json.dumps(sectors, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {(worlds / 'fallen_comrade_sectors.json').relative_to(ROOT)}")

    rec_dir = ROOT / "data" / "recordings"
    rec_dir.mkdir(parents=True, exist_ok=True)
    replay_path = rec_dir / "protocol_replay.json"
    existing = load_protocol_events(replay_path)
    if not existing:
        replay_path.write_text(json.dumps([], indent=2) + "\n", encoding="utf-8")
        print(f"Initialized {replay_path.relative_to(ROOT)}")


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

    _write_fallen_comrade_data_worlds()
    _write_blind_handoff_assets()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"mockdata_generate: {e}", file=sys.stderr)
        raise SystemExit(1) from e
