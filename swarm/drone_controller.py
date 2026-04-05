"""Drone control loop: exploration targets + optional Webots robot."""

from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Protocol, Set, Tuple

from swarm import config
from swarm.chain_manager import ChainManager, DroneRole
from swarm.exploration import ExplorationManager
from swarm.network_simulator import MockDataGenerator, NetworkSimulator, ScenarioRunner
from swarm.target_manager import Target, TargetManager, _location_key
from swarm.vertex_node import VertexNode

if TYPE_CHECKING:
    from swarm.coordination.swarm_coordinator import SwarmCoordinator

logger = logging.getLogger(__name__)

LatencyObserver = Callable[[str, Optional[float], str, str], None]


class GPSDevice(Protocol):
    def getValues(self) -> List[float]: ...


class VelocityActuator(Protocol):
    def setVelocity(self, vx: float, vy: float, vz: float) -> None: ...


class RobotLike(Protocol):
    def step(self) -> int: ...


class SimpleMockGPS:
    def __init__(self, x: float = 0.0, y: float = 0.0) -> None:
        self.x = x
        self.y = y

    def getValues(self) -> List[float]:
        return [self.x, self.y, 0.0]

    def set_position(self, x: float, y: float) -> None:
        self.x = x
        self.y = y


class SimpleMockRobot:
    """Headless stepping robot for unit tests and CI."""

    def __init__(self, gps: SimpleMockGPS) -> None:
        self.gps = gps
        self._vx = 0.0
        self._vy = 0.0
        self.dt = 0.032  # ~32ms timestep
        self._steps = 0
        self.max_steps: Optional[int] = None

    def step(self) -> int:
        if self.max_steps is not None and self._steps >= self.max_steps:
            return 0
        self._steps += 1
        self.gps.set_position(self.gps.x + self._vx * self.dt, self.gps.y + self._vy * self.dt)
        return 1

    def set_velocity(self, vx: float, vy: float) -> None:
        self._vx = vx
        self._vy = vy


