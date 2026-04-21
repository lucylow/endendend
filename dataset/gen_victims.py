#!/usr/bin/env python3
"""
Hybrid SAR victim dataset entrypoint.

  • OpenCV tunnel synth (no Webots): default — writes YOLO tiles for bulk / CI.
  • Webots: open ``worlds/victim_dataset.world`` with controller ``victim_dataset_gen``.
    Export VICTIM_DATASET_N=4000 for full run. Output: ``dataset/webots_synth/``.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description="SAR victim dataset — OpenCV bulk or Webots hint")
    ap.add_argument(
        "--mode",
        choices=("opencv", "webots-info"),
        default="opencv",
        help="opencv: run tunnel synthetic generator; webots-info: print Webots command",
    )
    ap.add_argument("--train", type=int, default=4000, help="OpenCV train split count")
    ap.add_argument("--val", type=int, default=600)
    ap.add_argument("--test", type=int, default=400)
    ap.add_argument("--out", type=Path, default=Path("dataset"))
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    gen = root / "dataset" / "gen_dataset.py"
    if not gen.is_file():
        gen = Path(__file__).resolve().parent / "gen_dataset.py"

    if args.mode == "opencv":
        cmd = [
            sys.executable,
            str(gen),
            "--preset",
            "sar_tunnel",
            "--out",
            str(args.out),
            "--train",
            str(args.train),
            "--val",
            str(args.val),
            "--test",
            str(args.test),
            "--seed",
            str(args.seed),
        ]
        raise SystemExit(subprocess.call(cmd))

    wbt = root / "worlds" / "victim_dataset.world"
    print("Webots SAR capture:")
    print("  1) Open Webots and load:", wbt.resolve())
    print("  2) Controller: controllers/victim_dataset_gen/victim_dataset_gen.py")
    print("  3) Export before run: VICTIM_DATASET_N=4000 VICTIM_DATASET_SEED=0")
    print("  4) Output:", (root / "dataset" / "webots_synth").resolve())


if __name__ == "__main__":
    main()
