import type { NetworkStressMode } from "./types";
import { createNetworkConditionController, type NetworkConditionController } from "./networkConditions";

export type MeshStressInjector = {
  controller: NetworkConditionController;
  manualPartition: boolean;
  injectPacketLoss(delta01: number): void;
  injectLatency(deltaMs: number): void;
  toggleManualPartition(active: boolean): void;
  reset(): void;
};

export function createMeshStressInjector(initial: NetworkStressMode): MeshStressInjector {
  const controller = createNetworkConditionController(initial);
  const state = { manualPartition: false };
  return {
    controller,
    get manualPartition() {
      return state.manualPartition;
    },
    injectPacketLoss(delta01) {
      controller.injectLoss(delta01);
    },
    injectLatency(deltaMs) {
      controller.injectLatency(deltaMs);
    },
    toggleManualPartition(active) {
      state.manualPartition = active;
    },
    reset() {
      state.manualPartition = false;
      controller.resetManual();
    },
  };
}
