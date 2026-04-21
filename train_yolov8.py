#!/usr/bin/env python3
"""Train YOLOv8 nano on ``dataset/data.yaml`` and export ONNX (requires ``ultralytics``)."""

from __future__ import annotations

from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    data = Path("dataset/data.yaml")
    if not data.is_file():
        raise SystemExit("Missing dataset/data.yaml — run python dataset/gen_dataset.py first")
    model = YOLO("yolov8n.pt")
    model.train(
        data=str(data),
        epochs=100,
        imgsz=640,
        batch=16,
        device="cpu",
        name="victim_yolov8",
        exist_ok=True,
    )
    best = Path("runs/detect/victim_yolov8/weights/best.pt")
    if not best.is_file():
        raise SystemExit("Training did not produce runs/detect/victim_yolov8/weights/best.pt")
    export_m = YOLO(str(best))
    out_path = export_m.export(format="onnx", simplify=True, opset=12)
    onnx_src = Path(out_path)
    if not onnx_src.is_file():
        onnx_src = best.with_suffix(".onnx")
    if not onnx_src.is_file():
        raise SystemExit("ONNX export failed — check ultralytics logs")
    out_dir = Path("models/victim_yolov8")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "best.onnx"
    target.write_bytes(onnx_src.read_bytes())
    print("Exported", target.resolve())


if __name__ == "__main__":
    main()
