import rclpy
from rclpy.node import Node
from tashi_msgs.msg import AgentState, EmergencyCommand
from geometry_msgs.msg import Point

class SafetyNode(Node):
    def __init__(self):
        super().__init__('safety_node')
        self.agent_sub = self.create_subscription(AgentState, 'agent_state', self.agent_callback, 10)
        self.emergency_pub = self.create_publisher(EmergencyCommand, 'emergency_command', 10)
        
        self.battery_threshold = 15.0 # percent
        self.geofence_limit = 500.0 # meters from origin
        
        self.get_logger().info('Safety Node started')

    def agent_callback(self, msg):
        # Check battery
        if msg.battery_level < self.battery_threshold:
            self.issue_emergency(msg.agent_id, "LOW_BATTERY", f"Battery at {msg.battery_level}%")
            
        # Check geofence
        dist = (msg.position.x**2 + msg.position.y**2 + msg.position.z**2)**0.5
        if dist > self.geofence_limit:
            self.issue_emergency(msg.agent_id, "GEOFENCE_VIOLATION", f"Distance {dist:.2f}m exceeds limit")

    def issue_emergency(self, agent_id, cmd_type, reason):
        msg = EmergencyCommand()
        msg.command_type = cmd_type
        msg.reason = f"Agent {agent_id}: {reason}"
        msg.immediate = True
        msg.issued_at = self.get_clock().now().to_msg()
        self.emergency_pub.publish(msg)
        self.get_logger().error(f"SAFETY ALERT: {msg.reason}")

def main(args=None):
    rclpy.init(args=args)
    node = SafetyNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
