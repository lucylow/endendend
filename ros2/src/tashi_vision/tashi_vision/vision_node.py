import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from tashi_msgs.msg import TelemetrySample
import random

class VisionNode(Node):
    def __init__(self):
        super().__init__('vision_node')
        self.image_sub = self.create_subscription(Image, 'camera/image_raw', self.image_callback, 10)
        self.telemetry_pub = self.create_publisher(TelemetrySample, 'vision/detections', 10)
        self.get_logger().info('Vision Node started')

    def image_callback(self, msg):
        # Simulate victim detection
        if random.random() > 0.95:
            detection = TelemetrySample()
            detection.source_id = "vision_yolo"
            detection.stamped_at = self.get_clock().now().to_msg()
            # In a real app, we'd fill in detection details
            self.telemetry_pub.publish(detection)
            self.get_logger().info("VICTIM DETECTED by vision system")

def main(args=None):
    rclpy.init(args=args)
    node = VisionNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
