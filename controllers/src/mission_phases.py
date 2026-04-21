"""Mission phase labels from ingress / partition state."""

from __future__ import annotations


def mission_phase(ingress_quality: float, partitioned: bool, t: float) -> str:
    if partitioned:
        return "partitioned"
    if t < 2.0:
        return "tunnel_entry"
    if ingress_quality > 0.82:
        return "stable"
    if ingress_quality > 0.62:
        return "weakening"
    if ingress_quality > 0.38:
        return "intermittent"
    return "relay_dependent"
