"""Scenario abstraction: deterministic world generation + metadata."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional


@dataclass
class WorldArtifacts:
    """Files emitted beside the ``.wbt``."""

    metadata: Dict[str, Any]
    extras: Dict[str, Dict[str, Any]] = field(default_factory=dict)


@dataclass
class WorldContext:
    scenario: str
    seed: int
    wbt_text: str
    artifacts: WorldArtifacts
    world_filename: str

    def write(self, worlds_dir: Path, maps_dir: Path) -> Path:
        worlds_dir.mkdir(parents=True, exist_ok=True)
        maps_dir.mkdir(parents=True, exist_ok=True)
        wpath = worlds_dir / self.world_filename
        wpath.write_text(self.wbt_text, encoding="utf-8")
        meta_path = maps_dir / f"{self.scenario}.json"
        import json

        meta_path.write_text(
            json.dumps(self.artifacts.metadata, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        for name, payload in self.artifacts.extras.items():
            (maps_dir / name).write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return wpath


class BaseScenario(ABC):
    name: str

    @abstractmethod
    def generate(self, seed: int) -> WorldContext:
        raise NotImplementedError

    def default_config(self) -> Dict[str, Any]:
        return {"scenario": self.name, "seed": 42}
