# Training + ONNX export (ultralytics). Runtime detection uses onnxruntime in tashi_vision.
FROM ultralytics/ultralytics:latest

WORKDIR /workspace
COPY dataset/ /workspace/dataset/
COPY train_yolov8.py /workspace/train_yolov8.py

RUN pip install --no-cache-dir onnxruntime

CMD ["python", "train_yolov8.py"]
