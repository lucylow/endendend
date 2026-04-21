"""60 Hz WebSocket hub for Dynamic Daisy Chain Webots emitter (Track 2 dashboard)."""

from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple

from mockdata.ws_runner import SimControl


class WsDynamicDaisyWebotsHub:
    """Thread-safe snapshot + sim control; ``step()`` runs on Webots main thread."""

    def __init__(self, engine: Any, repo_root: Path) -> None:
        self.engine = engine
        self.repo_root = repo_root
        self.ctrl = SimControl()
        self._lock = threading.RLock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._last: Dict[str, Any] = {
            "time": 0.0,
            "tunnel_depth": 0.0,
            "relay_chain": [],
            "signal_quality": {},
            "global_map": [],
            "rovers": [],
            "rescues_completed": 0,
        }

    def step(self, dt: float, positions: Dict[str, Tuple[float, float, float]]) -> None:
        with self._lock:
            if self.ctrl.playing:
                payload, motion = self.engine.tick(dt * self.ctrl.speed, positions)
                self.engine.write_targets_file(self.repo_root, motion)
                self._last = payload

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._last)

    def start_ws(self, host: str = "127.0.0.1", port: int = 8765, *, external_step: bool = True) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()

        async def _run() -> None:
            try:
                import websockets
            except ImportError as e:  # pragma: no cover
                raise RuntimeError("pip install -r requirements-mockdata.txt") from e

            clients: Set[Any] = set()

            async def handler(ws: Any) -> None:
                clients.add(ws)
                try:
                    async for message in ws:
                        raw = message.decode() if isinstance(message, (bytes, bytearray)) else str(message)
                        with self._lock:
                            self.ctrl.apply_message(raw)
                finally:
                    clients.discard(ws)

            async def tick() -> None:
                dt = 1.0 / 60.0
                while not self._stop.is_set():
                    await asyncio.sleep(dt)
                    with self._lock:
                        payload = json.dumps(self._last)
                    dead = []
                    for c in list(clients):
                        try:
                            await c.send(payload)
                        except Exception:
                            dead.append(c)
                    for c in dead:
                        clients.discard(c)

            async with websockets.serve(handler, host, port, ping_interval=20, ping_timeout=20):
                await tick()

        def _thread_main() -> None:
            asyncio.run(_run())

        self._thread = threading.Thread(target=_thread_main, name="dynamic-daisy-ws", daemon=True)
        self._thread.start()

    def stop_ws(self) -> None:
        self._stop.set()
