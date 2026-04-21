"""Serve MockDataEngine on ws://127.0.0.1:8765 (install requirements-mockdata.txt)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from mockdata.ws_runner import run_standalone  # noqa: E402


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run_standalone("127.0.0.1", port)


if __name__ == "__main__":
    main()
