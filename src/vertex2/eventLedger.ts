import { sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { CommitmentStatus, MeshLedgerEvent, MeshLedgerEventType } from "./types";

export type AppendMeshEventInput = Omit<MeshLedgerEvent, "id" | "eventHash"> & { id?: string };

let serial = 1;

async function hashFor(previousHash: string, core: Omit<MeshLedgerEvent, "id" | "eventHash" | "previousHash">): Promise<string> {
  const body = stableStringify(core);
  return sha256Hex(`${previousHash}|${body}`);
}

export class MeshEventLedger {
  private events: MeshLedgerEvent[] = [];

  toArray(): MeshLedgerEvent[] {
    return [...this.events];
  }

  tailHash(): string {
    return this.events[this.events.length - 1]?.eventHash ?? "genesis";
  }

  async append(input: AppendMeshEventInput): Promise<MeshLedgerEvent> {
    const id = input.id ?? `mesh-${serial++}`;
    const prev = input.previousHash;
    const core = {
      timestamp: input.timestamp,
      missionId: input.missionId,
      actorPeerId: input.actorPeerId,
      eventType: input.eventType,
      payload: input.payload,
      sourceLabel: input.sourceLabel,
      commitmentStatus: input.commitmentStatus,
      proofHint: input.proofHint,
    };
    const proofHint =
      input.proofHint ??
      (await sha256Hex(`poc|${prev}|${input.eventType}|${stableStringify(input.payload)}`)).slice(0, 24);
    const eventHash = await hashFor(prev, { ...core, proofHint });
    const full: MeshLedgerEvent = {
      id,
      previousHash: prev,
      eventHash,
      ...core,
      proofHint,
    };
    this.events.push(full);
    return full;
  }

  async verifyChain(): Promise<{ ok: boolean; at?: number; reason?: string }> {
    let prev = "genesis";
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      if (e.previousHash !== prev) return { ok: false, at: i, reason: "previous_link" };
      const expected = await hashFor(prev, {
        timestamp: e.timestamp,
        missionId: e.missionId,
        actorPeerId: e.actorPeerId,
        eventType: e.eventType,
        payload: e.payload,
        sourceLabel: e.sourceLabel,
        commitmentStatus: e.commitmentStatus,
        proofHint: e.proofHint,
      });
      if (expected !== e.eventHash) return { ok: false, at: i, reason: "event_hash" };
      prev = e.eventHash;
    }
    return { ok: true };
  }
}

export function statusFor(type: MeshLedgerEventType): CommitmentStatus {
  if (
    type === "consensus_committed" ||
    type === "replay_commit" ||
    type === "checkpoint_saved" ||
    type === "task_mesh_assigned"
  )
    return "committed";
  if (type === "consensus_rejected") return "rejected";
  return "pending";
}
