import rclpy
from rclpy.node import Node
from tashi_msgs.msg import AgentState
from geometry_msgs.msg import Point, Vector3
import random

class SimAdapterNode(Node):
    def __init__(self):
        super().__init__('sim_adapter_node')
        self.publisher_ = self.create_publisher(AgentState, 'agent_state', 10)
        self.timer = self.create_timer(0.1, self.publish_sim_state)
        self.agent_id = "sim_drone_0"
        self.pos_x = 0.0
        self.pos_y = 0.0
        self.battery = 100.0
        self.get_logger().info('Sim Adapter Node started')

    def publish_sim_state(self):
        msg = AgentState()
        msg.agent_id = self.agent_id
        msg.role = "EXPLORER"
        
        # Simple random walk
        self.pos_x += random.uniform(-0.5, 0.5)
        self.pos_y += random.uniform(-0.5, 0.5)
        self.battery -= 0.01
        
        msg.position = Point(x=self.pos_x, y=self.pos_y, z=10.0)
        msg.velocity = Vector3(x=0.0, y=0.0, z=0.0)
        msg.battery_level = self.battery
        msg.alive = True
        msg.status = "OK"
        msg.last_heartbeat = self.get_clock().now().to_msg()
        
        self.publisher_.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = SimAdapterNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
