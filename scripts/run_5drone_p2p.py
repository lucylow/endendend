#!/usr/bin/env python3
"""Launch 5-drone swarm with P2P coordination, bully election, and network emulation.

This script:
1. Initializes per-drone P2P servers on ports 9001-9005
2. Starts bully election for explorer role
3. Configures network emulation for blackout environment
4. Runs Webots simulation with coordinated drones
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add swarm module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from swarm.bully_election import BullyElection
from swarm.chain_manager_enhanced import EnhancedChainManager, DroneRole
from swarm.network_emulation_config import BlackoutEnvironmentSimulator, NetworkScenario
from swarm.p2p_server import P2PServer
from swarm.partition_handler import PartitionHandler

LOG = logging.getLogger(__name__)


class DroneCoordinator:
    """Coordinates a single drone's P2P server, election, and state management."""

    def __init__(
        self,
        node_id: str,
        port: int,
        depth: float,
        all_node_ids: List[str],
    ) -> None:
        self.node_id = node_id
        self.port = port
        self.depth = depth
        self.all_node_ids = all_node_ids

        # Initialize components
        self.p2p_server = P2PServer(
            node_id=node_id,
            host="127.0.0.1",
            port=port,
            on_message=self._on_p2p_message,
        )

        self.election = BullyElection(
            node_id=node_id,
            all_nodes=all_node_ids,
            depth=depth,
            battery=100.0,
            on_elected=self._on_elected,
            on_lost_election=self._on_lost_election,
        )

        self.chain_manager = EnhancedChainManager(
            node_id=node_id,
            on_state_update=self._on_state_update,
            on_role_change=self._on_role_change,
        )

        self.partition_handler = PartitionHandler(
            node_id=node_id,
            on_partition_detected=self._on_partition_detected,
            on_partition_recovered=self._on_partition_recovered,
            on_peer_timeout=self._on_peer_timeout,
        )

        self.partition_handler.set_expected_peers(all_node_ids)
        self._running = False
        self._tick_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Start the coordinator."""
        LOG.info(f"[{self.node_id}] Starting coordinator")
        self.p2p_server.initialize()
        self.p2p_server.start()
        self._running = True

        # Start election
        self.election.start_election()

        # Start tick thread
        self._tick_thread = threading.Thread(
            target=self._tick_loop,
            daemon=True,
            name=f"coordinator_{self.node_id}",
        )
        self._tick_thread.start()

    def stop(self) -> None:
        """Stop the coordinator."""
        LOG.info(f"[{self.node_id}] Stopping coordinator")
        self._running = False
        self.p2p_server.stop()
        if self._tick_thread is not None:
            self._tick_thread.join(timeout=2.0)

    def _tick_loop(self) -> None:
        """Main coordinator tick loop."""
        while self._running:
            try:
                now_ms = int(time.time() * 1000)

                # Election tick
                leader = self.election.tick(now_ms)
                if leader:
                    LOG.info(f"[{self.node_id}] Election result: leader={leader}")

                # Partition detection tick
                partition_status = self.partition_handler.tick(now_ms)
                if partition_status["partition_state"] != "healthy":
                    LOG.warning(f"[{self.node_id}] Partition status: {partition_status}")

                # Broadcast heartbeat
                self._broadcast_heartbeat()

                time.sleep(1.0)  # Tick every second

            except Exception as e:
                LOG.error(f"[{self.node_id}] Tick error: {e}")

    def _broadcast_heartbeat(self) -> None:
        """Broadcast heartbeat to all peers."""
        payload = {
            "role": self.chain_manager.role.value,
            "depth": self.chain_manager.depth,
            "battery": self.chain_manager.battery,
            "leader": self.election.current_leader,
            "election_state": self.election.state.value,
        }
        self.p2p_server.broadcast_message("HEARTBEAT", payload)

    def _on_p2p_message(self, sender: str, msg: Dict[str, Any]) -> None:
        """Handle incoming P2P message."""
        msg_type = msg.get("message_kind")
        payload = msg.get("payload", {})

        if msg_type == "HEARTBEAT":
            self.partition_handler.record_heartbeat(sender)
            role = payload.get("role", "standby")
            depth = payload.get("depth", 0.0)
            battery = payload.get("battery", 100.0)
            self.chain_manager.update_peer_state(sender, role, depth, battery)
            self.election.receive_election_message(sender, depth, battery)

        elif msg_type == "ELECTION_WIN":
            leader = payload.get("leader", sender)
            depth = payload.get("depth", 0.0)
            battery = payload.get("battery", 100.0)
            self.election.receive_election_win(leader, depth, battery)

        elif msg_type == "ROLE_ANNOUNCE":
            self.partition_handler.record_role_announce(sender, payload)
            self.chain_manager.handle_message(sender, msg)

    def _on_elected(self) -> None:
        """Called when this drone is elected as leader."""
        LOG.info(f"[{self.node_id}] ELECTED as leader")
        self.chain_manager.set_role(DroneRole.EXPLORER)
        self._broadcast_election_win()

    def _on_lost_election(self) -> None:
        """Called when this drone loses election."""
        LOG.info(f"[{self.node_id}] Lost election, becoming follower")
        self.chain_manager.set_role(DroneRole.RELAY)

    def _broadcast_election_win(self) -> None:
        """Broadcast election win to all peers."""
        payload = {
            "leader": self.node_id,
            "depth": self.depth,
            "battery": self.chain_manager.battery,
        }
        self.p2p_server.broadcast_message("ELECTION_WIN", payload)

    def _on_state_update(self, state: Dict[str, Any]) -> None:
        """Called when topology state changes."""
        LOG.debug(f"[{self.node_id}] State update: {state['role']}")

    def _on_role_change(self, role: DroneRole) -> None:
        """Called when role changes."""
        LOG.info(f"[{self.node_id}] Role changed to {role.value}")
        payload = {
            "role": role.value,
            "depth": self.depth,
            "battery": self.chain_manager.battery,
        }
        self.p2p_server.broadcast_message("ROLE_ANNOUNCE", payload)

    def _on_partition_detected(self, reason: str) -> None:
        """Called when partition is detected."""
        LOG.error(f"[{self.node_id}] PARTITION DETECTED: {reason}")

    def _on_partition_recovered(self) -> None:
        """Called when partition is recovered."""
        LOG.info(f"[{self.node_id}] Partition recovered")

    def _on_peer_timeout(self, peer_id: str) -> None:
        """Called when a peer times out."""
        LOG.warning(f"[{self.node_id}] Peer timeout: {peer_id}")
        self.chain_manager.mark_peer_dead(peer_id)


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="5-Drone P2P Swarm Coordinator")
    parser.add_argument("--scenario", default="healthy", help="Network scenario")
    parser.add_argument("--duration-s", type=int, default=60, help="Simulation duration")
    parser.add_argument("--log-level", default="INFO", help="Logging level")
    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="[%(asctime)s] %(name)s - %(levelname)s - %(message)s",
    )

    LOG.info("Starting 5-drone P2P swarm coordinator")

    # Drone configuration
    drone_config = [
        ("drone_0", 9001, 50.0),  # Explorer (deepest)
        ("drone_1", 9002, 40.0),  # Relay 1
        ("drone_2", 9003, 30.0),  # Relay 2
        ("drone_3", 9004, 20.0),  # Standby 1
        ("drone_4", 9005, 10.0),  # Standby 2 (shallowest)
    ]

    all_node_ids = [cfg[0] for cfg in drone_config]
    coordinators: Dict[str, DroneCoordinator] = {}

    # Initialize coordinators
    for node_id, port, depth in drone_config:
        coordinator = DroneCoordinator(
            node_id=node_id,
            port=port,
            depth=depth,
            all_node_ids=all_node_ids,
        )
        coordinators[node_id] = coordinator
        coordinator.start()

    # Initialize network emulation
    drone_ports = [cfg[1] for cfg in drone_config]
    network_sim = BlackoutEnvironmentSimulator(drone_ports)

    # Apply scenario
    try:
        scenario = NetworkScenario[args.scenario.upper()]
    except KeyError:
        LOG.warning(f"Unknown scenario {args.scenario}, using HEALTHY")
        scenario = NetworkScenario.HEALTHY

    network_sim.apply_scenario(scenario)
    LOG.info(f"Applied network scenario: {scenario.value}")

    # Run for specified duration
    try:
        LOG.info(f"Running simulation for {args.duration_s} seconds")
        time.sleep(args.duration_s)

    except KeyboardInterrupt:
        LOG.info("Interrupted by user")

    finally:
        # Cleanup
        LOG.info("Shutting down")
        for coordinator in coordinators.values():
            coordinator.stop()
        network_sim.cleanup()
        LOG.info("Shutdown complete")


if __name__ == "__main__":
    main()
