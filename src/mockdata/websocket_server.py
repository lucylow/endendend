"""
Async WebSocket broadcaster for Blind Handoff snapshots.

Production deployments typically use `mockdata.ws_handoff_runner.WsHandoffHub`, which
embeds the same transport while matching the Track 2 `ws_runner` control messages.
This module documents the contract and offers a small procedural façade.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mockdata.ws_handoff_runner import WsHandoffHub


def create_handoff_ws_hub() -> "WsHandoffHub":
    from mockdata.ws_handoff_runner import WsHandoffHub

    return WsHandoffHub()
