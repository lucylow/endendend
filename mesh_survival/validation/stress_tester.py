"""Monte-Carlo delivery under configured loss/latency; swarm liveness heuristics."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple


def stress_delivery_prob(loss: float) -> float:
    return max(0.0, min(1.0, 1.0 - float(loss)))


@dataclass
class StressTester:
    seed: int
    packet_loss: float = 0.9
    one_way_latency_ms: float = 250.0

    def __post_init__(self) -> None:
        self._rng = random.Random(int(self.seed))

    def try_deliver(self) -> bool:
        return self._rng.random() < stress_delivery_prob(self.packet_loss)

    def run_broadcast_reach(
        self,
        fanout_k: int,
        hops: int,
        receivers: int,
        *,
        required_fraction: float = 0.8,
    ) -> Tuple[float, bool]:
        """Epidemic-style independent trials: approximate P(at least fraction reached)."""
        reached = 0
        for _ in range(receivers):
            alive = False
            for _h in range(hops):
                hits = sum(1 for _ in range(fanout_k) if self.try_deliver())
                if hits > 0:
                    alive = True
                    break
            if alive:
                reached += 1
        frac = reached / max(1, receivers)
        return frac, frac >= required_fraction


def monte_carlo_swarm_liveness(
    runs: int,
    *,
    loss: float,
    fanout_fn: Callable[[float], int],
    receivers: int = 20,
    hops: int = 6,
    required_fraction: float = 0.8,
    seed: int = 0,
) -> Dict[str, float]:
    """Aggregate pass rate over ``runs`` randomized trials."""
    passes = 0
    fracs: List[float] = []
    for i in range(runs):
        st = StressTester(seed=seed + i, packet_loss=loss)
        k = fanout_fn(loss)
        frac, ok = st.run_broadcast_reach(k, hops, receivers, required_fraction=required_fraction)
        fracs.append(frac)
        if ok:
            passes += 1
    return {
        "pass_rate": passes / max(1, runs),
        "mean_reach": sum(fracs) / max(1, len(fracs)),
    }
