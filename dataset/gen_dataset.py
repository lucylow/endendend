#!/usr/bin/env python3
"""Synthetic YOLO victim tiles: default (simple) or ``sar_tunnel`` (blackout tunnel bias)."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import cv2
import numpy as np


def _draw_victim(img: np.ndarray, rng: random.Random) -> tuple[float, float, float, float]:
    h, w = img.shape[:2]
    vw = rng.randint(int(w * 0.08), int(w * 0.22))
    vh = rng.randint(int(h * 0.15), int(h * 0.35))
    cx = rng.randint(vw // 2, w - vw // 2)
    cy = rng.randint(vh // 2, h - vh // 2)
    shade = rng.randint(40, 120)
    cv2.ellipse(
        img,
        (cx, cy),
        (vw // 2, vh // 2),
        angle=rng.uniform(0, 180),
        startAngle=0,
        endAngle=360,
        color=(shade, rng.randint(20, 80), rng.randint(60, 140)),
        thickness=-1,
    )
    x1, y1, x2, y2 = cx - vw // 2, cy - vh // 2, cx + vw // 2, cy + vh // 2
    xc, yc, bw, bh = cx / w, cy / h, vw / w, vh / h
    return (xc, yc, bw, bh)


def _tunnel_gradient(h: int, w: int, rng: random.Random) -> np.ndarray:
    """Dark vertical tunnel: floor brighter, ceiling darker, side vignette."""
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    base = 18 + 55 * (1 - y) ** 1.4
    base += 12 * np.sin(x * math.pi) ** 2 * (1 - y)
    noise = rng.uniform(0.85, 1.08)
    g = (base * noise).clip(8, 95)
    img = np.stack([g, g * 0.98, g * 1.02], axis=-1).astype(np.uint8)
    # Side walls (darker vertical bands)
    for side in (0, 1):
        band = int(w * rng.uniform(0.08, 0.14))
        if side == 0:
            img[:, :band] = (img[:, :band] * rng.uniform(0.45, 0.7)).astype(np.uint8)
        else:
            img[:, w - band :] = (img[:, w - band :] * rng.uniform(0.45, 0.7)).astype(np.uint8)
    return img


def _rubble_specks(img: np.ndarray, rng: random.Random) -> None:
    h, w = img.shape[:2]
    n = rng.randint(40, 140)
    for _ in range(n):
        x, y = rng.randint(0, w - 1), rng.randint(0, h - 1)
        s = rng.randint(1, 4)
        shade = rng.randint(25, 90)
        cv2.rectangle(img, (x, y), (min(w - 1, x + s), min(h - 1, y + s)), (shade, shade - 5, shade - 8), -1)


def _draw_high_vis_victim(
    img: np.ndarray, rng: random.Random, depth_fac: float
) -> tuple[float, float, float, float]:
    """Orange/red SAR mannequin + skin head; ``depth_fac`` in ~[0.35,1] scales size (1m–20m feel)."""
    h, w = img.shape[:2]
    scale = 0.45 + 0.55 * depth_fac
    vw = int(np.clip(rng.uniform(0.09, 0.2) * w * scale, 24, w * 0.45))
    vh = int(np.clip(rng.uniform(0.18, 0.38) * h * scale, 40, h * 0.55))
    margin_x = vw // 2 + 8
    margin_y = vh // 2 + 8
    cx = rng.randint(margin_x, w - margin_x)
    cy = rng.randint(margin_y, h - margin_y)
    # Prone vs sitting: ellipse angle
    angle = rng.choice([0.0, rng.uniform(-35, 35), rng.uniform(70, 110)])
    orange = (
        rng.randint(160, 255),
        rng.randint(35, 110),
        rng.randint(8, 55),
    )
    cv2.ellipse(
        img,
        (cx, cy),
        (max(6, vw // 2), max(8, vh // 2)),
        angle,
        0,
        360,
        orange,
        thickness=-1,
    )
    # Head
    hr = max(5, int(min(vw, vh) * 0.22))
    head_cy = int(cy - vh * 0.32 * math.sin(math.radians(angle + 90)))
    head_cx = int(cx - vh * 0.12 * math.cos(math.radians(angle + 90)))
    skin = (rng.randint(160, 210), rng.randint(120, 175), rng.randint(100, 150))
    cv2.circle(img, (head_cx, head_cy), hr, skin, -1)

    x1 = max(0, cx - vw // 2 - hr)
    y1 = max(0, cy - vh // 2 - hr)
    x2 = min(w - 1, cx + vw // 2 + hr)
    y2 = min(h - 1, cy + vh // 2 + hr)
    return ((x1 + x2) * 0.5 / w, (y1 + y2) * 0.5 / h, (x2 - x1) / w, (y2 - y1) / h)


def _occlusion_debris(img: np.ndarray, rng: random.Random, xcn: float, ycn: float, wn: float, hn: float) -> None:
    """Partial cover over victim bbox (~30–70%)."""
    h, w = img.shape[:2]
    x1 = int((xcn - wn / 2) * w)
    y1 = int((ycn - hn / 2) * h)
    x2 = int((xcn + wn / 2) * w)
    y2 = int((ycn + hn / 2) * h)
    cover = rng.uniform(0.35, 0.75)
    px_w = max(8, int((x2 - x1) * cover))
    px_h = max(8, int((y2 - y1) * rng.uniform(0.35, 0.65)))
    ox = rng.randint(x1, max(x1, x2 - px_w))
    oy = rng.randint(y1, max(y1, y2 - px_h))
    rub = (rng.randint(35, 75), rng.randint(32, 72), rng.randint(30, 68))
    cv2.rectangle(img, (ox, oy), (ox + px_w, oy + px_h), rub, -1)
    if rng.random() < 0.4:
        cv2.GaussianBlur(img[y1:y2, x1:x2], (0, 0), rng.uniform(0.6, 1.4), dst=img[y1:y2, x1:x2])


def _draw_sar_tunnel_frame(img: np.ndarray, rng: random.Random) -> tuple[float, float, float, float]:
    h, w = img.shape[:2]
    base = _tunnel_gradient(h, w, rng)
    img[:] = base
    _rubble_specks(img, rng)
    # Simulated depth 1–20m → brightness + scale
    depth_fac = rng.uniform(0.32, 1.0)
    dim = rng.uniform(0.25, 0.82)
    xc, yc, bw, bh = _draw_high_vis_victim(img, rng, depth_fac)
    if rng.random() < 0.68:
        _occlusion_debris(img, rng, xc, yc, bw, bh)
    img[:] = (img.astype(np.float32) * dim * (0.55 + 0.45 * depth_fac)).clip(0, 255).astype(np.uint8)
    if rng.random() < 0.25:
        fog = np.zeros_like(img)
        fog[:] = (rng.randint(35, 55), rng.randint(38, 58), rng.randint(42, 62))
        t = rng.uniform(0.06, 0.18)
        img[:] = (img.astype(np.float32) * (1 - t) + fog.astype(np.float32) * t).astype(np.uint8)
    if rng.random() < 0.12:
        kernel = np.ones((3, 3), np.uint8)
        img[:] = cv2.dilate(img, kernel, iterations=1)  # type: ignore[assignment]
    return (xc, yc, bw, bh)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("dataset"))
    ap.add_argument("--preset", choices=("default", "sar_tunnel"), default="default")
    ap.add_argument("--train", type=int, default=800)
    ap.add_argument("--val", type=int, default=100)
    ap.add_argument("--test", type=int, default=100)
    ap.add_argument("--size", type=int, default=640)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    root: Path = args.out
    drawer = _draw_sar_tunnel_frame if args.preset == "sar_tunnel" else None

    for split, n in (("train", args.train), ("val", args.val), ("test", args.test)):
        idir = root / "images" / split
        ldir = root / "labels" / split
        idir.mkdir(parents=True, exist_ok=True)
        ldir.mkdir(parents=True, exist_ok=True)
        for i in range(n):
            img = np.zeros((args.size, args.size, 3), dtype=np.uint8)
            if drawer is not None:
                xc, yc, bw, bh = drawer(img, rng)
            else:
                g = rng.randint(15, 55)
                img[:] = (g, g, g)
                noise = rng.randint(0, 25)
                if noise:
                    jitter = np.random.randint(-noise, noise, img.shape, dtype=np.int16)
                    img = (img.astype(np.int16) + jitter).clip(0, 255).astype(np.uint8)
                xc, yc, bw, bh = _draw_victim(img, rng)
            name = "%s_%05d" % (split, i)
            cv2.imwrite(str(idir / (name + ".jpg")), img)
            (ldir / (name + ".txt")).write_text("0 %.6f %.6f %.6f %.6f\n" % (xc, yc, bw, bh), encoding="utf-8")
    print("Wrote", args.preset, "images under", root.resolve())


if __name__ == "__main__":
    main()
