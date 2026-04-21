"""Two-way geographic split: isolated clocks/state then deterministic merge."""

from __future__ import annotations

from typing import Dict, List, Mapping, Tuple

from mesh_survival.networking.partition_detector import GossipClock


def simulate_two_way_split(
    nodes: List[str],
) -> Tuple[List[str], List[str]]:
    mid = max(1, len(nodes) // 2)
    return nodes[:mid], nodes[mid:]


def merge_partitions(
    clock_a: Mapping[str, int],
    clock_b: Mapping[str, int],
) -> Dict[str, int]:
    gc = GossipClock()
    gc.observe(clock_a)
    return gc.merge_final(clock_b)
