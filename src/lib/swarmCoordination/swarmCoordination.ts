import type { Agent } from "@/types";

/** Stake × preference scores; higher stake breaks near-ties (broadcast–vote–consolidate). */
export function stakeAmplifiedScores(
  stakes: number[],
  preferences: number[],
  temperature = 1,
): number[] {
  if (stakes.length !== preferences.length) {
    throw new Error("stakes and preferences must have the same length");
  }
  const t = Math.max(temperature, 1e-6);
  return stakes.map((s, i) => (Math.max(s, 0) * preferences[i]!) / t);
}

export function pickStakeWeightedIndex(scores: number[]): number {
  if (scores.length === 0) throw new Error("empty scores");
  let bestI = 0;
  let best = scores[0]!;
  for (let i = 1; i < scores.length; i++) {
    const v = scores[i]!;
    if (v > best) {
      best = v;
      bestI = i;
    }
  }
  return bestI;
}

export type StandbyPickInput = Pick<Agent, "id" | "battery" | "stakeAmount">;

/**
 * Choose a standby to absorb a role: stake × (battery/100) with deterministic id tie-break.
 * Aligns dashboard handoffs with Vertex-style stake-weighted promotion.
 */
export function pickStandbyForRoleHandoff(candidates: StandbyPickInput[]): StandbyPickInput | null {
  if (candidates.length === 0) return null;
  const stakes = candidates.map((c) => c.stakeAmount);
  const prefs = candidates.map((c) => Math.max(0, c.battery) / 100);
  const scores = stakeAmplifiedScores(stakes, prefs, 1);
  const i = pickStakeWeightedIndex(scores);
  return candidates[i] ?? null;
}
