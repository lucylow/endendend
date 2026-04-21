import { SwarmGatewayClient, readSwarmBackendHttpBase, swarmBackendWsUrl } from "@/lib/tashi-sdk/swarmGatewayClient";
import type { SwarmBackendHealth, SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import { formatGatewayError } from "@/lib/integration/swarmGatewayResilience";

const DEFAULT_TIMEOUT_MS = 12_000;

export type BackendClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

/** Single entry for HTTP calls against the swarm / Vertex gateway (when ``VITE_SWARM_BACKEND_HTTP`` is set). */
export class IntegrationHttpClient {
  private readonly inner: SwarmGatewayClient;
  private readonly timeoutMs: number;

  constructor(cfg: BackendClientConfig) {
    this.inner = new SwarmGatewayClient(cfg.baseUrl, { timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS });
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
    try {
      return await this.inner.getHealth();
    } catch (e) {
      throw new Error(formatGatewayError(e));
    }
  }

  async snapshot(): Promise<SwarmBackendSnapshot> {
    try {
      return await this.inner.getSnapshot();
    } catch (e) {
      throw new Error(formatGatewayError(e));
    }
  }

  async command(targetId: string, command: string, args: Record<string, unknown> = {}, wait = true) {
    try {
      return await this.inner.postCommand(targetId, command, args, wait);
    } catch (e) {
      throw new Error(formatGatewayError(e));
    }
  }
}

export function logIntegrationError(scope: string, err: unknown): void {
  if (import.meta.env.DEV) console.warn(`[integration:${scope}]`, formatGatewayError(err));
}
