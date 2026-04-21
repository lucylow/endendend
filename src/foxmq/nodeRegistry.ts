export type FoxMqNodeRecord = {
  nodeId: string;
  online: boolean;
  lastHeartbeatMs: number;
  stale: boolean;
  sectorLabel?: string;
};

export class FoxMqNodeRegistry {
  private nodes = new Map<string, FoxMqNodeRecord>();

  upsert(n: FoxMqNodeRecord): void {
    this.nodes.set(n.nodeId, { ...n });
  }

  snapshot(): FoxMqNodeRecord[] {
    return [...this.nodes.values()];
  }

  offlineIds(nowMs: number, staleMs: number): string[] {
    const out: string[] = [];
    for (const r of this.nodes.values()) {
      if (!r.online) out.push(r.nodeId);
      else if (nowMs - r.lastHeartbeatMs > staleMs) out.push(r.nodeId);
    }
    return out;
  }

  reset(): void {
    this.nodes.clear();
  }
}
