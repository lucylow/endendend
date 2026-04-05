#!/usr/bin/env python3
"""Run a headless swarm simulation (no Webots required).

Usage:
    python scripts/run_headless.py --robots 5 --steps 300 --seed 42
    python scripts/run_headless.py --scenario swarm/scenario.example.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from swarm import config as swarm_config
from swarm.chain_manager import ChainManager, DroneRole
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.logging_setup import setup_logging
from swarm.metrics import get_metrics
from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import MockDataGenerator, NetworkSimulator
from swarm.vertex_node import VertexNode


def main() -> None:
    parser = argparse.ArgumentParser(description="Headless swarm runner")
    parser.add_argument("--robots", type=int, default=5, help="Number of drones")
    parser.add_argument("--steps", type=int, default=200, help="Simulation steps per drone")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed")
    parser.add_argument("--scenario", default=None, help="Scenario JSON path")
    parser.add_argument("--json-logs", action="store_true", help="Emit JSON log lines")
    parser.add_argument(
        "--mesh",
        action="store_true",
        help="Enable multi-hop mesh routing + flood; register P2P handlers on the emulator",
    )
    args = parser.parse_args()

    setup_logging(level=logging.INFO, json_format=args.json_logs)
    logger = logging.getLogger("headless")

    network_sim = NetworkSimulator(mesh_id="headless")
    emulator = NetworkEmulator(network_sim)
    metrics = get_metrics()

    controllers: list[DroneController] = []

    for i in range(args.robots):
        node_id = f"drone_{i}"
        gps = SimpleMockGPS(x=float(i * 10), y=0.0)
        robot = SimpleMockRobot(gps)
        robot.max_steps = args.steps

        vertex = VertexNode(
            node_id,
            emulator=emulator,
            mesh_routing=args.mesh,
            network_sim=network_sim if args.mesh else None,
        )
        chain_mgr = ChainManager(node_id)
        if i == 0:
            chain_mgr.role = DroneRole.EXPLORER

        mock_data = MockDataGenerator(
            node_id,
            (0.0, 100.0, 0.0, 100.0),
            seed=args.seed + i,
        )

        drone_type = "aerial" if i == 0 else "ground"
        mock_data.battery_drain_per_sec = (
            float(swarm_config.AERIAL_BATTERY_DRAIN_RATE)
            if drone_type == "aerial"
            else float(swarm_config.GROUND_BATTERY_DRAIN_RATE)
        )
        ctrl = DroneController(
            node_id,
            vertex,
            chain_mgr,
            robot,
            gps,
            network_sim=network_sim,
            mock_data=mock_data,
            scenario_path=args.scenario,
            drone_type=drone_type,
        )
        vertex.set_message_handler(lambda s, m, cm=chain_mgr: cm.handle_message(s, m))
        emulator.register(node_id, vertex.dispatch_incoming)
        controllers.append(ctrl)
        metrics.inc("robots_spawned")

    logger.info("Running %d drones for %d steps each (seed=%d)", args.robots, args.steps, args.seed)

    # Step all controllers round-robin
    active = list(controllers)
    step = 0
    while active:
        step += 1
        still_active = []
        for ctrl in active:
            if ctrl.robot.step():
                ctrl.tick()
                still_active.append(ctrl)
        active = still_active
        if step % 50 == 0:
            logger.info("Step %d — %d active drones", step, len(active))
            metrics.inc("sim_steps", 50)

    # Summary
    summary = metrics.get_summary()
    mesh = network_sim.get_swarm_stats()
    logger.info("Simulation complete")
    logger.info("Metrics: %s", json.dumps(summary, indent=2))
    logger.info("Mesh stats: %s", json.dumps(mesh, indent=2))

    for ctrl in controllers:
        state = ctrl.get_state_for_dashboard()
        logger.info("  %s: behavior=%s role=%s targets=%d",
                     state["node_id"], state["behavior"], state["role"], len(state["targets"]))


if __name__ == "__main__":
    main()
