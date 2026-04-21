#!/usr/bin/env python3
"""Summarize JSONL replay logs written by ``ReplayLogger``."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from webots.utils.replay_logger import read_replay


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("replay", type=Path, help="Path to .jsonl replay file")
    ap.add_argument("--out", type=Path, help="Optional summary JSON path")
    args = ap.parse_args()

    kinds: Counter[str] = Counter()
    n = 0
    t_end = 0.0
    scenario = ""
    for row in read_replay(args.replay):
        n += 1
        scenario = str(row.get("scenario", scenario))
        t_end = max(t_end, float(row.get("sim_time", 0.0)))
        for ev in row.get("events", []) or []:
            kinds[str(ev.get("kind", "?"))] += 1

    summary = {
        "frames": n,
        "scenario": scenario,
        "sim_time_end": t_end,
        "event_counts": dict(kinds),
    }
    txt = json.dumps(summary, indent=2) + "\n"
    print(txt)
    if args.out:
        args.out.write_text(txt, encoding="utf-8")


if __name__ == "__main__":
    main()
