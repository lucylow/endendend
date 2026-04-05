import type { PathProposal } from "./types";

/**
 * Simulates stake-weighted P2P propagation latency before Vertex collapses votes.
 */
export async function foxmqWeightedBroadcast(proposal: PathProposal, stakes: number[]): Promise<{ latencyMs: number }> {
  const weight = stakes.length ? stakes.reduce((a, b) => a + b, 0) / stakes.length : 1;
  const latencyMs = Math.round(40 + 120 / Math.sqrt(weight / 100));
  await new Promise((r) => setTimeout(r, Math.min(latencyMs, 200)));
  return { latencyMs };
}
