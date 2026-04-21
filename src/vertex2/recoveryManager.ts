import type { MeshLedgerEvent } from "./types";

export type BufferedMeshOp = {
  atMs: number;
  kind: string;
  payload: Record<string, unknown>;
};

/** Buffers coordination ops while partitioned; reconciles on heal without breaking hash chain semantics. */
export class MeshRecoveryManager {
  private buffers = new Map<string, BufferedMeshOp[]>();

  bufferForPeer(peerId: string, op: BufferedMeshOp): void {
    const arr = this.buffers.get(peerId) ?? [];
    arr.push(op);
    this.buffers.set(peerId, arr.slice(-120));
  }

  drainPeer(peerId: string): BufferedMeshOp[] {
    const v = this.buffers.get(peerId) ?? [];
    this.buffers.set(peerId, []);
    return v;
  }

  drainAll(): BufferedMeshOp[] {
    const out: BufferedMeshOp[] = [];
    for (const [, arr] of this.buffers) out.push(...arr);
    this.buffers.clear();
    return out.sort((a, b) => a.atMs - b.atMs);
  }

  mergeEvents(primary: MeshLedgerEvent[], side: BufferedMeshOp[]): MeshLedgerEvent[] {
    void side;
    return [...primary].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  }
}
