import type { MissionLedgerEventType } from "./event-types";
import { sha256Hex, stableStringify } from "./hash-chain";

export type ControlPlane = "vertex" | "lattice" | "arc";

export type MissionLedgerEvent = {
  missionId: string;
  actorId: string;
  eventType: MissionLedgerEventType;
  /** Which Tashi-style plane produced this append-only record. */
  plane: ControlPlane;
  payload: Record<string, unknown>;
  timestamp: number;
  previousHash: string;
  eventHash: string;
};

export type AppendMissionEventInput = Omit<MissionLedgerEvent, "eventHash">;

async function computeEventHash(previousHash: string, core: Omit<MissionLedgerEvent, "eventHash" | "previousHash">): Promise<string> {
  const body = stableStringify(core);
  return sha256Hex(`${previousHash}|${body}`);
}

export class MissionLedger {
  private readonly events: MissionLedgerEvent[] = [];

  constructor(initial?: MissionLedgerEvent[]) {
    if (initial) this.events.push(...initial);
  }

  get length(): number {
    return this.events.length;
  }

  toArray(): MissionLedgerEvent[] {
    return [...this.events];
  }

  head(): MissionLedgerEvent | undefined {
    return this.events[this.events.length - 1];
  }

  tailHash(): string {
    return this.head()?.eventHash ?? "genesis";
  }

  async append(input: AppendMissionEventInput): Promise<MissionLedgerEvent> {
    const prev = input.previousHash;
    const core = {
      missionId: input.missionId,
      actorId: input.actorId,
      eventType: input.eventType,
      plane: input.plane,
      payload: input.payload,
      timestamp: input.timestamp,
    };
    const eventHash = await computeEventHash(prev, core);
    const full: MissionLedgerEvent = { ...input, eventHash };
    if (full.previousHash !== prev) throw new Error("previousHash_mismatch");
    this.events.push(full);
    return full;
  }

  /** Verify full chain from genesis. */
  async verifyChain(): Promise<{ ok: boolean; at?: number; reason?: string }> {
    let prev = "genesis";
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      if (e.previousHash !== prev) return { ok: false, at: i, reason: "previous_link" };
      const expected = await computeEventHash(prev, {
        missionId: e.missionId,
        actorId: e.actorId,
        eventType: e.eventType,
        plane: e.plane,
        payload: e.payload,
        timestamp: e.timestamp,
      });
      if (expected !== e.eventHash) return { ok: false, at: i, reason: "event_hash" };
      prev = e.eventHash;
    }
    return { ok: true };
  }
}
