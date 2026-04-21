#!/usr/bin/env python3
"""
# SwarmModule: injection_ui

HTTP helpers for scripted failures during Webots / ROS demos.
Wire these routes to your supervisor or `swarm.network_emulator.NetworkEmulator` in integration builds.
"""

from __future__ import annotations

import os
import subprocess
from typing import Any

from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/health")
def health() -> Any:
    """# WHY: Load balancers / judges need a cheap readiness probe."""
    return jsonify({"ok": True})


@app.post("/inject/kill/<drone_id>")
def kill_drone(drone_id: str) -> Any:
    """# DEMO: POST to mark a drone dead; extend to call controller HTTP if exposed."""
    # WHY: Default path is a no-op unless `DEMO_KILL_CMD` is configured for the environment.
    cmd_template = os.environ.get("DEMO_KILL_CMD", "")
    if cmd_template:
        subprocess.run(cmd_template.format(id=drone_id), shell=True, check=False)
    return jsonify({"status": "accepted", "drone_id": drone_id, "wired": bool(cmd_template)})


@app.post("/stress/packet_loss/<int:pct>")
def stress_loss(pct: int) -> Any:
    """# DEMO: Placeholder for `tc netem` hooks; requires privileged sidecar in real runs."""
    # WHY: Local laptops rarely expose `tc`; judges still see the contract route.
    return jsonify({"status": "queued", "loss_pct": pct, "note": "attach tc in docker sidecar for real loss"})


def main() -> None:
    host = os.environ.get("DEMO_BIND", "127.0.0.1")
    port = int(os.environ.get("DEMO_PORT", "8099"))
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    main()
