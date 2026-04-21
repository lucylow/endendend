"""BFT-oriented helpers under extreme loss: adaptive fan-out, virtual vote aggregation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, Tuple

from mesh_survival.networking.adaptive_gossip import adaptive_fanout_k


@dataclass(frozen=True)
class ResilientMeshConfig:
    k_min: int = 3
    k_max: int = 8
    emergency_loss_threshold: float = 0.95


def fanout_for_loss(loss: float, cfg: ResilientMeshConfig) -> int:
    return adaptive_fanout_k(loss, k_min=cfg.k_min, k_max=cfg.k_max)


def emergency_flood_mode(loss: float, cfg: ResilientMeshConfig) -> bool:
    """When loss is catastrophic, callers should bypass DV and use signed flood."""
    return loss >= cfg.emergency_loss_threshold


def virtual_vote_tally(
    receipts: Iterable[Mapping[str, object]],
    *,
    proposal_key: str = "proposal_id",
    voter_key: str = "voter",
) -> Tuple[str, int]:
    """Tally duplicate-safe votes carried on state/heartbeat payloads (no extra messages)."""
    counts: Dict[str, set] = {}
    for r in receipts:
        pid = str(r.get(proposal_key, ""))
        vid = str(r.get(voter_key, ""))
        if not pid or not vid:
            continue
        counts.setdefault(pid, set()).add(vid)
    if not counts:
        return "", 0
    best = max(counts.items(), key=lambda kv: len(kv[1]))
    return best[0], len(best[1])
