#!/usr/bin/env python3
"""Merge multiple (image_dir, label_dir) pools and split into train/val/test with fixed counts."""

from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path
from typing import List, Tuple


def _collect_pairs(img_dir: Path, lbl_dir: Path) -> List[Tuple[Path, Path]]:
    pairs: List[Tuple[Path, Path]] = []
    for p in sorted(img_dir.glob("*.jpg")) + sorted(img_dir.glob("*.png")):
        lp = lbl_dir / (p.stem + ".txt")
        if lp.is_file():
            pairs.append((p, lp))
    return pairs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pair",
        action="append",
        nargs=2,
        metavar=("IMAGES_DIR", "LABELS_DIR"),
        required=True,
        help="Repeatable: image folder + matching YOLO label folder",
    )
    ap.add_argument("--out", type=Path, default=Path("dataset/hybrid"))
    ap.add_argument("--train", type=int, default=4800)
    ap.add_argument("--val", type=int, default=700)
    ap.add_argument("--test", type=int, default=500)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()

    total = args.train + args.val + args.test
    all_pairs: List[Tuple[Path, Path]] = []
    for img_d, lbl_d in args.pair:
        all_pairs.extend(_collect_pairs(Path(img_d), Path(lbl_d)))

    n = len(all_pairs)
    if n == 0:
        raise SystemExit("No labeled image pairs found")
    train_n, val_n, test_n = args.train, args.val, args.test
    rng = random.Random(args.seed)
    rng.shuffle(all_pairs)
    if n > total:
        all_pairs = all_pairs[:total]
        n = total
    elif n < total:
        train_n = int(0.8 * n)
        val_n = int(0.1 * n)
        test_n = n - train_n - val_n
        print("Note: pool has %d pairs < %d — using split %d/%d/%d" % (n, total, train_n, val_n, test_n))

    chunks = (
        all_pairs[:train_n],
        all_pairs[train_n : train_n + val_n],
        all_pairs[train_n + val_n : train_n + val_n + test_n],
    )
    split_names = ("train", "val", "test")

    for name, chunk in zip(split_names, chunks):
        idir = args.out / "images" / name
        ldir = args.out / "labels" / name
        idir.mkdir(parents=True, exist_ok=True)
        ldir.mkdir(parents=True, exist_ok=True)
        for i, (im, lb) in enumerate(chunk):
            stem = "%s_%05d" % (name, i)
            shutil.copy2(im, idir / (stem + im.suffix))
            shutil.copy2(lb, ldir / (stem + ".txt"))

    print("Wrote hybrid split:", args.out.resolve(), "train/val/test =", train_n, val_n, test_n)


if __name__ == "__main__":
    main()
