import { SwarmGatewayClient, readSwarmBackendHttpBase, swarmBackendWsUrl } from "@/lib/tashi-sdk/swarmGatewayClient";
import type { SwarmBackendHealth, SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";

const DEFAULT_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export type BackendClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

/** Single entry for HTTP calls against the swarm / Vertex gateway (when ``VITE_SWARM_BACKEND_HTTP`` is set). */
export class IntegrationHttpClient {
  private readonly inner: SwarmGatewayClient;
  private readonly timeoutMs: number;

  constructor(cfg: BackendClientConfig) {
    this.inner = new SwarmGatewayClient(cfg.baseUrl);
    this.timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  static fromEnv(): IntegrationHttpClient | null {
    const base = readSwarmBackendHttpBase();
    if (!base) return null;
    return new IntegrationHttpClient({ baseUrl: base });
  }

  wsUrl(): string | null {
    const base = readSwarmBackendHttpBase();
    if (!base) return null;
    return swarmBackendWsUrl(base);
  }

  async health(): Promise<SwarmBackendHealth> {
    const base = readSwarmBackendHttpBase();
    if (!base) throw new Error("no_backend_base");
    const res = await fetchWithTimeout(`${base.replace(/\/+$/, "")}/health`, {}, this.timeoutMs);
    if (!res.ok) throw new Error(`health_${res.status}`);
    return (await res.json()) as SwarmBackendHealth;
  }

  async snapshot(): Promise<SwarmBackendSnapshot> {
    return this.inner.getSnapshot();
  }

  async command(targetId: string, command: string, args: Record<string, unknown> = {}, wait = true) {
    return this.inner.postCommand(targetId, command, args, wait);
  }
}

export function logIntegrationError(scope: string, err: unknown): void {
  if (import.meta.env.DEV) console.warn(`[integration:${scope}]`, err);
}
