import type { GraphEdge, ConnectivitySnapshot, SwarmAgentNode } from "./swarm-types";

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Mesh graph with partitions, relay importance, and operator reachability. */
export class ConnectivityGraph {
  private edges = new Map<string, GraphEdge>();

  private edgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  setEdge(edge: GraphEdge): void {
    const k = this.edgeKey(edge.a, edge.b);
    this.edges.set(k, edge);
  }

  removeEdge(a: string, b: string): void {
    this.edges.delete(this.edgeKey(a, b));
  }

  getEdge(a: string, b: string): GraphEdge | undefined {
    return this.edges.get(this.edgeKey(a, b));
  }

  allEdges(): GraphEdge[] {
    return [...this.edges.values()];
  }

  /**
   * Rebuild edges from node positions and per-link quality; long-range relays get bonus reach.
   */
  rebuildFromNodes(nodes: SwarmAgentNode[], baseRangeM: number, rng: () => number): void {
    this.edges.clear();
    const ids = nodes.map((n) => n.nodeId);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const na = nodes[i];
        const nb = nodes[j];
        const d = dist(na.position, nb.position);
        const range =
          baseRangeM +
          0.35 * (na.capabilities.meshRangeM + nb.capabilities.meshRangeM) / 1000 -
          d * 1.2;
        if (range <= 0) continue;
        const quality01 = Math.max(0.05, Math.min(1, 0.25 + range * 0.06 + (rng() - 0.5) * 0.15));
        const loss = Math.max(0, Math.min(0.55, 0.55 - quality01 * 0.5));
        const latencyMs = Math.round(40 + (1 - quality01) * 220 + d * 8);
        this.setEdge({ a: na.nodeId, b: nb.nodeId, latencyMs, loss, quality01 });
      }
    }
  }

  /** Nodes reachable from ``source`` over edges with quality >= minQ. */
  reachableFrom(source: string, minQ = 0.12): Set<string> {
    const seen = new Set<string>([source]);
    const q = [source];
    while (q.length) {
      const cur = q.pop();
      for (const e of this.edges.values()) {
        if (e.a !== cur && e.b !== cur) continue;
        if (e.quality01 < minQ) continue;
        const other = e.a === cur ? e.b : e.a;
        if (seen.has(other)) continue;
        seen.add(other);
        q.push(other);
      }
    }
    return seen;
  }

  partitionClusters(nodeIds: string[], minQ = 0.12): string[][] {
    const rem = new Set(nodeIds);
    const clusters: string[][] = [];
    while (rem.size) {
      const start = rem.values().next().value as string;
      const comp = this.reachableFrom(start, minQ);
      const part = [...comp].filter((id) => rem.has(id));
      for (const id of part) rem.delete(id);
      clusters.push(part.sort());
    }
    return clusters.sort((a, b) => b.length - a.length);
  }

  snapshot(operatorId: string, nodes: SwarmAgentNode[], staleIds: Set<string>): ConnectivitySnapshot {
    const edges = this.allEdges();
    const ids = nodes.map((n) => n.nodeId);
    const clusters = this.partitionClusters(ids, 0.1);
    const opReach = this.reachableFrom(operatorId, 0.08);
    let worst: GraphEdge | undefined;
    for (const e of edges) {
      if (!worst || e.quality01 < worst.quality01) worst = e;
    }
    const relayChains = nodes
      .filter((n) => n.role === "relay")
      .map((n) => {
        const r = this.reachableFrom(n.nodeId, 0.12);
        return [n.nodeId, ...[...r].filter((id) => id !== n.nodeId).slice(0, 4)];
      })
      .filter((c) => c.length > 1);

    return {
      edges,
      partitionClusters: clusters,
      operatorReachable: opReach,
      relayChains,
      bottleneckEdge: worst,
      stalePeers: staleIds,
    };
  }

  fastestRecoveryNode(nodes: SwarmAgentNode[]): string | undefined {
    let best: SwarmAgentNode | undefined;
    for (const n of nodes) {
      if (!best || n.capabilities.recoveryLatencyMs < best.capabilities.recoveryLatencyMs) best = n;
    }
    return best?.nodeId;
  }
}
