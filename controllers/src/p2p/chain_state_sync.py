"""Map delta propagation along ordered backbone (entrance-first fanout)."""

from __future__ import annotations

from typing import Callable, List


def propagate_via_chain(
    chain_entrance_to_lead: List[str],
    apply: Callable[[str, float], None],
    delta_quality: float,
) -> None:
    """Invoke ``apply(node_id, q)`` for each hop with decayed quality."""
    q = delta_quality
    for nid in chain_entrance_to_lead:
        apply(nid, q)
        q *= 0.92
