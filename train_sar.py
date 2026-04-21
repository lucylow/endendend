#!/usr/bin/env python3
"""Train YOLOv8n on hybrid SAR victim data; export ONNX for ROS2 / onnxruntime-web."""

from __future__ import annotations

from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    data = Path("dataset/data_sar_hybrid.yaml")
    if not data.is_file():
        raise SystemExit("Missing %s — run scripts/make_dataset.sh or split_dataset first" % data)
    model = YOLO("yolov8n.pt")
    model.train(
        data=str(data),
        epochs=150,
        imgsz=640,
        batch=16,
        patience=20,
        lr0=0.01,
        device="cpu",
        name="sar_victim",
        exist_ok=True,
        mosaic=1.0,
    )
    best = Path("runs/detect/sar_victim/weights/best.pt")
    if not best.is_file():
        raise SystemExit("Missing %s after training" % best)
    export_m = YOLO(str(best))
    out_path = export_m.export(format="onnx", simplify=True, opset=12)
    onnx_src = Path(out_path)
    if not onnx_src.is_file():
        onnx_src = best.with_suffix(".onnx")
    out_dir = Path("models/victim_yolov8")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "best.onnx"
    target.write_bytes(onnx_src.read_bytes())
    print("SAR ONNX ->", target.resolve())


if __name__ == "__main__":
    main()
