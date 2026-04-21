#!/usr/bin/env python3
"""Webots controller hook: mesh survival helpers (geometric fan-out + liveness tiers)."""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

try:
    from controller import Robot
except ImportError as exc:  # pragma: no cover
    print("Webots controller module not found:", exc, file=sys.stderr)
    sys.exit(1)

# Repo root: mesh_survival/webots/controllers -> parents[3]
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from mesh_survival.networking.adaptive_gossip import (  # noqa: E402
    GossipMessage,
    MessageUrgency,
    Vector3,
    adaptive_fanout_k,
    rank_neighbors_for_delivery,
    top_k_neighbors,
)
from mesh_survival.failure_recovery.stale_heartbeat import StaleHeartbeatTracker  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Resilient mesh-aware Webots drone stub")
    p.add_argument("--id", default="drone_0", help="Logical node id")
    p.add_argument("--loss-hint", type=float, default=0.5, help="Observed loss [0,1) for fan-out")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    robot = Robot()
    timestep = int(robot.getBasicTimeStep())
    gps = robot.getDevice("gps")
    if gps:
        gps.enable(timestep)
    motors = []
    for name in ("motor_fl", "motor_fr", "motor_rl", "motor_rr", "motor_left", "motor_right", "motor"):
        m = robot.getDevice(name)
        if m:
            m.setPosition(float("inf"))
            m.setVelocity(0.0)
            motors.append(m)

    hb = StaleHeartbeatTracker()
    hb.record_fast("base", now=time.monotonic())
    loss = float(args.loss_hint)
    k = adaptive_fanout_k(loss)

    step = 0
    while robot.step(timestep) != -1:
        step += 1
        pos = gps.getValues() if gps else [0.0, 1.0, 0.0]
        here = Vector3(float(pos[0]), float(pos[1]), float(pos[2]))
        target = Vector3(0.0, 1.0, 12.0)
        # Demo: imaginary peers in a ring — real controllers pass neighbor_positions from sim RF.
        neighbors = {
            f"peer_{i}": Vector3(here.x + math.cos(i) * 2.0, here.y, here.z + math.sin(i) * 2.0)
            for i in range(6)
        }
        msg = GossipMessage(
            urgency=MessageUrgency.HEARTBEAT,
            created_mono=time.monotonic(),
            msg_id=f"{args.id}:{step}",
            signed_duplicate_key=f"{args.id}:{step}",
            payload={"node": args.id},
        )
        ranked = rank_neighbors_for_delivery(msg, here, target, neighbors)
        _targets = top_k_neighbors(ranked, 3, loss=loss)  # noqa: F841 — wire to emitter bus

        if step % 15 == 0:
            hb.record_fast(args.id, now=time.monotonic())

        dx, dz = target.x - here.x, target.z - here.z
        dist = math.hypot(dx, dz)
        speed = 0.0 if dist < 0.25 else min(1.2, dist * 0.25)
        if dist > 1e-3:
            dx /= dist
            dz /= dist
        vx = dx * speed
        vz = dz * speed
        for m in motors:
            m.setVelocity(-vz + vx)

        if step % 200 == 0 and motors:
            motors[0].setVelocity(0.0)


if __name__ == "__main__":
    main()
