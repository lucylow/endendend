#!/usr/bin/env python3
"""Optional process: tail ``live_snapshot.json`` and broadcast on ws:// (dev helper)."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path


async def _main(snapshot: Path, host: str, port: int) -> None:
    try:
        import websockets
    except ImportError as e:  # pragma: no cover
        raise SystemExit("pip install websockets") from e

    clients: set = set()

    async def handler(ws):
        clients.add(ws)
        try:
            async for _ in ws:
                pass
        finally:
            clients.discard(ws)

    async def push_loop():
        last = ""
        while True:
            await asyncio.sleep(1.0 / 20.0)
            try:
                txt = snapshot.read_text(encoding="utf-8")
            except OSError:
                continue
            if txt == last or not clients:
                continue
            last = txt
            for c in list(clients):
                try:
                    await c.send(txt)
                except Exception:
                    clients.discard(c)

    async with websockets.serve(handler, host, port):
        await push_loop()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", type=Path, default=Path("webots/maps/live_snapshot.json"))
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8766)
    args = ap.parse_args()
    asyncio.run(_main(args.snapshot, args.host, args.port))
