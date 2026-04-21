import type { SwarmBackendHealth, SwarmBackendSnapshot, SwarmCommandResponseBody } from "./swarmBackendTypes";

const DEFAULT_REQUEST_MS = 12_000;

function trimSlash(base: string): string {
  return base.replace(/\/+$/, "");
}

async function readJsonBody<T>(res: Response, label: string): Promise<T> {
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: could not read response body (${cause})`);
  }
  if (!text.trim()) throw new Error(`${label}: empty response body (HTTP ${res.status})`);
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: invalid JSON (${hint})`);
  }
}

/** Resolve ``/ws`` on the same origin as the HTTP base URL. Supports relative ``httpBase`` (e.g. ``/api/swarm``) in the browser. */
export function swarmBackendWsUrl(httpBase: string): string {
  const pathBase = `${trimSlash(httpBase)}/`;
  const absoluteBase =
    pathBase.startsWith("/") && typeof window !== "undefined"
      ? `${window.location.origin}${pathBase}`
      : pathBase.startsWith("/")
        ? `http://127.0.0.1${pathBase}`
        : pathBase;
  const ws = new URL("./ws", absoluteBase.endsWith("/") ? absoluteBase : `${absoluteBase}/`);
  ws.protocol = ws.protocol === "https:" ? "wss:" : "ws:";
  return ws.href;
}

export type SwarmGatewayClientOptions = {
  /** Abort slow gateways (snapshot/health/command). */
  timeoutMs?: number;
};

export class SwarmGatewayClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly baseUrl: string,
    opts: SwarmGatewayClientOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_REQUEST_MS;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `${trimSlash(this.baseUrl)}${path}`;
    const ctrl = new AbortController();
    const t = globalThis.setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`gateway request timed out after ${this.timeoutMs}ms (${path})`);
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`gateway network error on ${path}: ${msg}`);
    } finally {
      globalThis.clearTimeout(t);
    }
  }

  async getSnapshot(): Promise<SwarmBackendSnapshot> {
    const res = await this.request("/snapshot");
    if (!res.ok) {
      const hint = res.statusText ? ` ${res.statusText}` : "";
      throw new Error(`snapshot failed: HTTP ${res.status}${hint}`);
    }
    return readJsonBody<SwarmBackendSnapshot>(res, "snapshot");
  }

  async getHealth(): Promise<SwarmBackendHealth> {
    const res = await this.request("/health");
    if (!res.ok) {
      const hint = res.statusText ? ` ${res.statusText}` : "";
      throw new Error(`health failed: HTTP ${res.status}${hint}`);
    }
    return readJsonBody<SwarmBackendHealth>(res, "health");
  }

  async postCommand(targetId: string, command: string, args: Record<string, unknown> = {}, wait = true): Promise<SwarmCommandResponseBody> {
    const res = await this.request("/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, command, args, wait }),
    });
    if (!res.ok) {
      const hint = res.statusText ? ` ${res.statusText}` : "";
      throw new Error(`command failed: HTTP ${res.status}${hint}`);
    }
    return readJsonBody<SwarmCommandResponseBody>(res, "command");
  }
}

export type SwarmWsSnapshotListener = (snap: SwarmBackendSnapshot) => void;

/**
 * Subscribes to FastAPI ``/ws`` frames: initial ``{type:\"snapshot\",payload}`` and optional hub events.
 */
export type SwarmWsLifecycle = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
};

export class SwarmBackendRealtime {
  private ws: WebSocket | null = null;

  constructor(private readonly wsUrl: string) {}

  connect(onSnapshot: SwarmWsSnapshotListener, lifecycle?: SwarmWsLifecycle): void {
    if (typeof WebSocket === "undefined") return;
    this.disconnect();
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = () => lifecycle?.onOpen?.();
    this.ws.onclose = () => lifecycle?.onClose?.();
    this.ws.onerror = () => lifecycle?.onError?.();
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
  const s = String(raw).trim();
  /** Relative bases (e.g. ``/api/swarm``) work with ``fetch`` on the deployed origin or Vite proxy. */
  if (s.startsWith("/")) return s.replace(/\/+$/, "") || null;
  return trimSlash(s);
}
