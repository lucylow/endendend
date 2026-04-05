import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ObstacleVectorModel } from "./ObstacleVectorModel";
import { VotingDirectionEngine } from "./VotingDirectionEngine";
import { useObstacleBypassStore } from "./obstacleBypassStore";
import type { Agent } from "@/types";

const PILLAR_R = 8.5;
const MAX_SPEED = 0.42;

function ensureVel(map: Map<string, THREE.Vector3>, id: string) {
  if (!map.has(id)) map.set(id, new THREE.Vector3());
  return map.get(id)!;
}

function boidsSeparation(agent: Agent, all: Agent[]): THREE.Vector3 {
  const v = new THREE.Vector3();
  let n = 0;
  for (const o of all) {
    if (o.id === agent.id) continue;
    const dx = agent.position.x - o.position.x;
    const dz = agent.position.z - o.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 7) {
      v.x += dx / (d * d);
      v.z += dz / (d * d);
      n++;
    }
  }
  if (n) v.multiplyScalar(1 / n);
  return v;
}

function boidsAlignment(agent: Agent, all: Agent[], velMap: Map<string, THREE.Vector3>): THREE.Vector3 {
  const v = new THREE.Vector3();
  let n = 0;
  for (const o of all) {
    if (o.id === agent.id) continue;
    const d = Math.hypot(agent.position.x - o.position.x, agent.position.z - o.position.z);
    if (d < 14) {
      v.add(ensureVel(velMap, o.id).clone());
      n++;
    }
  }
  if (!n) return v;
  return v.multiplyScalar(1 / n);
}

function boidsCohesion(agent: Agent, all: Agent[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  let n = 0;
  for (const o of all) {
    if (o.id === agent.id) continue;
    c.x += o.position.x;
    c.z += o.position.z;
    n++;
  }
  if (!n) return new THREE.Vector3();
  c.multiplyScalar(1 / n);
  return new THREE.Vector3(c.x - agent.position.x, 0, c.z - agent.position.z);
}

export default function CirculationSwarm() {
  const velMap = useRef(new Map<string, THREE.Vector3>()).current;
  const obstacleVectors = useRef(new ObstacleVectorModel()).current;
  const votingEngine = useRef(new VotingDirectionEngine()).current;

  useFrame((state) => {
    const delta = state.clock.getDelta();
    const st = useObstacleBypassStore.getState();
    if (!st.simRunning) return;

    const motion = delta * 14;
    const pillar = new THREE.Vector3(0, 0, 0);
    const mode = st.mode;
    const next: Agent[] = st.agents.map((a) => ({ ...a, position: { ...a.position } }));

    let nearPillar = false;
    let shareCount = 0;

    for (const agent of next) {
      const vel = ensureVel(velMap, agent.id);
      const ap = new THREE.Vector3(agent.position.x, 1, agent.position.z);

      if (mode === "leader-follower") {
        const isLead = agent.id === "ob-0";
        const goal = isLead
          ? new THREE.Vector3(26, 0, 24)
          : new THREE.Vector3(next[0]!.position.x - 2.5, 0, next[0]!.position.z + 0.8);
        const toGoal = new THREE.Vector3().subVectors(goal, ap).setY(0);
        if (toGoal.lengthSq() > 1e-6) toGoal.normalize();
        const rep = obstacleVectors.getRepulsion(ap, pillar).multiplyScalar(0.28);
        vel.multiplyScalar(0.93);
        vel.add(toGoal.multiplyScalar(0.16));
        vel.add(rep);
      } else {
        const sep = boidsSeparation(agent, next).multiplyScalar(1.5);
        const ali = boidsAlignment(agent, next, velMap).multiplyScalar(1.0);
        const coh = boidsCohesion(agent, next).multiplyScalar(0.8);
        const obs = obstacleVectors.getRepulsion(ap, pillar).multiplyScalar(2.0);
        const voted = votingEngine.getConsensusDirection(next, pillar).multiplyScalar(1.2);

        for (const o of next) {
          const p = new THREE.Vector3(o.position.x, 0, o.position.z);
          obstacleVectors.shareVector(o.id, obstacleVectors.getRepulsion(p, pillar));
        }
        shareCount = next.length;

        const steer = new THREE.Vector3().add(sep).add(ali).add(coh).add(obs).add(voted);
        if (steer.lengthSq() > 1e-6) steer.normalize().multiplyScalar(0.12);
        vel.multiplyScalar(0.95);
        vel.add(steer);

        const dist = new THREE.Vector3(agent.position.x, 0, agent.position.z).distanceTo(pillar);
        if (dist < 12 && dist > 0.08) {
          const radial = new THREE.Vector3(agent.position.x, 0, agent.position.z).sub(pillar);
          const tangential = new THREE.Vector3().crossVectors(radial.normalize(), new THREE.Vector3(0, 1, 0));
          tangential.multiplyScalar(0.32 / dist);
          vel.add(tangential);
        }
      }

      if (vel.length() > MAX_SPEED) vel.normalize().multiplyScalar(MAX_SPEED);
      agent.position.x += vel.x * motion;
      agent.position.z += vel.z * motion;

      const dxz = Math.hypot(agent.position.x, agent.position.z);
      if (dxz < PILLAR_R) {
        useObstacleBypassStore.getState().bumpCollision(mode);
        const push = new THREE.Vector3(agent.position.x, 0, agent.position.z);
        if (push.lengthSq() > 1e-6) push.normalize().multiplyScalar(0.55);
        agent.position.x += push.x;
        agent.position.z += push.z;
      }
      if (dxz < PILLAR_R + 3.5) nearPillar = true;
    }

    useObstacleBypassStore.getState().tickFrame(mode);

    const s2 = useObstacleBypassStore.getState();
    const swarmClear =
      s2.framesSwarm > 0 ? Math.max(0, 100 - (s2.collisionsSwarm / s2.framesSwarm) * 200) : 100;
    const lfClear =
      s2.framesLeader > 0 ? Math.max(0, 100 - (s2.collisionsLeader / s2.framesLeader) * 200) : 100;
    const live = mode === "swarm" ? swarmClear : lfClear;

    useObstacleBypassStore.setState({
      agents: next,
      clearanceRate: Math.min(100, live),
      vectorShareCount: mode === "swarm" ? shareCount : 0,
      pillarProximity: nearPillar,
    });
  });

  const agents = useObstacleBypassStore((s) => s.agents);
  const proximity = useObstacleBypassStore((s) => s.pillarProximity);

  return (
    <group>
      {proximity ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[9.2, 11.2, 48]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      ) : null}
      {agents.map((agent) => (
        <mesh key={agent.id} position={[agent.position.x, agent.position.y, agent.position.z]} castShadow>
          <icosahedronGeometry args={[0.65, 1]} />
          <meshStandardMaterial
            color={agent.color}
            emissive="#1d4ed8"
            emissiveIntensity={0.45}
            metalness={0.85}
            roughness={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}
