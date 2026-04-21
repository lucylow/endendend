from setuptools import find_packages, setup

package_name = 'endendend_vision'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/vision_launch.py', 'launch/vision_stack_launch.py']),
        ('share/' + package_name + '/models', ['models/.gitkeep']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Vision pipeline ROS 2 node (stub detections + ONNX hook).',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'vision_node = endendend_vision.vision_node:main',
            'webots_camera = endendend_vision.webots_camera:main',
            'yolov8_onnx_detector = endendend_vision.yolov8_onnx_detector:main',
            'victim_vertex_fanout = endendend_vision.victim_vertex_fanout:main',
        ],
    },
)
