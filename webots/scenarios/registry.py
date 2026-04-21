"""Scenario registry and WorldContext factory."""

from __future__ import annotations

from typing import Dict, Type

from webots.scenarios.base import BaseScenario, WorldContext
from webots.scenarios.blind_handoff import BlindHandoffScenario
from webots.scenarios.fallen_comrade import FallenComradeScenario
from webots.scenarios.open_track import OpenTrackScenario
from webots.scenarios.tunnel_blackout import TunnelBlackoutScenario

SCENARIOS: Dict[str, Type[BaseScenario]] = {
    FallenComradeScenario.name: FallenComradeScenario,
    BlindHandoffScenario.name: BlindHandoffScenario,
    TunnelBlackoutScenario.name: TunnelBlackoutScenario,
    OpenTrackScenario.name: OpenTrackScenario,
}


def build_context(scenario: str, seed: int) -> WorldContext:
    key = scenario.lower().replace("-", "_")
    cls = SCENARIOS.get(key)
    if not cls:
        raise KeyError(f"Unknown scenario {scenario!r}; known: {sorted(SCENARIOS)}")
    return cls().generate(seed)
