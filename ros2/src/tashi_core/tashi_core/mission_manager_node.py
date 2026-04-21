import rclpy
from rclpy.node import Node
from tashi_msgs.msg import MissionState, EmergencyCommand
from std_msgs.msg import String
import json

class MissionManagerNode(Node):
    def __init__(self):
        super().__init__('mission_manager_node')
        self.publisher_ = self.create_publisher(MissionState, 'mission_state', 10)
        self.subscription = self.create_subscription(
            EmergencyCommand,
            'emergency_command',
            self.emergency_callback,
            10)
        self.timer = self.create_timer(1.0, self.publish_mission_state)
        self.mission_id = "mission_001"
        self.phase = "EXPLORATION"
        self.progress = 0.0
        self.get_logger().info('Mission Manager Node started')

    def publish_mission_state(self):
        msg = MissionState()
        msg.mission_id = self.mission_id
        msg.mission_name = "Search and Rescue Tunnel"
        msg.phase = self.phase
        msg.progress = self.progress
        msg.updated_at = self.get_clock().now().to_msg()
        self.publisher_.publish(msg)
        
        # Simulate progress
        if self.progress < 100.0:
            self.progress += 1.0

    def emergency_callback(self, msg):
        self.get_logger().warn(f'EMERGENCY RECEIVED: {msg.command_type} - Reason: {msg.reason}')
        if msg.command_type == "ABORT":
            self.phase = "ABORTED"
        elif msg.command_type == "ESTOP":
            self.phase = "EMERGENCY_STOP"

def main(args=None):
    rclpy.init(args=args)
    node = MissionManagerNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
