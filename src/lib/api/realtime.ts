import { SwarmBackendRealtime } from "@/lib/tashi-sdk/swarmGatewayClient";
import type { SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import type { IntegrationHttpClient } from "./client";
import { logIntegrationError } from "./client";

export type RealtimeStatus = "idle" | "ws_connecting" | "ws_open" | "poll" | "degraded";

export type RealtimeCallbacks = {
  onSnapshot: (snap: SwarmBackendSnapshot) => void;
  onStatus: (s: RealtimeStatus) => void;
  onWsDrop?: () => void;
};

const MAX_RECONNECT = 8;

/**
 * Prefer WebSocket snapshot stream; fall back to HTTP polling with exponential backoff.
 */
export class SwarmRealtimeCoordinator {
  private rt: SwarmBackendRealtime | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = false;

  constructor(
    private readonly http: IntegrationHttpClient,
    private readonly cb: RealtimeCallbacks,
    private readonly pollMs = 5000,
    private readonly pollFallbackSnapshot?: () => SwarmBackendSnapshot,
  ) {}

  start(wsUrl: string | null): void {
    this.stopped = false;
    if (wsUrl) {
      this.connectWs(wsUrl);
    } else {
      this.startPollOnly();
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.rt?.disconnect();
    this.rt = null;
    this.cb.onStatus("idle");
  }

  private connectWs(wsUrl: string): void {
    this.cb.onStatus("ws_connecting");
    this.rt = new SwarmBackendRealtime(wsUrl);
    this.rt.connect(
      (snap) => {
        this.attempt = 0;
        this.cb.onStatus("ws_open");
        this.cb.onSnapshot(snap);
      },
      {
        onClose: () => this.onWsClosed(wsUrl),
        onError: () => this.onWsClosed(wsUrl),
      },
    );
  }

  private onWsClosed(wsUrl: string): void {
    if (this.stopped) return;
    this.cb.onWsDrop?.();
    this.cb.onStatus("degraded");
    this.ensurePoll();
    if (this.attempt >= MAX_RECONNECT) return;
    const delay = Math.min(30_000, 800 * 2 ** this.attempt++);
    this.reconnectTimer = setTimeout(() => {
      if (this.stopped) return;
      this.connectWs(wsUrl);
    }, delay);
  }

  private ensurePoll(): void {
    if (this.pollTimer) return;
    this.cb.onStatus("poll");
    void this.pullOnce();
    this.pollTimer = setInterval(() => void this.pullOnce(), this.pollMs);
  }

  private startPollOnly(): void {
    this.ensurePoll();
  }

  private async pullOnce(): Promise<void> {
    try {
      const snap = await this.http.snapshot();
      this.cb.onSnapshot(snap);
    } catch (e) {
      logIntegrationError("poll_snapshot", e);
      if (this.pollFallbackSnapshot) {
        try {
          this.cb.onSnapshot(this.pollFallbackSnapshot());
        } catch (fb) {
          logIntegrationError("poll_snapshot_demo_fallback", fb);
        }
      }
    }
  }
}
