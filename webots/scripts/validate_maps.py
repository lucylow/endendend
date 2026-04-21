#!/usr/bin/env python3
"""Validate ``webots/maps/*.json`` and ``webots/config/*.json`` metadata."""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]

_REQUIRED = ("scenario", "world_file", "size", "seed", "agents", "victims", "zones")


def _check(obj: dict, path: Path) -> list[str]:
    errs: list[str] = []
    for k in _REQUIRED:
        if k not in obj:
            errs.append(f"{path}: missing {k!r}")
    if "size" in obj:
        s = obj["size"]
        if not isinstance(s, list) or len(s) != 2:
            errs.append(f"{path}: size must be [w, d]")
    return errs


def main() -> int:
    errs: list[str] = []
    for folder in ("webots/config",):
        d = _ROOT / folder
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.json")):
            if p.name.startswith("live_"):
                continue
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                errs.append(f"{p}: JSON error {e}")
                continue
            if not isinstance(data, dict):
                errs.append(f"{p}: root must be object")
                continue
            if "scenario" in data:
                errs.extend(_check(data, p))
    if errs:
        print("\n".join(errs))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
