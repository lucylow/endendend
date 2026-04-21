"""Network emulation configuration for blackout environment.

Configures tc (traffic control) rules and network impairment scenarios
for simulating blackout, congestion, and partition conditions.
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

LOG = logging.getLogger(__name__)


class NetworkScenario(Enum):
    """Predefined network scenarios."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CONGESTED = "congested"
    BLACKOUT = "blackout"
    PARTITION = "partition"
    RECOVERY = "recovery"


@dataclass(slots=True)
class LinkImpairment:
    """Network link impairment parameters."""
    loss_percent: float = 0.0  # Packet loss (0-100%)
    latency_ms: float = 0.0  # Latency in milliseconds
    jitter_ms: float = 0.0  # Jitter in milliseconds
    bandwidth_mbps: float = 100.0  # Bandwidth in Mbps
    corruption_percent: float = 0.0  # Corruption (0-100%)


class NetworkEmulationConfig:
    """Configure network impairments using tc (traffic control)."""

    def __init__(self, interface: str = "lo") -> None:
        self.interface = interface
        self._active_rules: Dict[Tuple[int, int], LinkImpairment] = {}

    def apply_impairment(
        self,
        source_port: int,
        dest_port: int,
        impairment: LinkImpairment,
    ) -> bool:
        """Apply network impairment to a link using tc."""
        try:
            # Remove existing rule if present
            self._remove_impairment(source_port, dest_port)

            # Build tc command
            cmd = self._build_tc_command(source_port, dest_port, impairment)
            LOG.debug(f"Applying impairment: {cmd}")

            # Execute tc command
            subprocess.run(cmd, shell=True, check=True, capture_output=True)
            self._active_rules[(source_port, dest_port)] = impairment
            LOG.info(f"Applied impairment {source_port}->{dest_port}: loss={impairment.loss_percent}%, latency={impairment.latency_ms}ms")
            return True

        except Exception as e:
            LOG.error(f"Failed to apply impairment: {e}")
            return False

    def _build_tc_command(
        self,
        source_port: int,
        dest_port: int,
        impairment: LinkImpairment,
    ) -> str:
        """Build tc command string."""
        # Note: This is a simplified version. Real implementation would need
        # iptables rules to match specific ports and apply qdisc.
        cmd_parts = [
            f"tc qdisc add dev {self.interface} root netem",
            f"loss {impairment.loss_percent}%",
            f"delay {impairment.latency_ms}ms {impairment.jitter_ms}ms",
            f"corrupt {impairment.corruption_percent}%",
        ]
        return " ".join(cmd_parts)

    def _remove_impairment(self, source_port: int, dest_port: int) -> None:
        """Remove network impairment rule."""
        try:
            subprocess.run(
                f"tc qdisc del dev {self.interface} root",
                shell=True,
                check=False,
                capture_output=True,
            )
            self._active_rules.pop((source_port, dest_port), None)
        except Exception as e:
            LOG.debug(f"Failed to remove impairment: {e}")

    def clear_all(self) -> None:
        """Clear all active impairment rules."""
        try:
            subprocess.run(
                f"tc qdisc del dev {self.interface} root",
                shell=True,
                check=False,
                capture_output=True,
            )
            self._active_rules.clear()
            LOG.info("Cleared all network impairments")
        except Exception as e:
            LOG.error(f"Failed to clear impairments: {e}")

    @staticmethod
    def get_scenario_impairments(scenario: NetworkScenario) -> Dict[str, LinkImpairment]:
        """Get predefined impairments for a scenario."""
        scenarios = {
            NetworkScenario.HEALTHY: {
                "default": LinkImpairment(loss_percent=0.0, latency_ms=1.0),
            },
            NetworkScenario.DEGRADED: {
                "default": LinkImpairment(loss_percent=5.0, latency_ms=50.0, jitter_ms=10.0),
            },
            NetworkScenario.CONGESTED: {
                "default": LinkImpairment(loss_percent=10.0, latency_ms=100.0, jitter_ms=20.0),
            },
            NetworkScenario.BLACKOUT: {
                "default": LinkImpairment(loss_percent=100.0, latency_ms=1000.0),
            },
            NetworkScenario.PARTITION: {
                "partition_1": LinkImpairment(loss_percent=100.0),
                "partition_2": LinkImpairment(loss_percent=100.0),
            },
            NetworkScenario.RECOVERY: {
                "default": LinkImpairment(loss_percent=2.0, latency_ms=20.0, jitter_ms=5.0),
            },
        }
        return scenarios.get(scenario, scenarios[NetworkScenario.HEALTHY])


