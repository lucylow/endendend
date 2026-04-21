"""Background WebSocket broadcaster (60Hz) sharing a MockDataEngine with Webots or CLI."""

from __future__ import annotations

import asyncio
import json
import threading
from typing import Any, Dict, Optional, Set

from mockdata.engine import MockDataEngine


class SimControl:
    def __init__(self) -> None:
        self.playing = True
        self.speed = 1

    def apply_message(self, raw: str) -> None:
        try:
            j: Dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            return
        if j.get("type") != "sim_control":
            return
        if "playing" in j:
            self.playing = bool(j["playing"])
        sp = j.get("speed")
        if sp in (1, 2, 4):
            self.speed = int(sp)


class WsFallenComradeHub:
    """Owns engine + sim control; safe to call step() from Webots main thread while WS runs."""

    def __init__(self, engine: Optional[MockDataEngine] = None) -> None:
        self.engine = engine or MockDataEngine()
        self.ctrl = SimControl()
        self._lock = threading.RLock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._external_step = True

    def _step_inner(self, dt: float) -> None:
        if self.ctrl.playing:
            self.engine.step(dt * self.ctrl.speed)

    def step(self, dt: float) -> None:
        with self._lock:
            self._step_inner(dt)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return self.engine.to_frame()

    def start_ws(self, host: str = "127.0.0.1", port: int = 8765, *, external_step: bool = True) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._external_step = external_step
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
                        if not self._external_step:
                            self._step_inner(dt)
                    payload = json.dumps(self.snapshot())
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

        self._thread = threading.Thread(target=_thread_main, name="fallen-mock-ws", daemon=True)
        self._thread.start()

    def stop_ws(self) -> None:
        self._stop.set()


def run_standalone(host: str = "127.0.0.1", port: int = 8765) -> None:
    hub = WsFallenComradeHub()
    hub.start_ws(host, port, external_step=False)
    print(f"Fallen Comrade mock WS on ws://{host}:{port} (60Hz, internal step)")
    if hub._thread:
        hub._thread.join()
