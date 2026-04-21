import type { NetworkConditionVector } from "./types";
import { clamp01 } from "./normalizers";

export type VotePayload = {
  proposalId: string;
  peerId: string;
  yes: boolean;
};

export type ProposalState = {
  id: string;
  summary: string;
  createdAtMs: number;
  votesYes: Set<string>;
  votesNo: Set<string>;
  decided: "pending" | "committed" | "rejected";
  commitAtMs?: number;
  commitLatencyMs?: number;
};

export class MeshConsensusEngine {
  private seq = 0;
  private active: ProposalState | null = null;
  private history: ProposalState[] = [];

  get sequence(): number {
    return this.seq;
  }

  snapshot(): ProposalState[] {
    return this.active ? [...this.history, this.active] : [...this.history];
  }

  maybeStartProposal(nowMs: number, rng: () => number, summaryFactory: (id: string) => string): ProposalState | null {
    if (this.active && this.active.decided === "pending") return null;
    if (rng() > 0.22) return null;
    const id = `prop-${++this.seq}`;
    this.active = {
      id,
      summary: summaryFactory(id),
      createdAtMs: nowMs,
      votesYes: new Set(),
      votesNo: new Set(),
      decided: "pending",
    };
    return this.active;
  }

  /**
   * Leaderless quorum: require 2f+1 style quorum over **reachable** participants, with loss/delay applied externally.
   */
  registerVote(
    vote: VotePayload,
    reachablePeers: string[],
    vector: NetworkConditionVector,
    rng: () => number,
    nowMs: number,
  ): { committed?: ProposalState; rejected?: ProposalState } {
    if (!this.active || this.active.id !== vote.proposalId) return {};
    if (this.active.decided !== "pending") return {};
    const p = this.active;
    // Byzantine-like flips
    const flip = rng() < 0.03;
    const yes = flip ? !vote.yes : vote.yes;
    if (yes) p.votesYes.add(vote.peerId);
    else p.votesNo.add(vote.peerId);
    const n = Math.max(1, reachablePeers.length);
    const f = Math.floor((n - 1) / 3);
    const need = Math.min(n, 2 * f + 1 > 0 ? 2 * f + 1 : Math.ceil(n * 0.66));
    const stress = clamp01(vector.loss01 + vector.timeoutChance01 * 0.35);
    const adjustedNeed = Math.min(n, Math.max(2, Math.ceil(need * (0.92 + stress * 0.08))));
    if (p.votesYes.size >= adjustedNeed) {
      p.decided = "committed";
      p.commitAtMs = nowMs;
      p.commitLatencyMs = nowMs - p.createdAtMs;
      this.history.push(p);
      const done = p;
      this.active = null;
      return { committed: done };
    }
    if (p.votesNo.size > Math.max(1, Math.floor(n / 3))) {
      p.decided = "rejected";
      p.commitAtMs = nowMs;
      p.commitLatencyMs = nowMs - p.createdAtMs;
      this.history.push(p);
      const done = p;
      this.active = null;
      return { rejected: done };
    }
    return {};
  }

  forceExpire(): void {
    if (this.active?.decided === "pending") {
      this.active.decided = "rejected";
      this.history.push(this.active);
      this.active = null;
    }
  }
}
