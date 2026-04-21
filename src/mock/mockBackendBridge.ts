import type { FlatMissionEnvelope, SimulationAugmentation } from "@/lib/state/types";
import { ScenarioSimulationRuntime } from "./scenarioRuntime";

type Listener = (payload: { flat: FlatMissionEnvelope; simulation: SimulationAugmentation }) => void;

/**
 * Async façade so UI / hooks can treat the deterministic simulator like a backend client.
 */
export class MockBackendBridge {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private runtime: ScenarioSimulationRuntime) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitSnapshot(flat: FlatMissionEnvelope, simulation: SimulationAugmentation): void {
    for (const fn of this.listeners) fn({ flat, simulation });
  }

  startPolling(
    getFlat: () => FlatMissionEnvelope,
    intervalMs: number,
    getPhase: () => string,
    getSource: () => SimulationAugmentation["source"],
  ): void {
    this.stopPolling();
    this.timer = setInterval(() => {
      const sim = this.runtime.tick(Date.now(), getPhase(), getSource());
      this.emitSnapshot(getFlat(), sim);
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getRuntime(): ScenarioSimulationRuntime {
    return this.runtime;
  }
}
