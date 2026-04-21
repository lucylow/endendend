export type RecoveryBufferItem = { atMs: number; kind: string; payload: unknown };

/**
 * Per-node recovery buffers — flushed when partition heals (mesh continuity).
 */
export class MeshRecoveryBuffers {
  private byPeer = new Map<string, RecoveryBufferItem[]>();
  private lastFlushAt: number | null = null;

  buffer(peerId: string, item: RecoveryBufferItem): void {
    const arr = this.byPeer.get(peerId) ?? [];
    arr.push(item);
    this.byPeer.set(peerId, arr.slice(-80));
  }

  pendingCount(): number {
    let n = 0;
    for (const a of this.byPeer.values()) n += a.length;
    return n;
  }

  drainAll(nowMs: number): RecoveryBufferItem[] {
    const all: RecoveryBufferItem[] = [];
    for (const arr of this.byPeer.values()) all.push(...arr);
    this.byPeer.clear();
    this.lastFlushAt = nowMs;
    return all;
  }

  getLastFlushAt(): number | null {
    return this.lastFlushAt;
  }
}
