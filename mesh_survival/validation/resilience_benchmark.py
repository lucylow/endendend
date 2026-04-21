"""Fast automated survival checks (CI-friendly small run counts)."""

from __future__ import annotations

from typing import Dict

from mesh_survival.networking.adaptive_gossip import adaptive_fanout_k
from mesh_survival.validation.stress_tester import monte_carlo_swarm_liveness


def quick_resilience_suite(*, runs: int = 24, loss: float = 0.9) -> Dict[str, float]:
    """90%% loss smoke: expect high fan-out to keep epidemic reach reasonable."""
    stats = monte_carlo_swarm_liveness(
        runs,
        loss=loss,
        fanout_fn=adaptive_fanout_k,
        receivers=32,
        hops=8,
        required_fraction=0.78,
        seed=2026,
    )
    stats["fanout_at_loss"] = float(adaptive_fanout_k(loss))
    return stats
