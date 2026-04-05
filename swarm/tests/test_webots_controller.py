"""Tests for webots_controller module (headless path only)."""

from __future__ import annotations

import pytest

from swarm.webots_controller import launch_controller, parse_controller_args, update_depth_links
from swarm.network_simulator import NetworkSimulator


class TestParseArgs:
    def test_defaults(self) -> None:
        args = parse_controller_args([])
        assert args.id == "drone_0"
        assert args.type == "aerial"
        assert args.seed == 42
        assert args.headless is False

    def test_custom(self) -> None:
        args = parse_controller_args(["--id", "rover_3", "--type", "ground", "--headless", "--max-steps", "100"])
        assert args.id == "rover_3"
        assert args.type == "ground"
        assert args.headless is True
        assert args.max_steps == 100


class TestDepthLinks:
    def test_loss_increases_with_separation(self) -> None:
        sim = NetworkSimulator("test")
        update_depth_links(sim, "a", 0.0, {"b": 100.0, "c": 10.0})
        stats = sim.get_link_stats()
        ab = stats.get("a|b", {})
        ac = stats.get("a|c", {})
        assert ab["loss"] > ac["loss"]

    def test_self_excluded(self) -> None:
        sim = NetworkSimulator("test")
        update_depth_links(sim, "a", 50.0, {"a": 50.0, "b": 0.0})
        stats = sim.get_link_stats()
        assert "a|a" not in stats


class TestHeadlessLaunch:
    def test_launch_headless(self) -> None:
        ctrl = launch_controller(["--headless", "--id", "test_1", "--max-steps", "5"])
        assert ctrl.node_id == "test_1"
        # Run a few steps
        ctrl.run()
        state = ctrl.get_state_for_dashboard()
        assert state["node_id"] == "test_1"
