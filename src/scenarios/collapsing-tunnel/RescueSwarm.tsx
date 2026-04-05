import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Instances, Instance } from "@react-three/drei";
import { HeartbeatLossDetection } from "./HeartbeatLossDetection";
import { RescueChainReformation } from "./RescueChainReformation";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";
import type { TunnelSimAgent } from "./collapsingTunnelStore";
import RelayChainLines from "./RelayChainLines";

function agentStatusColor(agent: TunnelSimAgent): string {
  if (agent.trapped) return "#ef4444";
  switch (agent.tunnelRescueRole) {
    case "rescue_lead":
      return "#34d399";
    case "relay":
      return "#38bdf8";
    default:
      return agent.color;
  }
}

export default function RescueSwarm() {
  const reformation = useRef(new RescueChainReformation()).current;
  const heartbeat = useRef(new HeartbeatLossDetection()).current;
  const collapseSimT = useRef<number | null>(null);
  const session = useCollapsingTunnelStore((s) => s.session);

  useEffect(() => {
    heartbeat.reset();
  }, [heartbeat, session]);

  useFrame((state) => {
    const st = useCollapsingTunnelStore.getState();
    if (!st.simRunning) return;

    const dt = Math.min(state.clock.getDelta(), 0.05);
    const t = state.clock.elapsedTime;

    if (!st.collapseTriggered) {
      collapseSimT.current = null;
    } else if (collapseSimT.current == null) {
      collapseSimT.current = t;
    }

    const next = st.agents.map((a) => ({
      ...a,
      position: { ...a.position },
      velocity: { ...a.velocity },
    }));

    for (const agent of next) {
      if (agent.trapped) {
        agent.tunnelRescueRole = undefined;
        continue;
      }

      heartbeat.isAlive(agent);

      let ax = 0;
      let az = 0;

      if (st.collapseTriggered) {
        const rescueRole = reformation.assignRescueRole(agent, next);
        agent.tunnelRescueRole = rescueRole;

        const rescueVec = reformation.getRescuePath(agent);
        const head = reformation.relayHeading(agent);
        const survivors = next.filter((a) => a.status === "active" && !a.trapped);
        const sep = reformation.separation(agent, survivors);

        const blend =
          rescueRole === "rescue_lead"
            ? rescueVec.clone().multiplyScalar(0.72).add(head.clone().multiplyScalar(0.28))
            : rescueVec.clone().multiplyScalar(0.45).add(head.clone().multiplyScalar(0.35)).add(sep.clone().multiplyScalar(0.2));

        if (blend.lengthSq() > 1e-8) {
          blend.normalize();
          ax += blend.x * 4.2;
          az += blend.z * 4.2;
        }
      } else {
        agent.tunnelRescueRole = undefined;
        az -= 0.19;
        ax += Math.sin(t * 0.9 + agent.id.charCodeAt(0)) * 0.08;
        const survivors = next.filter((a) => a.status === "active" && !a.trapped);
        const sep = reformation.separation(agent, survivors);
        if (sep.lengthSq() > 1e-8) {
          ax += sep.x * 0.4;
          az += sep.z * 0.25;
        }
      }

      agent.velocity.x = agent.velocity.x * 0.92 + ax * dt;
      agent.velocity.z = agent.velocity.z * 0.92 + az * dt;
      agent.position.x += agent.velocity.x * dt * 42;
      agent.position.z += agent.velocity.z * dt * 42;
      agent.position.x = Math.max(-5.5, Math.min(5.5, agent.position.x));
    }

    const lead =
      next.find((a) => a.tunnelRescueRole === "rescue_lead" && !a.trapped) ??
      next.find((a) => a.role === "explorer" && !a.trapped) ??
      next.find((a) => !a.trapped);
    let beaconSent = st.beaconSent;
    let rescueComplete = st.rescueComplete;
    let tashiRescueS = st.tashiRescueS;
    let rescueSpeedup = st.rescueSpeedup;

    if (st.collapseTriggered && lead && collapseSimT.current != null) {
      if (!beaconSent && lead.position.z > 14) beaconSent = true;
      if (!rescueComplete && lead.position.z > 26) {
        rescueComplete = true;
        tashiRescueS = Math.max(0.4, t - collapseSimT.current);
        rescueSpeedup = st.manualBaselineS / tashiRescueS;
      }
    }

    useCollapsingTunnelStore.setState({
      agents: next,
      beaconSent,
      rescueComplete,
      tashiRescueS,
      rescueSpeedup,
    });
  });

  const agents = useCollapsingTunnelStore((s) => s.agents);
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);

  return (
    <group>
      <Instances limit={agents.length} castShadow>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial
          color="#94a3b8"
          emissive="#0f172a"
          emissiveIntensity={collapseTriggered ? 0.35 : 0.2}
          metalness={0.85}
          roughness={0.22}
        />
        {agents.map((agent) => (
          <Instance
            key={agent.id}
            color={agentStatusColor(agent)}
            position={[agent.position.x, agent.position.y + 0.45, agent.position.z]}
            scale={agent.trapped ? 1.35 : 1}
          />
        ))}
      </Instances>

      {agents
        .filter((a) => a.trapped)
        .map((agent) => (
          <SOSBeacon key={`sos-${agent.id}`} agent={agent} />
        ))}

      {collapseTriggered ? <RelayChainLines agents={agents} /> : null}
    </group>
  );
}

function SOSBeacon({ agent }: { agent: TunnelSimAgent }) {
  return (
    <group position={[agent.position.x, agent.position.y + 1.1, agent.position.z]}>
      <mesh>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={1.2} />
      </mesh>
      <pointLight intensity={1.8} distance={8} color="#ef4444" />
      <Html center distanceFactor={10}>
        <div className="rounded border border-red-500/60 bg-black/85 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-400 shadow-lg">
          SOS
        </div>
      </Html>
    </group>
  );
}
