"""Optional HTTP sink: Webots / headless swarm → Lovable-style edge (Supabase Functions, etc.).

Enable with ``LOVABLE_EDGE_BASE_URL`` (no trailing slash required), for example::

    export LOVABLE_EDGE_BASE_URL="https://<ref>.supabase.co/functions/v1"
    export LOVABLE_SWARM_ID="track2-demo"
    export LOVABLE_EDGE_TOKEN=""   # optional Bearer for locked-down functions

Posts JSON to ``vertex-edge-sync`` and ``swarm-telemetry`` on configurable intervals.
Uses stdlib only so Webots controllers do not need aiohttp.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _post_json(url: str, body: Dict[str, Any], *, bearer: str, timeout_s: float) -> tuple[int, str]:
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:  # noqa: S310 — URL from deployer env
            text = resp.read().decode("utf-8", errors="replace")
            return int(resp.status), text
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return int(e.code), raw
    except urllib.error.URLError as e:
        return -1, str(e.reason if hasattr(e, "reason") else e)


class LovableCloudSink:
    """Background poster; safe to ignore failures (mesh remains authoritative)."""

    def __init__(
        self,
        *,
        base_url: str,
        swarm_id: str,
        vertex_payload_fn: Callable[[], Dict[str, Any]],
        telemetry_row_fn: Callable[[], Dict[str, Any]],
        bearer_token: str = "",
        vertex_interval_s: float = 1.0,
        telemetry_interval_s: float = 0.25,
        request_timeout_s: float = 5.0,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._vertex_url = f"{self._base}/vertex-edge-sync"
        self._telem_url = f"{self._base}/swarm-telemetry"
        self._vertex_payload_fn = vertex_payload_fn
        self._telemetry_row_fn = telemetry_row_fn
        self._bearer = bearer_token
        self._vertex_interval = max(0.25, float(vertex_interval_s))
        self._telemetry_interval = max(0.05, float(telemetry_interval_s))
        self._timeout = max(0.5, float(request_timeout_s))
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="lovable-cloud-sink", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=2.0)

    def _run(self) -> None:
        time.sleep(0.35)
        next_vertex = 0.0
        next_telem = 0.0
        while not self._stop.is_set():
            now = time.monotonic()
            if now >= next_vertex:
                next_vertex = now + self._vertex_interval
                body = self._vertex_payload_fn()
                code, text = _post_json(self._vertex_url, body, bearer=self._bearer, timeout_s=self._timeout)
                if code == 200:
                    logger.debug("vertex-edge-sync ok drone=%s", body.get("drone_id"))
                elif code >= 0:
                    logger.warning("vertex-edge-sync HTTP %s: %s", code, text[:500])
                else:
                    logger.warning("vertex-edge-sync transport: %s", text[:500])
            now = time.monotonic()
            if now >= next_telem:
                next_telem = now + self._telemetry_interval
                row = self._telemetry_row_fn()
                code, text = _post_json(self._telem_url, row, bearer=self._bearer, timeout_s=self._timeout)
                if code not in (200, 201, 204) and code >= 0:
                    logger.warning("swarm-telemetry HTTP %s: %s", code, text[:300])
                elif code < 0:
                    logger.warning("swarm-telemetry transport: %s", text[:300])
            self._stop.wait(timeout=0.02)


def maybe_start_lovable_cloud_sink(
    ctrl: Any,
    *,
    swarm_id: Optional[str] = None,
) -> Optional[LovableCloudSink]:
    """If ``LOVABLE_EDGE_BASE_URL`` is set, start a sink bound to ``ctrl`` (``DroneController``)."""
    base = os.environ.get("LOVABLE_EDGE_BASE_URL", "").strip()
    if not base:
        return None
    sid = (swarm_id or os.environ.get("LOVABLE_SWARM_ID", "track2")).strip() or "track2"
    token = os.environ.get("LOVABLE_EDGE_TOKEN", "").strip()
    v_int = _env_float("LOVABLE_VERTEX_SYNC_INTERVAL_S", 1.0)
    t_int = _env_float("LOVABLE_TELEMETRY_INTERVAL_S", 0.25)
    sink = LovableCloudSink(
        base_url=base,
        swarm_id=sid,
        vertex_payload_fn=lambda: ctrl.get_lovable_cloud_vertex_payload(sid),
        telemetry_row_fn=lambda: ctrl.get_lovable_cloud_telemetry_row(sid),
        bearer_token=token,
        vertex_interval_s=v_int,
        telemetry_interval_s=t_int,
    )
    sink.start()
    logger.info("Lovable edge sink started base=%s swarm=%s", base, sid)
    return sink
