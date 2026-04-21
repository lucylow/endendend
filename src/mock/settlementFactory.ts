import { SeededRandom } from "./seededRandom";
import type { SettlementPreviewViewModel } from "@/lib/state/types";

export function mockSettlementPreview(seed: string, missionId: string, ready: boolean): SettlementPreviewViewModel {
  const rng = new SeededRandom(`${seed}|settle`);
  const h = Array.from({ length: 8 }, () => rng.nextInt(0, 16).toString(16)).join("");
  return {
    ready,
    manifestHash: `0x${h}`,
    settlementAmount: ready ? `${(rng.nextFloat(120, 900)).toFixed(2)} DEMO` : undefined,
    chainRef: "arc-simulated-settlement",
    operatorAddress: undefined,
    mockLabeled: true,
    source: "mock",
  };
}
