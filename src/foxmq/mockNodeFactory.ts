import type { FoxMqNodeRecord } from "./nodeRegistry";

export function makeMockFoxNodes(nodeIds: string[], nowMs: number): FoxMqNodeRecord[] {
  return nodeIds.map((nodeId, i) => ({
    nodeId,
    online: true,
    lastHeartbeatMs: nowMs - i * 3,
    stale: false,
    sectorLabel: `sec-${(i % 9) + 1}`,
  }));
}
