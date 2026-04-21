#!/usr/bin/env python3
"""Heterogeneous drone: chase ``webots/maps/dynamic_daisy_targets.json`` (written by emitter)."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

try:
    from controller import Robot
except ImportError as exc:  # pragma: no cover
    print("Webots controller module not found:", exc, file=sys.stderr)
    sys.exit(1)

_ROOT = Path(__file__).resolve().parents[2]
_MAP = _ROOT / "webots" / "maps" / "dynamic_daisy_targets.json"

_PROFILE_SPEED = {
    "explorer": 2.1,
    "relay": 0.95,
    "indoor": 0.62,
    "heavy": 0.78,
    "backup": 1.05,
}


def _load_targets(drone_id: str) -> tuple[float, float, str]:
    try:
        raw = _MAP.read_text(encoding="utf-8")
        j = json.loads(raw)
        t = j.get("targets", {}).get(drone_id, {})
        return float(t.get("target_x", 0.0)), float(t.get("target_z", 5.0)), str(t.get("role", "standby"))
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        return 0.0, 8.0, "standby"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--id", default="drone_0")
    p.add_argument("--profile", default="explorer", choices=list(_PROFILE_SPEED.keys()))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    robot = Robot()
    timestep = int(robot.getBasicTimeStep())
    gps = robot.getDevice("gps")
    if gps:
        gps.enable(timestep)
    motors: list = []
    for name in ("motor_fl", "motor_fr", "motor_rl", "motor_rr", "motor_left", "motor_right", "motor"):
        m = robot.getDevice(name)
        if m:
            m.setPosition(float("inf"))
            m.setVelocity(0.0)
            motors.append(m)
    max_speed = _PROFILE_SPEED.get(args.profile, 1.0)
    step_count = 0
    tx, tz = 0.0, 6.0
    while robot.step(timestep) != -1:
        step_count += 1
        if step_count % 5 == 0:
            tx, tz, _role = _load_targets(args.id)
        pos = gps.getValues() if gps else [0.0, 2.0, 0.0]
        x, _y, z = float(pos[0]), float(pos[1]), float(pos[2])
        dx, dz = tx - x, tz - z
        dist = math.hypot(dx, dz)
        if dist < 0.35:
            speed = 0.0
        else:
            speed = min(max_speed, dist * 0.45)
            dx /= dist
            dz /= dist
        vx = dx * speed
        vz = dz * speed
        for m in motors:
            m.setVelocity(math.hypot(vx, vz))


if __name__ == "__main__":
    main()
