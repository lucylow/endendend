import type { RewardManifestRecord } from "@/backend/arc/reward-manifest";

export type QueuedSettlementStatus = "queued" | "processing" | "settled" | "failed";

export type QueuedSettlement = {
  missionId: string;
  manifest: RewardManifestRecord;
  status: QueuedSettlementStatus;
  arcTxHash?: string;
  error?: string;
  timestamp: number;
};

/** Returns a stable settlement / bridge reference (demo: tx hash placeholder). */
export type SettlementEmitter = (missionId: string, manifest: RewardManifestRecord) => Promise<string>;

/**
 * FIFO Arc settlement queue: enqueue after ``phase_transition`` / terminal Vertex events
 * so coordination stays off the hot path.
 */
export class SettlementQueue {
  private readonly fifo: QueuedSettlement[] = [];
  private readonly byMission = new Map<string, QueuedSettlement>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly emit: SettlementEmitter) {}

  enqueue(missionId: string, manifest: RewardManifestRecord): void {
    const pending = this.byMission.get(missionId);
    if (pending && (pending.status === "queued" || pending.status === "processing")) {
      return;
    }

    const row: QueuedSettlement = {
      missionId,
      manifest,
      status: "queued",
      timestamp: Date.now(),
    };
    this.byMission.set(missionId, row);
    this.fifo.push(row);
    this.tail = this.tail.then(() => this.drainOnce());
  }

  /** Await all currently scheduled work (tests / graceful shutdown). */
  async flush(): Promise<void> {
    await this.tail;
  }

  getStatus(missionId: string): QueuedSettlement | undefined {
    return this.byMission.get(missionId);
  }

  private async drainOnce(): Promise<void> {
    while (this.fifo.length > 0) {
      const item = this.fifo[0];
      if (item.status !== "queued") {
        this.fifo.shift();
        continue;
      }

      item.status = "processing";
      try {
        item.arcTxHash = await this.emit(item.missionId, item.manifest);
        item.status = "settled";
      } catch (err) {
        item.status = "failed";
        item.error = err instanceof Error ? err.message : String(err);
      }
      this.fifo.shift();
    }
  }
}
