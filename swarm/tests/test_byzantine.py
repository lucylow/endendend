"""Byzantine injector + JSON config loading."""

import json
from pathlib import Path

from swarm.byzantine import ByzantineInjector, NodeFaultSpec, load_byzantine_config


def test_injector_drop(tmp_path: Path):
    inj = ByzantineInjector({"n1": NodeFaultSpec("drop", 1.0)}, seed=42)
    assert inj.transform("n1", {"type": "PING"}) is None


def test_injector_corrupt():
    inj = ByzantineInjector({"n1": NodeFaultSpec("corrupt", 1.0)}, seed=1)
    out = inj.transform("n1", {"type": "STATE", "value": 3})
    assert out is not None
    assert out.get("_byzantine_corrupt") is True


def test_load_json_config(tmp_path: Path):
    p = tmp_path / "cfg.json"
    p.write_text(
        json.dumps({"nodes": {"x": {"type": "drop", "prob": 0.5}}}),
        encoding="utf-8",
    )
    specs = load_byzantine_config(str(p))
    assert specs["x"].fault_type == "drop"
    assert specs["x"].probability == 0.5
