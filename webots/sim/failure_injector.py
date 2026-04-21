"""Deterministic failure schedules for demos (supervisor-driven, not physics hacks)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class FailureKind(str, Enum):
    ROVER_KILL = "rover_kill"
    HEARTBEAT_DROP = "heartbeat_drop"
    BATTERY_WARN = "battery_warn"
    PACKET_LOSS_SPIKE = "packet_loss_spike"
    RELAY_REASSIGN = "relay_reassign"
    GENERIC = "generic"


@dataclass(frozen=True)
class FailureEvent:
    kind: FailureKind
    target: str
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScheduledFailure:
    sim_time: float
    event: FailureEvent
    fired: bool = False


class FailureInjector:
    def __init__(self) -> None:
        self._schedule: List[ScheduledFailure] = []
        self._active: List[FailureEvent] = []
        self._hooks: Dict[FailureKind, List[Callable[[FailureEvent], None]]] = {}

    def schedule(self, sim_time: float, event: FailureEvent) -> None:
        self._schedule.append(ScheduledFailure(sim_time=sim_time, event=event))
        self._schedule.sort(key=lambda s: s.sim_time)

    def register(self, kind: FailureKind, fn: Callable[[FailureEvent], None]) -> None:
        self._hooks.setdefault(kind, []).append(fn)

    def step(self, sim_time: float) -> List[FailureEvent]:
        fired: List[FailureEvent] = []
        for item in self._schedule:
            if item.fired:
                continue
            if sim_time + 1e-6 >= item.sim_time:
                item.fired = True
                self._active.append(item.event)
                fired.append(item.event)
                for fn in self._hooks.get(item.event.kind, []):
                    fn(item.event)
        return fired

    def list_active(self) -> List[FailureEvent]:
        return list(self._active)

    def clear(self) -> None:
        self._schedule.clear()
        self._active.clear()
