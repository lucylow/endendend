"""Optional MessagePack wire encoding for Vertex / NetworkEmulator (JSON fallback)."""

from __future__ import annotations

from typing import Any, Dict, Union

WireMessage = Union[Dict[str, Any], bytes]

try:
    import msgpack  # type: ignore[import-untyped]

    _HAS_MSGPACK = True
except ImportError:
    msgpack = None  # type: ignore[assignment]
    _HAS_MSGPACK = False


def msgpack_available() -> bool:
    return _HAS_MSGPACK


def pack_wire(payload: Dict[str, Any], *, use_msgpack: bool) -> WireMessage:
    if not use_msgpack or not _HAS_MSGPACK or msgpack is None:
        return payload
    try:
        return msgpack.packb(payload, use_bin_type=True)
    except (TypeError, ValueError):
        return payload


def unpack_wire(data: WireMessage) -> Dict[str, Any]:
    if isinstance(data, dict):
        return dict(data)
    if isinstance(data, (bytes, bytearray)):
        if _HAS_MSGPACK and msgpack is not None:
            try:
                out = msgpack.unpackb(bytes(data), raw=False)
                if isinstance(out, dict):
                    return dict(out)
            except Exception:
                pass
        import json

        try:
            parsed = json.loads(bytes(data).decode("utf-8"))
            return dict(parsed) if isinstance(parsed, dict) else {}
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return {}
    return {}
