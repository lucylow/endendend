import { SeededRandom } from "./seededRandom";
import type { RewardLineViewModel } from "@/lib/state/types";

export function mockRewardLines(seed: string, nodeIds: string[]): RewardLineViewModel[] {
  const rng = new SeededRandom(`${seed}|rewards`);
  return nodeIds.slice(0, 6).map((nodeId, i) => ({
    id: `rw-${i}-${nodeId}`,
    nodeId,
    kind: i % 3 === 0 ? "discovery" : i % 3 === 1 ? "relay" : "validation",
    amount: String(12 + Math.floor(rng.next() * 140)),
    source: "mock" as const,
  }));
}
