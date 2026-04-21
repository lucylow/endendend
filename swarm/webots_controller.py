"""Webots simulation controller: bridges Webots Robot API to swarm coordination.

Provides WebotsRobotAdapter that wraps a real Webots Robot instance,
and launch_controller() as the entry point for each robot in the world.
When Webots is unavailable, falls back to headless SimpleMockRobot.
"""

from __future__ import annotations

import argparse
import logging
import math
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

from swarm import config
from swarm.chain_manager import ChainManager, DroneRole
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.network_simulator import MockDataGenerator, NetworkSimulator
from swarm.vertex_node import VertexNode
from swarm.lovable_cloud_sink import maybe_start_lovable_cloud_sink

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LED colour constants (RGB integers)
# ---------------------------------------------------------------------------
LED_EXPLORER = 0x00FF00  # green
LED_RELAY = 0x0066FF  # blue
LED_STANDBY = 0xFF3300  # red-orange
LED_RESCUE = 0xFFCC00  # amber

ROLE_LED_MAP: Dict[str, int] = {
    DroneRole.EXPLORER.value: LED_EXPLORER,
    DroneRole.RELAY.value: LED_RELAY,
    DroneRole.STANDBY.value: LED_STANDBY,
}


# ---------------------------------------------------------------------------
# Webots adapter  (wraps real Webots Robot when available)
# ---------------------------------------------------------------------------
class WebotsRobotAdapter:
    """Thin wrapper that exposes .step(), .set_velocity(), and sensor helpers.

    Designed so DroneController can use it identically to SimpleMockRobot.
    """

    def __init__(self, wb_robot: Any) -> None:
        self._robot = wb_robot
        self._timestep = int(wb_robot.getBasicTimeStep())

        # Sensors
        self.gps = wb_robot.getDevice("gps")
        if self.gps:
            self.gps.enable(self._timestep)

        self.led = wb_robot.getDevice("led")
        self.distance_sensor = wb_robot.getDevice("distance_sensor")
        if self.distance_sensor:
            self.distance_sensor.enable(self._timestep)

        self.display = wb_robot.getDevice("debug_display")

        # Motors — try 4-motor drone layout, fallback to 2-wheel
        self._motors: List[Any] = []
        for name in ("motor_fl", "motor_fr", "motor_rl", "motor_rr", "motor_left", "motor_right", "motor"):
            m = wb_robot.getDevice(name)
            if m:
                m.setPosition(float("inf"))
                m.setVelocity(0.0)
                self._motors.append(m)

    @property
    def timestep(self) -> int:
        return self._timestep

    def step(self) -> int:
        return self._robot.step(self._timestep) != -1

    def set_velocity(self, vx: float, vy: float) -> None:
        """Simplified 2D velocity — maps to whatever motors are available."""
        speed = math.hypot(vx, vy)
        for m in self._motors:
            m.setVelocity(speed)

    def set_led_color(self, color: int) -> None:
        if self.led:
            try:
                self.led.set(color)
            except Exception:
                pass

    def draw_debug(self, lines: List[str]) -> None:
        if not self.display:
            return
        try:
            self.display.setColor(0x000000)
            self.display.fillRectangle(0, 0, 128, 64)
            self.display.setColor(0x00FF88)
            for i, line in enumerate(lines[:4]):
                self.display.drawText(line, 4, 4 + i * 14)
        except Exception:
            pass


class WebotsGPSAdapter:
    """Wraps a Webots GPS device behind the GPSDevice protocol."""

    def __init__(self, gps_device: Any) -> None:
        self._gps = gps_device

    def getValues(self) -> List[float]:
        vals = self._gps.getValues()
        return [float(v) for v in vals]


# ---------------------------------------------------------------------------
# Depth-based network link updater
# ---------------------------------------------------------------------------
def update_depth_links(
    network_sim: NetworkSimulator,
    node_id: str,
    depth: float,
    peer_depths: Dict[str, float],
    *,
    max_depth: float = 200.0,
) -> None:
    """Dynamically set link loss/latency based on depth separation (tunnel model)."""
    for peer_id, peer_depth in peer_depths.items():
        if peer_id == node_id:
            continue
        separation = abs(depth - peer_depth)
        loss = min(0.9, (separation / max_depth) ** 1.5)
        latency = separation / 500.0  # rough: 2ms per metre
        network_sim.set_link(node_id, peer_id, loss=loss, latency=latency, status="up")


