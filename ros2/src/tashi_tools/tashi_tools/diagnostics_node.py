import rclpy
from rclpy.node import Node
from tashi_msgs.msg import AgentState, MissionState, TelemetrySample
import json

class DiagnosticsNode(Node):
    def __init__(self):
        super().__init__('diagnostics_node')
        self.agent_sub = self.create_subscription(AgentState, 'agent_state', self.agent_diag, 10)
        self.mission_sub = self.create_subscription(MissionState, 'mission_state', self.mission_diag, 10)
        self.telemetry_sub = self.create_subscription(TelemetrySample, 'iot/telemetry', self.telemetry_diag, 10)
        
        self.get_logger().info('Tashi Diagnostics Tool started')

    def agent_diag(self, msg):
        self.get_logger().info(f'[DIAG] Agent {msg.agent_id} | Pos: ({msg.position.x:.1f}, {msg.position.y:.1f}) | Batt: {msg.battery_level:.1f}% | Status: {msg.status}')

    def mission_diag(self, msg):
        self.get_logger().info(f'[DIAG] Mission {msg.mission_id} | Phase: {msg.phase} | Progress: {msg.progress:.1f}%')

    def telemetry_diag(self, msg):
        self.get_logger().info(f'[DIAG] Telemetry from {msg.source_id} | Batt: {msg.battery:.1f} | Signal: {msg.signal:.1f}')

def main(args=None):
    rclpy.init(args=args)
    node = DiagnosticsNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
