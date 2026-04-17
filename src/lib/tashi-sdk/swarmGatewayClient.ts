import type { SwarmBackendHealth, SwarmBackendSnapshot, SwarmCommandResponseBody } from "./swarmBackendTypes";

function trimSlash(base: string): string {
  return base.replace(/\/+$/, "");
}

/** Resolve ``/ws`` on the same origin as the HTTP base URL. */
export function swarmBackendWsUrl(httpBase: string): string {
  const ws = new URL("/ws", `${trimSlash(httpBase)}/`);
  ws.protocol = ws.protocol === "https:" ? "wss:" : "ws:";
  return ws.href;
}

export class SwarmGatewayClient {
  constructor(private readonly baseUrl: string) {}

  async getSnapshot(): Promise<SwarmBackendSnapshot> {
    const res = await fetch(`${trimSlash(this.baseUrl)}/snapshot`);
    if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
    return (await res.json()) as SwarmBackendSnapshot;
  }

  async getHealth(): Promise<SwarmBackendHealth> {
    const res = await fetch(`${trimSlash(this.baseUrl)}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return (await res.json()) as SwarmBackendHealth;
  }

  async postCommand(targetId: string, command: string, args: Record<string, unknown> = {}, wait = true): Promise<SwarmCommandResponseBody> {
    const res = await fetch(`${trimSlash(this.baseUrl)}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, command, args, wait }),
    });
    if (!res.ok) throw new Error(`command failed: ${res.status}`);
    return (await res.json()) as SwarmCommandResponseBody;
  }
}

export type SwarmWsSnapshotListener = (snap: SwarmBackendSnapshot) => void;

/**
 * Subscribes to FastAPI ``/ws`` frames: initial ``{type:\"snapshot\",payload}`` and optional hub events.
 */
export class SwarmBackendRealtime {
  private ws: WebSocket | null = null;

  constructor(private readonly wsUrl: string) {}

  connect(onSnapshot: SwarmWsSnapshotListener): void {
    if (typeof WebSocket === "undefined") return;
    this.disconnect();
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        if (msg.type === "snapshot" && msg.payload && typeof msg.payload === "object") {
          onSnapshot(msg.payload as SwarmBackendSnapshot);
        }
        if (msg.event_type && msg.payload && typeof msg.payload === "object") {
          const p = msg.payload as Record<string, unknown>;
          if ("node" in p && "missions" in p) onSnapshot(p as unknown as SwarmBackendSnapshot);
        }
      } catch {
        /* ignore malformed */
      }
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  requestSnapshot(): void {
    try {
      this.ws?.send(JSON.stringify({ type: "snapshot" }));
    } catch {
      /* closed */
    }
  }
}

export function readSwarmBackendHttpBase(): string | null {
  const raw = import.meta.env.VITE_SWARM_BACKEND_HTTP as string | undefined;
  if (!raw || !String(raw).trim()) return null;
  return trimSlash(String(raw).trim());
}
