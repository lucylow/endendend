#!/usr/bin/env python3
"""Emit ``.wbt`` worlds + JSON maps/config for all registered scenarios."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from webots.scenarios.registry import SCENARIOS, build_context


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument(
        "--mirror-root-worlds",
        action="store_true",
        help="Also copy generated .wbt into repo root worlds/ (npm webots:* scripts).",
    )
    args = ap.parse_args()

    worlds_dir = _ROOT / "webots" / "worlds"
    maps_dir = _ROOT / "webots" / "maps"
    config_dir = _ROOT / "webots" / "config"
    config_dir.mkdir(parents=True, exist_ok=True)

    for name in sorted(SCENARIOS):
        ctx = build_context(name, args.seed)
        wpath = ctx.write(worlds_dir, maps_dir)
        config_dir.joinpath(f"{name}.json").write_text(
            json.dumps(ctx.artifacts.metadata, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print("wrote", wpath.relative_to(_ROOT))

    # Replay stub (structure reference)
    replay_stub = {
        "scenario": "template",
        "world_file": "template.wbt",
        "size": [0, 0],
        "seed": args.seed,
        "agents": [],
        "victims": [],
        "zones": [],
        "note": "Populated by scenario_supervisor when started with --replay-dir",
    }
    for stem in ("fallen_comrade_replay", "blind_handoff_replays", "tunnel_blackout_replay", "open_track_replay"):
        (maps_dir / f"{stem}.json").write_text(
            json.dumps(replay_stub, indent=2) + "\n",
            encoding="utf-8",
        )

    if args.mirror_root_worlds:
        root_worlds = _ROOT / "worlds"
        root_worlds.mkdir(parents=True, exist_ok=True)
        for wname in (
            "fallen_comrade.wbt",
            "blind_handoff.wbt",
            "tunnel_blackout.wbt",
            "open_track.wbt",
        ):
            src = worlds_dir / wname
            if src.is_file():
                shutil.copy2(src, root_worlds / wname)
                print("mirrored", wname, "-> worlds/")
        print("Note: worlds/fallen_comrade_track2.wbt unchanged (mock emitter Track 2).")


if __name__ == "__main__":
    main()
