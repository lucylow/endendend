#!/usr/bin/env python3
"""
Webots supervisor: randomize tunnel victims + camera, save RGB + YOLO labels (class 0 = victim).

Set frame count: export VICTIM_DATASET_N=4000 (default 200 for quick smoke).
Output: <repo>/dataset/webots_synth/images/train and labels/train
"""

from __future__ import annotations

import math
import os
import struct
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_OUT_IMG = _REPO_ROOT / "dataset" / "webots_synth" / "images" / "train"
_OUT_LBL = _REPO_ROOT / "dataset" / "webots_synth" / "labels" / "train"

_VICTIM_DEFS = ("VICTIM_0", "VICTIM_1", "VICTIM_2")
_DEBRIS = ("DEBRIS_A", "DEBRIS_B")


def _repo_root() -> Path:
    return _REPO_ROOT


def _ensure_out() -> None:
    _OUT_IMG.mkdir(parents=True, exist_ok=True)
    _OUT_LBL.mkdir(parents=True, exist_ok=True)


def _bgra_to_bgr(raw: bytes, w: int, h: int) -> bytes:
    arr = memoryview(raw)
    out = bytearray(w * h * 3)
    o = 0
    for i in range(0, len(arr), 4):
        b, g, r = arr[i], arr[i + 1], arr[i + 2]
        out[o] = b
        out[o + 1] = g
        out[o + 2] = r
        o += 3
    return bytes(out)


def _write_jpeg_bgr(path: Path, w: int, h: int, bgr: bytes) -> None:
    try:
        import cv2  # type: ignore[import-not-found]

        import numpy as np

        img = np.frombuffer(bgr, dtype=np.uint8).reshape((h, w, 3))
        cv2.imwrite(str(path), img)
    except Exception:
        # Minimal BMP fallback (no OpenCV in Webots Python on some installs)
        row_padded = (w * 3 + 3) // 4 * 4
        header = struct.pack("<2sIHHI6I", b"BM", 14 + 40 + row_padded * h, 0, 0, 54, 40, w, h, 1, 24, 0, 0, 0, 0, 0, 0)
        flipped = bytearray()
        for y in range(h - 1, -1, -1):
            row = bgr[y * w * 3 : (y + 1) * w * 3]
            flipped.extend(row.ljust(row_padded, b"\0"))
        path.write_bytes(header + bytes(flipped))


def _project_victim_bbox(
    cam_pos: tuple[float, float, float],
    cam_yaw: float,
    victim_pos: tuple[float, float, float],
    img_w: int,
    img_h: int,
    fov_y: float,
    torso_h: float,
    torso_r: float,
) -> tuple[float, float, float, float] | None:
    """Pinhole-ish projection on ground plane tunnel; returns YOLO xywh normalized or None if behind."""
    cx, cy, cz = cam_pos
    vx, vy, vz = victim_pos
    # Camera looks along -Z in local frame; world yaw rotates local -Z to world direction
    fwd_x = -math.sin(cam_yaw)
    fwd_z = -math.cos(cam_yaw)
    dx = vx - cx
    dz = vz - cz
    dy = vy - cy
    depth = dx * fwd_x + dz * fwd_z
    if depth < 0.8:
        return None
    right_x = math.cos(cam_yaw)
    right_z = -math.sin(cam_yaw)
    lateral = dx * right_x + dz * right_z
    tan_half = math.tan(fov_y * 0.5)
    u = 0.5 + 0.5 * (lateral / (depth * tan_half + 1e-6)) * (img_w / max(img_h, 1))
    v = 0.5 - 0.5 * (dy / (depth * tan_half + 1e-6))
    half_w = (torso_r * 2.2) / (depth * tan_half + 0.4) * 0.5
    half_h = (torso_h * 1.1) / (depth * tan_half + 0.4) * 0.5
    u = min(0.999, max(0.001, u))
    v = min(0.999, max(0.001, v))
    bw = min(0.95, max(0.04, half_w * 2))
    bh = min(0.95, max(0.06, half_h * 2))
    u = min(u, 1.0 - bw / 2)
    v = min(v, 1.0 - bh / 2)
    u = max(u, bw / 2)
    v = max(v, bh / 2)
    return (u, v, bw, bh)