class BlackoutEnvironmentSimulator:
    """Simulates blackout environment with network partitions."""

    def __init__(self, drone_ports: List[int]) -> None:
        self.drone_ports = drone_ports
        self.emulator = NetworkEmulationConfig()
        self._current_scenario = NetworkScenario.HEALTHY

    def apply_scenario(self, scenario: NetworkScenario) -> None:
        """Apply a network scenario."""
        LOG.info(f"Applying scenario: {scenario.value}")
        self._current_scenario = scenario

        if scenario == NetworkScenario.HEALTHY:
            self._apply_healthy()
        elif scenario == NetworkScenario.DEGRADED:
            self._apply_degraded()
        elif scenario == NetworkScenario.CONGESTED:
            self._apply_congested()
        elif scenario == NetworkScenario.BLACKOUT:
            self._apply_blackout()
        elif scenario == NetworkScenario.PARTITION:
            self._apply_partition()
        elif scenario == NetworkScenario.RECOVERY:
            self._apply_recovery()

    def _apply_healthy(self) -> None:
        """Apply healthy network scenario."""
        impairment = LinkImpairment(loss_percent=0.0, latency_ms=1.0)
        for src_port in self.drone_ports:
            for dst_port in self.drone_ports:
                if src_port != dst_port:
                    self.emulator.apply_impairment(src_port, dst_port, impairment)

    def _apply_degraded(self) -> None:
        """Apply degraded network scenario."""
        impairment = LinkImpairment(loss_percent=5.0, latency_ms=50.0, jitter_ms=10.0)
        for src_port in self.drone_ports:
            for dst_port in self.drone_ports:
                if src_port != dst_port:
                    self.emulator.apply_impairment(src_port, dst_port, impairment)

    def _apply_congested(self) -> None:
        """Apply congested network scenario."""
        impairment = LinkImpairment(loss_percent=10.0, latency_ms=100.0, jitter_ms=20.0)
        for src_port in self.drone_ports:
            for dst_port in self.drone_ports:
                if src_port != dst_port:
                    self.emulator.apply_impairment(src_port, dst_port, impairment)

    def _apply_blackout(self) -> None:
        """Apply blackout scenario (all links down)."""
        impairment = LinkImpairment(loss_percent=100.0, latency_ms=1000.0)
        for src_port in self.drone_ports:
            for dst_port in self.drone_ports:
                if src_port != dst_port:
                    self.emulator.apply_impairment(src_port, dst_port, impairment)

    def _apply_partition(self) -> None:
        """Apply partition scenario (split into two groups)."""
        # Partition: drones 0,1,2 vs drones 3,4
        group_a = self.drone_ports[:3]
        group_b = self.drone_ports[3:]

        # Healthy within groups
        healthy = LinkImpairment(loss_percent=0.0, latency_ms=1.0)
        for src in group_a:
            for dst in group_a:
                if src != dst:
                    self.emulator.apply_impairment(src, dst, healthy)
        for src in group_b:
            for dst in group_b:
                if src != dst:
                    self.emulator.apply_impairment(src, dst, healthy)

        # Blackout between groups
        blackout = LinkImpairment(loss_percent=100.0)
        for src in group_a:
            for dst in group_b:
                self.emulator.apply_impairment(src, dst, blackout)
        for src in group_b:
            for dst in group_a:
                self.emulator.apply_impairment(src, dst, blackout)

    def _apply_recovery(self) -> None:
        """Apply recovery scenario (gradual healing)."""
        impairment = LinkImpairment(loss_percent=2.0, latency_ms=20.0, jitter_ms=5.0)
        for src_port in self.drone_ports:
            for dst_port in self.drone_ports:
                if src_port != dst_port:
                    self.emulator.apply_impairment(src_port, dst_port, impairment)

    def get_current_scenario(self) -> NetworkScenario:
        """Get current scenario."""
        return self._current_scenario

    def cleanup(self) -> None:
        """Clean up all network rules."""
        self.emulator.clear_all()


# Depth-based link quality model
def calculate_link_quality(
    source_depth: float,
    dest_depth: float,
    max_depth: float = 200.0,
) -> LinkImpairment:
    """
    Calculate link quality based on depth separation (tunnel model).
    Deeper separation = worse signal.
    """
    separation = abs(source_depth - dest_depth)
    normalized_sep = separation / max_depth

    # Loss increases with depth separation
    loss_percent = min(50.0, normalized_sep ** 1.5 * 100)

    # Latency increases with depth (signal travels through rock/water)
    latency_ms = normalized_sep * 100  # 0-100ms

    # Jitter increases with poor signal
    jitter_ms = loss_percent / 10

    return LinkImpairment(
        loss_percent=loss_percent,
        latency_ms=latency_ms,
        jitter_ms=jitter_ms,
        corruption_percent=loss_percent * 0.1,
    )