class DroneController:
    def __init__(
        self,
        node_id: str,
        vertex: VertexNode,
        chain_mgr: ChainManager,
        robot: Any,
        gps: GPSDevice,
        *,
        network_sim: Optional[NetworkSimulator] = None,
        mock_data: Optional[MockDataGenerator] = None,
        mesh_stats_interval: float = 0.0,
        mesh_stats_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        scenario_events: Optional[List[Dict[str, Any]]] = None,
        scenario_path: Optional[str] = None,
        victim_positions: Optional[List[Tuple[float, float, float]]] = None,
        drone_type: str = "aerial",
        swarm_coordinator: Optional["SwarmCoordinator"] = None,
        latency_observer: Optional[LatencyObserver] = None,
    ) -> None:
        self.node_id = node_id
        self.vertex = vertex
        self.chain_mgr = chain_mgr
        self.robot = robot
        self.gps = gps
        self.drone_type = drone_type if drone_type in ("aerial", "ground") else "aerial"
        self.victim_positions = list(victim_positions or config.DEFAULT_VICTIM_POSITIONS)
        self.exploration = ExplorationManager(node_id, vertex)
        self.chain_mgr.set_exploration_manager(self.exploration)
        self.target_manager = TargetManager(
            node_id,
            vertex,
            lambda: self.chain_mgr.role,
            self._gps_position_3d,
            self._on_target_claimed,
        )
        self.chain_mgr.set_message_handler(self._on_p2p_message)
        self.rescue_target: Optional[Target] = None
        self.behavior = "explore"
        self.network_sim = network_sim
        self.mock_data = mock_data
        self._mesh_stats_interval = mesh_stats_interval
        self._mesh_stats_callback = mesh_stats_callback
        self._last_mesh_push = 0.0
        self._last_mock_tick = time.time()
        self._last_battery_tick = time.time()
        self.battery = float(config.AERIAL_BATTERY_CAPACITY)
        self.battery_drain = (
            float(config.AERIAL_BATTERY_DRAIN_RATE)
            if self.drone_type == "aerial"
            else float(config.GROUND_BATTERY_DRAIN_RATE)
        )
        self.low_battery = False
        self.pending_handoffs: Dict[str, Dict[str, Any]] = {}
        self.handoff_bids: Dict[str, List[Tuple[str, float]]] = {}
        self.current_handoff_rescue: Optional[Tuple[str, Tuple[float, float, float]]] = None
        self._handoff_initiated_keys: Set[str] = set()
        self._rescued_victim_keys: Set[str] = set()
        self._safety_halt = False
        self._last_safety_latency_ms: Optional[float] = None
        self._latency_observer = latency_observer
        if scenario_path and network_sim is not None:
            self._start_scenario_from_path(scenario_path, network_sim)
        elif scenario_events and network_sim is not None:
            ScenarioRunner(network_sim, scenario_events).start_daemon()

    def _start_scenario_from_path(self, path: str, sim: NetworkSimulator) -> None:
        rp = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)
        with open(rp, encoding="utf-8") as f:
            events = json.load(f)
        if not isinstance(events, list):
            raise ValueError("scenario file must be a JSON array of events")
        ScenarioRunner(sim, events).start_daemon()

    def _gps_position_3d(self) -> Tuple[float, float, float]:
        pos = self.gps.getValues()
        z = float(pos[2]) if len(pos) > 2 else 0.0
        return (float(pos[0]), float(pos[1]), z)

    def _on_p2p_message(self, sender: str, msg: Dict[str, Any]) -> None:
        mt = msg.get("type")
        if mt == "SAFETY_STOP":
            self._handle_safety_stop(sender, msg)
            return
        if mt == "SAFETY_CLEAR":
            self.clear_safety_halt()
            return
        if mt == "RESCUE_HANDOFF_REQUEST":
            self._handle_handoff_request(sender, msg)
            return
        if mt == "HANDOFF_BID":
            self._handle_handoff_bid(sender, msg)
            return
        if mt == "HANDOFF_ACCEPT":
            self._handle_handoff_accept(sender, msg)
            return
        if mt == "HANDOFF_ACK":
            self._handle_handoff_ack(sender, msg)
            return
        if mt == "RESCUE_COMPLETE":
            self._handle_rescue_complete(sender, msg)
            return
        if mt in (
            "VICTIM_DETECTED",
            "TARGET_ANNOUNCEMENT",
            "TARGET_UPDATE",
            "TARGET_CLAIM",
            "TARGET_RESOLVED",
        ):
            self.target_manager.handle_message(sender, msg)

    def _on_target_claimed(self, target: Target) -> None:
        if self.chain_mgr.role == DroneRole.EXPLORER:
            self.chain_mgr.role = DroneRole.STANDBY
        self.behavior = "rescue"
        self.rescue_target = target

    def check_for_victims(self) -> None:
        if self.drone_type != "aerial":
            return
        pos = self._gps_position_3d()
        for victim_pos in self.victim_positions:
            dx = pos[0] - victim_pos[0]
            dy = pos[1] - victim_pos[1]
            dz = pos[2] - victim_pos[2]
            if math.sqrt(dx * dx + dy * dy + dz * dz) >= config.VICTIM_DETECTION_DISTANCE:
                continue
            key = _location_key(victim_pos)
            if key in self._rescued_victim_keys or key in self._handoff_initiated_keys:
                continue
            if self.low_battery:
                self._handoff_initiated_keys.add(key)
                self.initiate_handoff(victim_pos)
            else:
                self.target_manager.detect_target(victim_pos, confidence=1.0)

    def initiate_handoff(self, victim_pos: Tuple[float, float, float]) -> None:
        if self.drone_type != "aerial" or not self.low_battery:
            return
        handoff_id = f"handoff_{time.time_ns()}_{self.node_id}"
        deadline = time.time() + config.HANDOFF_BID_WINDOW_SEC
        self.pending_handoffs[handoff_id] = {"victim": victim_pos, "deadline": deadline}
        self.handoff_bids[handoff_id] = []
        self.vertex.broadcast(
            {
                "type": "RESCUE_HANDOFF_REQUEST",
                "handoff_id": handoff_id,
                "victim_location": [victim_pos[0], victim_pos[1], victim_pos[2]],
                "battery": self.battery,
                "deadline": deadline,
                "requester": self.node_id,
            }
        )
        timer = threading.Timer(config.HANDOFF_BID_WINDOW_SEC, self._process_handoff_bids, args=(handoff_id,))
        timer.daemon = True
        timer.start()

    def _parse_location(self, raw: Any) -> Optional[Tuple[float, float, float]]:
        if isinstance(raw, (list, tuple)) and len(raw) >= 3:
            return (float(raw[0]), float(raw[1]), float(raw[2]))
        return None

    def _handle_handoff_request(self, sender: str, msg: Dict[str, Any]) -> None:
        if self.drone_type != "ground":
            return
        if self.current_handoff_rescue is not None or self.target_manager.claimed_target is not None:
            return
        if self.behavior == "rescue":
            return
        victim_pos = self._parse_location(msg.get("victim_location"))
        if victim_pos is None:
            return
        handoff_id = str(msg.get("handoff_id", ""))
        if not handoff_id:
            return
        my_pos = self._gps_position_3d()
        dx, dy, dz = my_pos[0] - victim_pos[0], my_pos[1] - victim_pos[1], my_pos[2] - victim_pos[2]
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        need = distance * float(config.GROUND_BATTERY_PER_METER) + float(config.GROUND_BATTERY_RESERVE)
        if self.battery < need:
            return
        eta_sec = max(distance / max(config.DRONE_MAX_SPEED, 0.1), 0.0)
        self.vertex.send(
            sender,
            {
                "type": "HANDOFF_BID",
                "handoff_id": handoff_id,
                "bid": distance,
                "eta_sec": eta_sec,
                "bidder": self.node_id,
                "victim_location": [victim_pos[0], victim_pos[1], victim_pos[2]],
                "battery": self.battery,
            },
        )

    def _handle_handoff_bid(self, sender: str, msg: Dict[str, Any]) -> None:
        if self.drone_type != "aerial":
            return
        handoff_id = str(msg.get("handoff_id", ""))
        if not handoff_id or handoff_id not in self.pending_handoffs:
            return
        bidder = str(msg.get("bidder", sender))
        try:
            bid_val = float(msg.get("bid", 1e9))
        except (TypeError, ValueError):
            bid_val = 1e9
        if handoff_id not in self.handoff_bids:
            self.handoff_bids[handoff_id] = []
        self.handoff_bids[handoff_id].append((bidder, bid_val))

    def _process_handoff_bids(self, handoff_id: str) -> None:
        if handoff_id not in self.pending_handoffs:
            return
        bids = self.handoff_bids.pop(handoff_id, [])
        meta = self.pending_handoffs.pop(handoff_id, None)
        if meta is None:
            return
        victim_pos = meta["victim"]
        if not bids:
            logger.warning("Handoff %s: no bids from ground rovers", handoff_id)
            self._handoff_initiated_keys.discard(_location_key(victim_pos))
            return
        best_bidder, _ = min(bids, key=lambda x: x[1])
        self.vertex.send(
            best_bidder,
            {
                "type": "HANDOFF_ACCEPT",
                "handoff_id": handoff_id,
                "victim_location": [victim_pos[0], victim_pos[1], victim_pos[2]],
                "aerial": self.node_id,
            },
        )

    def _handle_handoff_accept(self, sender: str, msg: Dict[str, Any]) -> None:
        if self.drone_type != "ground":
            return
        handoff_id = str(msg.get("handoff_id", ""))
        victim_pos = self._parse_location(msg.get("victim_location"))
        if not handoff_id or victim_pos is None:
            return
        aerial = str(msg.get("aerial", sender))
        self.vertex.send(
            aerial,
            {
                "type": "HANDOFF_ACK",
                "handoff_id": handoff_id,
                "receiver": self.node_id,
            },
        )
        self.current_handoff_rescue = (handoff_id, victim_pos)
        self.behavior = "rescue"
        self.rescue_target = None

    def _handle_handoff_ack(self, _sender: str, msg: Dict[str, Any]) -> None:
        if self.drone_type != "aerial":
            return
        handoff_id = str(msg.get("handoff_id", ""))
        self.handoff_bids.pop(handoff_id, None)

    def _handle_rescue_complete(self, _sender: str, msg: Dict[str, Any]) -> None:
        victim_pos = self._parse_location(msg.get("victim_location"))
        if victim_pos is not None:
            self._rescued_victim_keys.add(_location_key(victim_pos))

    def _update_battery(self, dt: float) -> None:
        if dt <= 0:
            return
        self.battery -= self.battery_drain * dt
        if self.battery < 0.0:
            self.battery = 0.0
        if self.drone_type == "aerial":
            self.low_battery = self.battery < float(config.BATTERY_HANDOFF_THRESHOLD)
        else:
            self.low_battery = False

    def get_state_for_dashboard(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "behavior": self.behavior,
            "role": self.chain_mgr.role.value,
            "drone_type": self.drone_type,
            "battery": self.battery,
            "low_battery": self.low_battery,
            "targets": self.target_manager.targets_for_ui(),
            "claimed_target_id": self.target_manager.claimed_target,
            "pending_handoffs": list(self.pending_handoffs.keys()),
            "handoff_rescue": self.current_handoff_rescue is not None,
            "safety_halt": self._safety_halt,
            "last_safety_latency_ms": self._last_safety_latency_ms,
        }

    def run(self) -> None:
        while self.robot.step():
            self.tick()

    def tick(self) -> None:
        now = time.time()
        bdt = now - self._last_battery_tick
        self._last_battery_tick = now
        if self.mock_data is None:
            self._update_battery(bdt)
        self._tick_mock_and_mesh(now)
        self.target_manager.tick()
        self.exploration.update()
        self.check_for_victims()
        if self._safety_halt and hasattr(self.robot, "set_velocity"):
            self.robot.set_velocity(0.0, 0.0)
            return
        if self.behavior == "rescue":
            self._do_rescue()
            return
        if self.behavior == "explore":
            self._do_explore()
        elif self.behavior == "relay":
            self._do_relay()

    def _tick_mock_and_mesh(self, now: float) -> None:
        if self.mock_data is not None:
            dt = now - self._last_mock_tick
            self._last_mock_tick = now
            self.mock_data.tick_battery(dt)
            self.battery = float(self.mock_data.battery_pct)
            if self.drone_type == "aerial":
                self.low_battery = self.battery < float(config.BATTERY_HANDOFF_THRESHOLD)
            victim = self.mock_data.generate(now)
            if victim is not None:
                self.vertex.broadcast(victim)
                loc = victim.get("location")
                if isinstance(loc, (list, tuple)) and len(loc) >= 3:
                    vpos = (float(loc[0]), float(loc[1]), float(loc[2]))
                    vkey = _location_key(vpos)
                    if (
                        self.drone_type == "aerial"
                        and self.low_battery
                        and vkey not in self._rescued_victim_keys
                        and vkey not in self._handoff_initiated_keys
                    ):
                        self._handoff_initiated_keys.add(vkey)
                        self.initiate_handoff(vpos)
                    elif self.drone_type == "aerial":
                        self.target_manager.detect_target(
                            vpos,
                            float(victim.get("confidence", 1.0)),
                        )
        if (
            self.network_sim is not None
            and self._mesh_stats_callback is not None
            and self._mesh_stats_interval > 0
            and now - self._last_mesh_push >= self._mesh_stats_interval
        ):
            self._last_mesh_push = now
            self._mesh_stats_callback(self.network_sim.get_mesh_snapshot())
        self.vertex.tick_mesh(now)
        self.vertex.tick_peer_gossip(now)
        if self.swarm_coordinator is not None:
            self.swarm_coordinator.tick(now=now)

    def _do_relay(self) -> None:
        if hasattr(self.robot, "set_velocity"):
            self.robot.set_velocity(0.0, 0.0)

    def _do_rescue(self) -> None:
        if self._safety_halt:
            if hasattr(self.robot, "set_velocity"):
                self.robot.set_velocity(0.0, 0.0)
            return
        if self.current_handoff_rescue is not None:
            handoff_id, loc = self.current_handoff_rescue
            pos = self._gps_position_3d()
            dx, dy, dz = loc[0] - pos[0], loc[1] - pos[1], loc[2] - pos[2]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            if dist < config.RESCUE_ARRIVAL_DISTANCE:
                self.vertex.broadcast(
                    {
                        "type": "RESCUE_COMPLETE",
                        "handoff_id": handoff_id,
                        "victim_location": [loc[0], loc[1], loc[2]],
                        "rescuer": self.node_id,
                    }
                )
                self._rescued_victim_keys.add(_location_key(loc))
                self.current_handoff_rescue = None
                self.behavior = "explore"
                return
            speed = min(config.DRONE_MAX_SPEED, dist / 2.0)
            if dist > 1e-9:
                vx = speed * dx / dist
                vy = speed * dy / dist
            else:
                vx, vy = 0.0, 0.0
            if hasattr(self.robot, "set_velocity"):
                self.robot.set_velocity(vx, vy)
            return

        if self.target_manager.claimed_target is None:
            self.behavior = "explore"
            self.rescue_target = None
            return
        if not self.rescue_target:
            self.behavior = "explore"
            return
        pos = self._gps_position_3d()
        loc = self.rescue_target.location
        dx = loc[0] - pos[0]
        dy = loc[1] - pos[1]
        dz = loc[2] - pos[2]
        dist = math.sqrt(dx * dx + dy * dy + dz * dz)
        if dist < config.RESCUE_ARRIVAL_DISTANCE:
            if self.target_manager.reached_target():
                self.behavior = "explore"
                self.rescue_target = None
            return
        speed = min(config.DRONE_MAX_SPEED, dist / 2.0)
        if dist > 1e-9:
            vx = speed * dx / dist
            vy = speed * dy / dist
        else:
            vx, vy = 0.0, 0.0
        if hasattr(self.robot, "set_velocity"):
            self.robot.set_velocity(vx, vy)

    def _do_explore(self) -> None:
        if self._safety_halt:
            if hasattr(self.robot, "set_velocity"):
                self.robot.set_velocity(0.0, 0.0)
            return
        if self.chain_mgr.role == DroneRole.RELAY:
            self._do_relay()
            return
        pos = self.gps.getValues()
        current_pos = (float(pos[0]), float(pos[1]))
        target_cell = self.exploration.current_target
        if target_cell is None:
            target_cell = self.exploration.choose_next_target(current_pos)
        if target_cell is None:
            if hasattr(self.robot, "set_velocity"):
                self.robot.set_velocity(0.0, 0.0)
            return
        target_x, target_y = self.exploration.map.cell_center_meters(target_cell)
        dx = target_x - current_pos[0]
        dy = target_y - current_pos[1]
        distance = math.hypot(dx, dy)
        if distance < 0.5:
            self.exploration.reached_target(target_cell)
            return
        speed = min(config.DRONE_MAX_SPEED, distance / 2.0)
        angle = math.atan2(dy, dx)
        vx = speed * math.cos(angle)
        vy = speed * math.sin(angle)
        if hasattr(self.robot, "set_velocity"):
            self.robot.set_velocity(vx, vy)

    def set_velocity(self, vx: float, vy: float) -> None:
        if hasattr(self.robot, "set_velocity"):
            self.robot.set_velocity(vx, vy)
