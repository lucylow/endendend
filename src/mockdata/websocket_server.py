"""
WebSocket telemetry for the Fallen Comrade mock layer.

The asyncio + threading hub lives in `ws_runner.WsFallenComradeHub`; this module
re-exports it under the name used in architecture docs.
"""

from __future__ import annotations

from mockdata.ws_runner import WsFallenComradeHub

MockDataWebSocketServer = WsFallenComradeHub

__all__ = ["MockDataWebSocketServer", "WsFallenComradeHub"]
