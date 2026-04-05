"""Runtime Byzantine fault injection for mesh sends (no external injector required).

Load optional JSON (``byzantine_config.json``) or YAML if PyYAML is installed.
Apply from :meth:`ByzantineInjector.transform` inside
:class:`swarm.vertex_node.VertexNode` before fan-out.

Uses local randomness only — no network / DNS / NTP.
"""

from __future__ import annotations

import copy
import json
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None


@dataclass
class NodeFaultSpec:
    fault_type: str = "none"  # none | drop | corrupt
    probability: float = 0.0


def _parse_spec(raw: Any) -> NodeFaultSpec:
    if raw is None:
        return NodeFaultSpec()
    if isinstance(raw, dict):
        return NodeFaultSpec(
            fault_type=str(raw.get("type", "none")),
            probability=float(raw.get("prob", raw.get("probability", 0.0))),
        )
    return NodeFaultSpec()


def _load_config_file(p: Path) -> Dict[str, Any]:
    text = p.read_text(encoding="utf-8")
    if p.suffix.lower() in (".json",):
        return json.loads(text) if text.strip() else {}
    if yaml is not None:
        return yaml.safe_load(text) or {}
    return {}


def load_byzantine_config(path: Optional[str] = None) -> Dict[str, NodeFaultSpec]:
    """Load ``nodes: { node_id: { type, prob } }`` from JSON or YAML. Returns empty if missing."""
    env_path = os.environ.get("SWARM_BYZANTINE_CONFIG")
    candidates: list[Path] = []
    if path:
        candidates.append(Path(path))
    elif env_path:
        candidates.append(Path(env_path))
    else:
        candidates.extend([Path("byzantine_config.json"), Path("byzantine_config.yaml")])
    for p in candidates:
        if not p.is_file():
            continue
        try:
            data = _load_config_file(p)
        except (OSError, json.JSONDecodeError, ValueError):
            continue
        nodes = data.get("nodes") or {}
        out: Dict[str, NodeFaultSpec] = {}
        for nid, spec in nodes.items():
            out[str(nid)] = _parse_spec(spec)
        return out
    return {}


class ByzantineInjector:
    """Per-node probabilistic drop/corrupt on outbound control messages."""

    def __init__(self, specs: Dict[str, NodeFaultSpec], seed: Optional[int] = None) -> None:
        self._specs = specs
        self._rng = random.Random(seed)

    @classmethod
    def from_env(cls) -> "ByzantineInjector":
        return cls(load_byzantine_config(), seed=None)

    def spec_for(self, node_id: str) -> NodeFaultSpec:
        return self._specs.get(node_id, NodeFaultSpec())

    def transform(self, node_id: str, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        spec = self.spec_for(node_id)
        if spec.fault_type == "none" or spec.probability <= 0:
            return message
        if self._rng.random() >= spec.probability:
            return message
        if spec.fault_type == "drop":
            return None
        if spec.fault_type == "corrupt":
            corrupted = copy.deepcopy(message)
            corrupted["_byzantine_corrupt"] = True
            if "value" in corrupted:
                corrupted["value"] = f"corrupt:{corrupted['value']}"
            elif "type" in corrupted:
                corrupted["type"] = str(corrupted["type"]) + "_X"
            return corrupted
        return message