# ---------------------------------------------------------------------------
# Controller launcher
# ---------------------------------------------------------------------------
def parse_controller_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Swarm Webots controller")
    parser.add_argument("--id", default="drone_0", help="Unique node ID")
    parser.add_argument("--type", default="aerial", choices=["aerial", "ground"], help="Robot type")
    parser.add_argument("--scenario", default=None, help="Path to scenario JSON")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    parser.add_argument("--max-steps", type=int, default=None, help="Max simulation steps (headless)")
    parser.add_argument("--headless", action="store_true", help="Run without Webots")
    parser.add_argument(
        "--ros2-vision",
        action="store_true",
        help="Disable random mock victims; ingest /victim_detections (YOLOv8 ROS pipeline)",
    )
    return parser.parse_args(argv)


def launch_controller(argv: Optional[List[str]] = None) -> DroneController:
    """Build and return a DroneController wired to Webots or headless mock."""
    import random as _random

    args = parse_controller_args(argv)
    _random.seed(args.seed)

    network_sim = NetworkSimulator(mesh_id="webots_mesh")
    use_ros_vision = bool(args.ros2_vision or os.environ.get("TASHI_ROS2_VISION") == "1")
    victim_interval = float("inf") if use_ros_vision else 30.0
    mock_data = MockDataGenerator(
        args.id,
        config.WORLD_BOUNDS,
        victim_interval=victim_interval,
        seed=args.seed,
    )

    if args.headless:
        gps = SimpleMockGPS()
        robot = SimpleMockRobot(gps)
        if args.max_steps:
            robot.max_steps = args.max_steps
        vertex = VertexNode(args.id, emulator=None)
        chain_mgr = ChainManager(args.id)
        mock_data.battery_drain_per_sec = (
            float(config.AERIAL_BATTERY_DRAIN_RATE) if args.type == "aerial" else float(config.GROUND_BATTERY_DRAIN_RATE)
        )
        ctrl = DroneController(
            args.id,
            vertex,
            chain_mgr,
            robot,
            gps,
            network_sim=network_sim,
            mock_data=mock_data,
            scenario_path=args.scenario,
            drone_type=args.type,
        )
        _attach_ros2_vision_if_requested(ctrl, args.id, use_ros_vision)
        maybe_start_lovable_cloud_sink(ctrl)
        return ctrl

    # Real Webots
    try:
        from controller import Robot as WebotsRobot  # type: ignore[import-not-found]
    except ImportError:
        logger.error("Webots controller module not found — use --headless for CI")
        raise

    wb = WebotsRobot()
    adapter = WebotsRobotAdapter(wb)
    gps_adapter = WebotsGPSAdapter(adapter.gps)
    vertex = VertexNode(args.id, emulator=None)
    chain_mgr = ChainManager(args.id)

    mock_data.battery_drain_per_sec = (
        float(config.AERIAL_BATTERY_DRAIN_RATE) if args.type == "aerial" else float(config.GROUND_BATTERY_DRAIN_RATE)
    )
    ctrl = DroneController(
        args.id,
        vertex,
        chain_mgr,
        adapter,
        gps_adapter,
        network_sim=network_sim,
        mock_data=mock_data,
        scenario_path=args.scenario,
        drone_type=args.type,
    )
    _attach_ros2_vision_if_requested(ctrl, args.id, use_ros_vision)
    maybe_start_lovable_cloud_sink(ctrl)
    return ctrl


def _attach_ros2_vision_if_requested(ctrl: DroneController, drone_id: str, enabled: bool) -> None:
    if not enabled:
        return
    try:
        from swarm.ros_vision_client import RosVisionClient
    except Exception as exc:  # pragma: no cover - optional stack
        logger.error("ROS2 vision requested but ros_vision_client unavailable: %s", exc)
        return
    try:
        client = RosVisionClient(ctrl, drone_id)
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to start ROS2 vision client (source ROS workspace?): %s", exc)
        return
    ctrl._ros_vision_client = client  # noqa: SLF001 — retain handle for lifetime
    ctrl.set_ros_spin_callback(client.spin_once)


# ---------------------------------------------------------------------------
# Entry point — can be called by Webots or from CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    ctrl = launch_controller()
    ctrl.run()
