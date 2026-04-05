import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BatteryDegradationModel } from "./BatteryDegradationModel";
import { HeartbeatConsensus } from "./HeartbeatConsensus";
import { RelayPromotionEngine } from "./RelayPromotionEngine";
import BatteryVisualizer3D from "./BatteryVisualizer3D";
import RelayChainLines from "./RelayChainLines";
import {
  useBatteryCascadeStore,
  TASHI_PROJECTED_S,
  STATIC_BASELINE_S,
} from "./batteryCascadeStore";
import type { Agent } from "@/types";

export default function BatteryCascadeSwarm() {
  const degradation = useRef(new BatteryDegradationModel()).current;
  const heartbeat = useRef(new HeartbeatConsensus()).current;
  const promotion = useRef(new RelayPromotionEngine()).current;

  useFrame((state) => {
    const st0 = useBatteryCascadeStore.getState();
    if (!st0.simRunning) return;

    const dt = state.clock.getDelta() * st0.failureTimeScale;
    const t = state.clock.elapsedTime * st0.failureTimeScale;

    const next: Agent[] = st0.agents.map((a) => ({ ...a, position: { ...a.position } }));

    for (const agent of next) {
      if (agent.status !== "active") continue;

      if (st0.accelerateFailure && Math.random() < 0.025 && agent.role === "relay") {
        heartbeat.blackout(agent.id, t + 0.09);
      }

      heartbeat.receive(agent.id, t);
      if (!heartbeat.isAlive(agent.id, t, 0.05)) {
        agent.status = "offline";
        agent.currentBehavior = "idle";
        continue;
      }

      const drain = degradation.getDrainRate(agent.role, agent.position.z) * dt * 60;
      agent.battery = Math.max(0, agent.battery - drain);

      if (agent.role === "explorer") {
        agent.position.z = Math.max(agent.position.z - 12 * dt, -118);
        agent.currentBehavior = "exploring";
      }
    }

    if (t > 45 && !useBatteryCascadeStore.getState().scenarioStats.cascadeTriggered) {
      for (let i = 0; i < next.length; i++) {
        const a = next[i]!;
        if (a.role === "relay") a.battery = Math.max(5, a.battery * 0.25);
        if (i === 0 && a.role === "explorer") a.battery = Math.min(16, Math.max(5, a.battery * 0.58));
      }
      const standby = next.find((a) => a.role === "standby" && a.status === "active");
      if (standby) heartbeat.blackout(standby.id, t + 0.05);
      useBatteryCascadeStore.getState().setScenarioStats({ cascadeTriggered: true });
    }

    for (const agent of next) {
      if (agent.status !== "active") continue;
      if (!promotion.shouldPromoteToRelay(agent, next, Math.min(1, t / 88))) continue;
      const i = next.findIndex((x) => x.id === agent.id);
      if (i < 0) continue;
      next[i] = {
        ...next[i]!,
        role: "relay",
        color: "#6366f1",
        currentBehavior: "relaying",
      };
      useBatteryCascadeStore.getState().pushPromotion({
        agentId: agent.id,
        name: agent.name,
        reason: "standby_auto_promote_gap_fill",
      });
      useBatteryCascadeStore.getState().setScenarioStats({
        recoveryComplete: true,
        missionExtension: 42,
        tashiDuration: TASHI_PROJECTED_S,
        staticDuration: STATIC_BASELINE_S,
      });
      break;
    }

    useBatteryCascadeStore.getState().setAgents(next);
  });

  const agents = useBatteryCascadeStore((s) => s.agents);
  const relays = agents.filter((a) => a.role === "relay" && a.status === "active");

  return (
    <>
      <BatteryVisualizer3D agents={agents} />
      <RelayChainLines agents={relays.length ? relays : agents.filter((a) => a.status === "active")} />
    </>
  );
}
