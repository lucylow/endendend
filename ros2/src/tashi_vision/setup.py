import os
from glob import glob

from setuptools import setup

package_name = "tashi_vision"

setup(
    name=package_name,
    version="0.0.1",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        (os.path.join("share", package_name, "launch"), glob("launch/*.launch.py")),
    ],
    install_requires=["setuptools", "numpy", "onnxruntime", "opencv-python-headless"],
    zip_safe=True,
    maintainer="Lucy Low",
    maintainer_email="lucy@example.com",
    description="YOLOv8 ONNX vision pipeline for Tashi Swarm",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "vision_node = tashi_vision.vision_node:main",
            "yolov8_swarm_vision = tashi_vision.yolov8_swarm_vision_node:main",
        ],
    },
)
