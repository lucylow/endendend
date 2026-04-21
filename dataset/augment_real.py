#!/usr/bin/env python3
"""
Augment a folder of real SAR-style images + YOLO labels (class 0 = victim).

Prefers Albumentations; falls back to OpenCV-only if albumentations is not installed.
Each source image yields ``--multiplier`` augmented copies (default 5) → scale 200 → 1k.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np


def _read_yolo_labels(path: Path) -> List[Tuple[int, float, float, float, float]]:
    if not path.is_file():
        return []
    rows: List[Tuple[int, float, float, float, float]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        rows.append((int(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])))
    return rows


def _write_yolo(path: Path, boxes: List[Tuple[int, float, float, float, float]]) -> None:
    lines = ["%d %.6f %.6f %.6f %.6f" % b for b in boxes]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def _yolo_to_pixel(
    boxes: List[Tuple[int, float, float, float, float]], w: int, h: int
) -> List[Tuple[int, float, float, float, float]]:
    """Convert normalized cxcywh to pixel xyxy for OpenCV."""
    out: List[Tuple[int, float, float, float, float]] = []
    for cls, xc, yc, bw, bh in boxes:
        cxp, cyp = xc * w, yc * h
        ww, hh = bw * w, bh * h
        x1, y1 = cxp - ww / 2, cyp - hh / 2
        x2, y2 = cxp + ww / 2, cyp + hh / 2
        out.append((cls, x1, y1, x2, y2))
    return out


def _pixel_to_yolo(
    boxes: List[Tuple[int, float, float, float, float]], w: int, h: int
) -> List[Tuple[int, float, float, float, float]]:
    out: List[Tuple[int, float, float, float, float]] = []
    for cls, x1, y1, x2, y2 in boxes:
        ww, hh = max(1.0, x2 - x1), max(1.0, y2 - y1)
        xc, yc = (x1 + x2) / 2 / w, (y1 + y2) / 2 / h
        out.append((cls, xc, yc, ww / w, hh / h))
    return out


def _augment_cv(img: np.ndarray, boxes_px: List[Tuple[int, float, float, float, float]], rng: random.Random) -> tuple[np.ndarray, list[tuple[int, float, float, float, float]]]:
    h, w = img.shape[:2]
    out = img.astype(np.float32)
    alpha = rng.uniform(0.55, 1.15)
    beta = rng.uniform(-35, 35)
    out = out * alpha + beta
    if rng.random() < 0.5:
        noise = rng.gauss(0, rng.uniform(2, 10))
        out += np.random.normal(0, noise, out.shape)
    if rng.random() < 0.45:
        k = rng.choice([3, 5])
        out = cv2.GaussianBlur(out.clip(0, 255).astype(np.uint8), (k, k), 0).astype(np.float32)
    if rng.random() < 0.35:
        overlay = np.zeros_like(out)
        overlay[:, :] = (40, 42, 48)
        t = rng.uniform(0.08, 0.22)
        out = out * (1 - t) + overlay * t
    out = out.clip(0, 255).astype(np.uint8)
    return out, boxes_px


def _augment_albu(
    img: np.ndarray, boxes_yolo: List[Tuple[int, float, float, float, float]], w: int, h: int, rng: random.Random
) -> tuple[np.ndarray, List[Tuple[int, float, float, float, float]]]:
    import albumentations as A  # type: ignore[import-not-found]

    bbs = [[b[1], b[2], b[3], b[4], "victim"] for b in boxes_yolo]
    transform = A.Compose(
        [
            A.RandomBrightnessContrast(brightness_limit=0.35, contrast_limit=0.35, p=0.9),
            A.GaussNoise(var_limit=(15.0, 70.0), p=0.55),
            A.RandomFog(fog_coef_range=(0.04, 0.22), alpha_coef=0.12, p=0.45),
            A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=25, val_shift_limit=15, p=0.35),
            A.Affine(scale=(0.88, 1.12), translate_percent=0.04, rotate=(-18, 18), p=0.55),
        ],
        bbox_params=A.BboxParams(format="yolo", label_fields=["class_labels"]),
        seed=rng.randint(0, 2**30),
    )
    class_labels = ["victim"] * len(bbs)
    res = transform(image=img, bboxes=bbs, class_labels=class_labels)
    img2 = res["image"]
    out_boxes: List[Tuple[int, float, float, float, float]] = []
    for bb in res["bboxes"]:
        out_boxes.append((0, float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])))
    return img2, out_boxes


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-images", type=Path, required=True, help="Folder of .jpg/.png (real imports)")
    ap.add_argument("--in-labels", type=Path, required=True, help="Parallel YOLO .txt labels (same stem)")
    ap.add_argument("--out", type=Path, default=Path("dataset/staging/aug"))
    ap.add_argument("--multiplier", type=int, default=5, help="Augmented variants per source image")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    img_out = args.out / "images"
    lbl_out = args.out / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    use_albu = True
    try:
        import albumentations  # noqa: F401, pylint: disable=unused-import
    except Exception:
        use_albu = False

    paths = sorted(list(args.in_images.glob("*.jpg")) + list(args.in_images.glob("*.png")))
    if not paths:
        raise SystemExit("No images in %s" % args.in_images)

    idx = 0
    for p in paths:
        stem = p.stem
        lbl_path = args.in_labels / (stem + ".txt")
        boxes = _read_yolo_labels(lbl_path)
        img = cv2.imread(str(p), cv2.IMREAD_COLOR)
        if img is None:
            continue
        h, w = img.shape[:2]
        for k in range(args.multiplier):
            boxes_y = list(boxes) if boxes else [(0, 0.5, 0.55, 0.12, 0.22)]
            if use_albu and boxes_y:
                try:
                    aug_img, aug_boxes = _augment_albu(img, boxes_y, w, h, rng)
                except Exception:
                    px = _yolo_to_pixel(boxes_y, w, h)
                    aug_img, px2 = _augment_cv(img, px, rng)
                    aug_boxes = _pixel_to_yolo(px2, aug_img.shape[1], aug_img.shape[0])
            else:
                px = _yolo_to_pixel(boxes_y, w, h)
                aug_img, px2 = _augment_cv(img, px, rng)
                aug_boxes = _pixel_to_yolo(px2, aug_img.shape[1], aug_img.shape[0])

            name = "aug_%06d" % idx
            idx += 1
            cv2.imwrite(str(img_out / (name + ".jpg")), aug_img)
            _write_yolo(lbl_out / (name + ".txt"), aug_boxes)

    print("Wrote", idx, "augmented pairs to", args.out.resolve(), "(albu=%s)" % use_albu)


if __name__ == "__main__":
    main()
