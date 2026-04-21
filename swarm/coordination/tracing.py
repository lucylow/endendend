"""
Structured decision logging for explainable coordination (golden trace lines).

```mermaid
flowchart LR
  FSM[BlackoutStateMachine] -->|decision_dict| T[Tests / CI]
  FSM -->|log_decision| L[Operator logs]
```
"""

from __future__ import annotations

import json
import logging
from typing import Any, Mapping

logger = logging.getLogger(__name__)


def log_decision(ctx: str, why: str, before: Any, after: Any) -> None:
    """# WHY: Judges and operators need a single grep-friendly audit line per transition."""
    payload = {
        "ctx": ctx,
        "why": why,
        "before": before,
        "after": after,
    }
    logger.info("DECISION %s", json.dumps(payload, default=str, sort_keys=True))


def decision_dict(ctx: str, why: str, before: Any, after: Any) -> Mapping[str, Any]:
    """# WHY: Tests assert on structured decisions without relying on log capture."""
    return {"ctx": ctx, "why": why, "before": before, "after": after}
