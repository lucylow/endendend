import rclpy
from rclpy.node import Node
from tashi_msgs.msg import AgentState, ConsensusVote
from std_msgs.msg import String
import random

class SwarmCoordinatorNode(Node):
    def __init__(self):
        super().__init__('swarm_coordinator_node')
        self.agent_sub = self.create_subscription(AgentState, 'agent_state', self.agent_callback, 10)
        self.vote_pub = self.create_publisher(ConsensusVote, 'consensus_votes', 10)
        self.vote_sub = self.create_subscription(ConsensusVote, 'consensus_votes', self.vote_callback, 10)
        
        self.agents = {}
        self.votes = {}
        self.node_id = f"coord_{random.randint(100, 999)}"
        
        self.timer = self.create_timer(5.0, self.propose_consensus)
        self.get_logger().info(f'Swarm Coordinator Node {self.node_id} started')

    def agent_callback(self, msg):
        self.agents[msg.agent_id] = msg

    def propose_consensus(self):
        if not self.agents:
            return
            
        msg = ConsensusVote()
        msg.proposal_id = f"prop_{self.get_clock().now().nanoseconds}"
        msg.voter_id = self.node_id
        msg.stake = 1.0
        msg.weight = 1.0
        msg.choice = "CONTINUE_MISSION"
        msg.confidence = 0.95
        self.vote_pub.publish(msg)
        self.get_logger().info(f"Proposed consensus: {msg.choice}")

    def vote_callback(self, msg):
        if msg.proposal_id not in self.votes:
            self.votes[msg.proposal_id] = []
        self.votes[msg.proposal_id].append(msg)
        self.get_logger().info(f"Received vote for {msg.proposal_id} from {msg.voter_id}")

def main(args=None):
    rclpy.init(args=args)
    node = SwarmCoordinatorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
