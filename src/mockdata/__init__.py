"""Production-grade procedural mock data for Track 2 (Fallen Comrade + Blind Handoff)."""

from mockdata.config import FallenComradeConfig
from mockdata.engine import MockDataEngine
from mockdata.event_bus import EventBus
from mockdata.handoff_engine import BlindHandoffEngine
from mockdata.protocol_log import ProtocolLogger
from mockdata.ws_runner import WsFallenComradeHub

FallenComradeEngine = MockDataEngine

__all__ = [
    "BlindHandoffEngine",
    "EventBus",
    "FallenComradeConfig",
    "FallenComradeEngine",
    "MockDataEngine",
    "ProtocolLogger",
    "WsFallenComradeHub",
]
