import { useSwarmStore } from "@/store/swarmStore";
import type { ScenarioDefinition } from "./registry";

/**
 * Applies scenario presets to the live swarm store (simulation + fault injection).
 * Keeps the 3D canvas and KPIs in sync with the SAR orchestrator.
 */
export function applyScenarioToSwarm(scenario: ScenarioDefinition, chaosLevel: number) {
  const store = useSwarmStore.getState();
  const {
    setFaultConfig,
    setBehaviorMode,
    setSpeed,
    startSimulation,
    triggerTargetDiscovery,
    triggerRoleHandoff,
    triggerBlindHandoffDemo,
    runConsensus,
    resetSimulation,
  } = store;

  const chaos = Math.min(3, Math.max(0, chaosLevel));
  const lossBoost = chaos * 8;
  const byzBoost = chaos;

  switch (scenario.slug) {
    case "dynamic-relay":
      setFaultConfig({ packetLoss: 5 + lossBoost * 0.5, latencyMs: 20 + chaos * 15, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      break;
    case "victim-priority":
      setFaultConfig({ packetLoss: 4, latencyMs: 25, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      setTimeout(() => triggerTargetDiscovery(), 400);
      break;
    case "battery-cascade":
      setFaultConfig({ packetLoss: 6, latencyMs: 30, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      break;
    case "circular-bypass":
      setFaultConfig({ packetLoss: 8 + lossBoost * 0.3, latencyMs: 35, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      break;
    case "flash-override":
      setFaultConfig({ packetLoss: 3, latencyMs: 15, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("rescue");
      startSimulation();
      setTimeout(() => runConsensus("task_acceptance"), 300);
      break;
    case "thermal-rebalance":
      setFaultConfig({ packetLoss: 10, latencyMs: 80 + chaos * 40, byzantineNodes: 0, faultType: "delay" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      break;
    case "magnetic-attraction":
      setFaultConfig({ packetLoss: 5, latencyMs: 22, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      setTimeout(() => triggerTargetDiscovery(), 600);
      break;
    case "tunnel-collapse":
      setFaultConfig({ packetLoss: 28 + lossBoost, latencyMs: 50 + chaos * 20, byzantineNodes: byzBoost, faultType: "drop" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      setTimeout(() => runConsensus("relay_insertion"), 800);
      break;
    case "multi-swarm-handoff":
      setFaultConfig({ packetLoss: 7, latencyMs: 28, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      setTimeout(() => triggerRoleHandoff("agent-0", "air_to_ground_handoff"), 900);
      break;
    case "arena-race":
      setFaultConfig({ packetLoss: 4, latencyMs: 18, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      break;
    case "stake-voting":
      setFaultConfig({ packetLoss: 5, latencyMs: 24, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      setTimeout(() => runConsensus("explorer_election"), 200);
      break;
    case "predator-evasion":
      setFaultConfig({ packetLoss: 10 + lossBoost * 0.5, latencyMs: 30, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      break;
    case "random-failure":
      setFaultConfig({
        packetLoss: 22 + lossBoost * 2,
        latencyMs: 40 + chaos * 25,
        byzantineNodes: Math.min(5, 2 + byzBoost),
        faultType: chaos > 1 ? "corrupt" : "drop",
      });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      setTimeout(() => runConsensus("relay_insertion"), 500);
      break;
    case "warehouse-restock":
      setFaultConfig({ packetLoss: 4 + lossBoost * 0.4, latencyMs: 20, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      break;
    case "fallen-comrade":
      setFaultConfig({ packetLoss: 6 + lossBoost * 0.35, latencyMs: 22, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("exploring");
      startSimulation();
      setTimeout(() => triggerRoleHandoff("agent-1", "fallen_comrade_sector_realloc"), 2200);
      break;
    case "blind-handoff":
      setFaultConfig({ packetLoss: 5 + lossBoost * 0.4, latencyMs: 24 + chaos * 8, byzantineNodes: 0, faultType: "none" });
      setSpeed(scenario.viz.defaultSpeed);
      setBehaviorMode("combined");
      startSimulation();
      setTimeout(() => triggerBlindHandoffDemo(), 500);
      break;
    default:
      resetSimulation();
  }
}
