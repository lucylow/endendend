import rclpy
from rclpy.node import Node
from tashi_msgs.msg import AgentState, MissionState
import json
import asyncio
import websockets
import threading

class TashiBridgeNode(Node):
    def __init__(self):
        super().__init__('tashi_bridge_node')
        self.agent_sub = self.create_subscription(AgentState, 'agent_state', self.agent_callback, 10)
        self.mission_sub = self.create_subscription(MissionState, 'mission_state', self.mission_callback, 10)
        
        self.latest_state = {
            "agents": {},
            "mission": {}
        }
        
        # Start WebSocket server in a separate thread
        self.loop = asyncio.new_event_loop()
        self.ws_thread = threading.Thread(target=self.start_ws_server, daemon=True)
        self.ws_thread.start()
        
        self.get_logger().info('Tashi Bridge Node started on ws://localhost:8765')

    def agent_callback(self, msg):
        self.latest_state["agents"][msg.agent_id] = {
            "position": {"x": msg.position.x, "y": msg.position.y, "z": msg.position.z},
            "battery": msg.battery_level,
            "status": msg.status
        }

    def mission_callback(self, msg):
        self.latest_state["mission"] = {
            "id": msg.mission_id,
            "phase": msg.phase,
            "progress": msg.progress
        }

    def start_ws_server(self):
        asyncio.set_event_loop(self.loop)
        start_server = websockets.serve(self.handler, "0.0.0.0", 8765)
        self.loop.run_until_complete(start_server)
        self.loop.run_forever()

    async def handler(self, websocket, path):
        while True:
            # Wrap in Lovable expected format
            envelope = {
                "type": "snapshot",
                "payload": {
                    "nodes": self.latest_state["agents"],
                    "missions": [self.latest_state["mission"]] if self.latest_state["mission"] else []
                }
            }
            await websocket.send(json.dumps(envelope))
            await asyncio.sleep(0.1)

def main(args=None):
    rclpy.init(args=args)
    node = TashiBridgeNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
