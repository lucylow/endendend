"""Export benchmark history to CSV for judges / spreadsheets."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, Iterable, List


def export_metrics_csv(rows: Iterable[Dict[str, Any]], path: Path) -> None:
    rows = list(rows)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    keys: List[str] = sorted({k for r in rows for k in r.keys()})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            flat = {k: r.get(k, "") for k in keys}
            w.writerow(flat)
