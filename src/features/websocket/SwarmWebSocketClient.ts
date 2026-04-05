import { BehaviorSubject } from "./miniRx";
import type { AgentTelemetry, EdgeLatencyUpdate, SwarmUpdate, WsConnectionState } from "@/types/websocket";
import { decodeWebotsStreamMessage } from "./WebotsStreamDecoder";

export class SwarmWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnects = 8;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  public readonly agentUpdates$ = new BehaviorSubject<AgentTelemetry[]>([]);
  public readonly swarmStatus$ = new BehaviorSubject<SwarmUpdate | null>(null);
  public readonly edgeLatency$ = new BehaviorSubject<EdgeLatencyUpdate | null>(null);
  public readonly connectionStatus$ = new BehaviorSubject<WsConnectionState>("disconnected");

  constructor(private readonly endpoint: string) {
    this.connect();
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  private connect() {
    if (this.manualClose) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectionStatus$.next("connecting");

    try {
      this.ws = new WebSocket(this.endpoint);

      this.ws.onopen = () => {
        this.connectionStatus$.next("connected");
        this.reconnectAttempts = 0;
        this.requestInitialState();
      };

      this.ws.onmessage = (event) => {
        try {
          const text = typeof event.data === "string" ? event.data : "";
          const update = decodeWebotsStreamMessage(text);
          if (update) this.handleUpdate(update);
        } catch {
          /* ignore malformed frames; decoder already guards JSON */
        }
      };

      this.ws.onclose = () => {
        this.connectionStatus$.next("disconnected");
        if (!this.manualClose) this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connectionStatus$.next("disconnected");
      };
    } catch {
      this.connectionStatus$.next("disconnected");
      this.scheduleReconnect();
    }
  }

  private handleUpdate(update: SwarmUpdate) {
    try {
      switch (update.type) {
        case "telemetry":
          this.agentUpdates$.next(update.agents);
          break;
        case "swarm_status":
          this.swarmStatus$.next(update);
          break;
        case "edge_latency":
          this.edgeLatency$.next(update);
          break;
        default:
          break;
      }
    } catch {
      /* subscriber or reducer threw; keep socket alive */
    }
  }

  private requestInitialState() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: "request_state" }));
    } catch {
      /* socket closed between check and send */
    }
  }

  private scheduleReconnect() {
    if (this.manualClose) return;
    if (this.reconnectAttempts >= this.maxReconnects) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** Math.min(this.reconnectAttempts - 1, 4), 30_000);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  sendCommand(command: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(command));
    } catch {
      /* malformed or non-serializable payload */
    }
  }

  reconnect() {
    this.manualClose = false;
    this.reconnectAttempts = 0;
    this.ws?.close();
    this.ws = null;
    this.connect();
  }

  close() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connectionStatus$.next("disconnected");
  }
}

const clients = new Map<string, SwarmWebSocketClient>();

export function getSwarmWebSocket(endpoint: string): SwarmWebSocketClient {
  let c = clients.get(endpoint);
  if (!c) {
    c = new SwarmWebSocketClient(endpoint);
    clients.set(endpoint, c);
  }
  return c;
}

export function disposeSwarmWebSocket(endpoint: string) {
  const c = clients.get(endpoint);
  if (c) {
    c.close();
    clients.delete(endpoint);
  }
}