def main() -> None:
    try:
        from controller import Supervisor  # type: ignore[import-not-found]
    except ImportError as exc:
        raise SystemExit("Run this controller inside Webots: %s" % exc) from exc

    import random

    robot = Supervisor()
    timestep = int(robot.getBasicTimeStep())
    cam = robot.getDevice("sar_camera")
    cam.enable(timestep)

    n_frames = int(os.environ.get("VICTIM_DATASET_N", "200"))
    _ensure_out()
    rng = random.Random(int(os.environ.get("VICTIM_DATASET_SEED", "0")))

    try:
        fov = float(cam.getFov())
    except Exception:
        fov = 0.785

    for frame_id in range(n_frames):
        # Random victim poses (tunnel floor y ~ 0.15–0.45)
        for name in _VICTIM_DEFS:
            node = robot.getFromDef(name)
            if node is None:
                continue
            tr = node.getField("translation")
            rot = node.getField("rotation")
            x = rng.uniform(-4.5, 4.5)
            z = rng.uniform(2.5, 11.5)
            y = 0.14 + rng.random() * 0.28
            tr.setSFVec3f([x, y, z])
            yaw = rng.uniform(-0.9, 0.9)
            rot.setSFRotation([0, 1, 0, yaw])

        # Occlusion: shift debris in front of a victim sometimes
        if rng.random() < 0.35:
            db = robot.getFromDef(rng.choice(_DEBRIS))
            if db is not None:
                db.getField("translation").setSFVec3f(
                    [rng.uniform(-2.5, 2.5), 0.12 + rng.random() * 0.15, 6.0 + rng.random() * 3.0]
                )

        # Camera rig jitter (yaw only; keep near tunnel axis)
        rig = robot.getSelf()
        rig_tr = rig.getField("translation")
        base_z = 11.5 + rng.uniform(-1.2, 1.2)
        rig_tr.setSFVec3f([rng.uniform(-0.8, 0.8), 1.1 + rng.uniform(-0.25, 0.45), base_z])
        yaw_cam = math.pi + rng.uniform(-0.45, 0.45)
        rig.getField("rotation").setSFRotation([0, 1, 0, yaw_cam])

        robot.step(timestep)

        w, h = cam.getWidth(), cam.getHeight()
        raw = cam.getImage()
        if raw is None:
            continue
        bgr = _bgra_to_bgr(raw, w, h)
        stem = "%06d" % frame_id
        _write_jpeg_bgr(_OUT_IMG / (stem + ".jpg"), w, h, bgr)

        lines: list[str] = []
        cam_pos = tuple(float(v) for v in rig.getPosition())
        for name in _VICTIM_DEFS:
            vnode = robot.getFromDef(name)
            if vnode is None:
                continue
            vpos = tuple(float(v) for v in vnode.getPosition())
            torso_h = 1.05 if name != "VICTIM_2" else 0.82
            torso_r = 0.2 if name != "VICTIM_2" else 0.16
            box = _project_victim_bbox(cam_pos, yaw_cam, vpos, w, h, fov, torso_h, torso_r)
            if box is not None:
                u, v, bw, bh = box
                lines.append("0 %.6f %.6f %.6f %.6f" % (u, v, bw, bh))

        (_OUT_LBL / (stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

        if frame_id % 200 == 0:
            print("victim_dataset_gen: wrote frame", frame_id, "->", _OUT_IMG.resolve())

    print("Done:", n_frames, "frames ->", _OUT_IMG.resolve())


if __name__ == "__main__":
    main()
