"""Insert repository root on ``sys.path`` so ``import vision.*`` works from the colcon overlay."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional


def ensure_repo_root_on_path() -> Optional[Path]:
    here = Path(__file__).resolve()
    for p in [here.parent, *here.parents]:
        if (p / 'vision' / 'yolo_onnx.py').is_file():
            root = str(p)
            if root not in sys.path:
                sys.path.insert(0, root)
            return p
    return None
