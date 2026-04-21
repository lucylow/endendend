#!/usr/bin/env python3
"""Assemble Mermaid sources into a single reviewable bundle (optional PNG via mmdc)."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    out = root / "ARCH_bundle.md"
    parts: list[str] = ["# Auto-generated architecture bundle\n"]
    for name in ("state-machine.mmd", "roles.mmd"):
        p = root / name
        if not p.is_file():
            continue
        parts.append(f"## `{name}`\n")
        parts.append("```mermaid\n")
        parts.append(p.read_text(encoding="utf-8").strip() + "\n")
        parts.append("```\n\n")
    out.write_text("".join(parts), encoding="utf-8")
    print(f"wrote {out.relative_to(root.parent.resolve())}")

    mmdc = shutil.which("mmdc")
    if mmdc is None:
        print("mmdc not on PATH — install @mermaid-js/mermaid-cli to render PNGs", file=sys.stderr)
        return 0
    png_dir = root / "png"
    png_dir.mkdir(exist_ok=True)
    for mmd in root.glob("*.mmd"):
        dest = png_dir / (mmd.stem + ".png")
        subprocess.run([mmdc, "-i", str(mmd), "-o", str(dest)], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
