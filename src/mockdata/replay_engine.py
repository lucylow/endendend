"""Load recorded realloc protocol events (JSON lines / array)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


def load_protocol_events(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    return []
