"""Load scenario JSON / YAML from ``webots/config``."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple

_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CONFIG = _ROOT / "webots" / "config"


@dataclass
class ScenarioRecord:
    scenario: str
    world_file: str
    size: Tuple[float, float]
    seed: int
    agents: List[str]
    victims: List[str]
    zones: List[str]
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any]) -> "ScenarioRecord":
        size = data.get("size") or [100, 100]
        if len(size) != 2:
            raise ValueError("size must be [width, depth]")
        return cls(
            scenario=str(data["scenario"]),
            world_file=str(data.get("world_file", f"{data['scenario']}.wbt")),
            size=(float(size[0]), float(size[1])),
            seed=int(data.get("seed", 42)),
            agents=list(data.get("agents", [])),
            victims=list(data.get("victims", [])),
            zones=list(data.get("zones", [])),
            extra={k: v for k, v in data.items() if k not in cls._known_keys()},
        )

    @staticmethod
    def _known_keys() -> set:
        return {"scenario", "world_file", "size", "seed", "agents", "victims", "zones"}


class ScenarioLoader:
    def __init__(self, config_dir: Optional[Path] = None) -> None:
        self.config_dir = Path(config_dir or _DEFAULT_CONFIG)

    def load(self, scenario: str) -> ScenarioRecord:
        path = self.config_dir / f"{scenario}.json"
        if not path.is_file():
            raise FileNotFoundError(path)
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        return ScenarioRecord.from_mapping(data)

    def list_scenarios(self) -> List[str]:
        return sorted(p.stem for p in self.config_dir.glob("*.json"))
