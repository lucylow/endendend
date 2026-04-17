import { create } from "zustand";
import type {
  Agent, SwarmData, Task, Mission, GridCell, Target, SwarmTask,
  RoleHandoff, MissionEvent, ConsensusInstance, FaultConfig, ConsensusMetrics,
  BlindHandoffOverlayState,
} from "@/types";
import type { EdgeLatencyUpdate, SwarmStatusUpdate, WsConnectionState } from "@/types/websocket";
import { FoxMQClient, createDroneNodeId } from "@/lib/foxmq";
import {
  ExplorationManager,
  applyExploredKeysToGrid,
  explorationProgressPercent,
} from "@/lib/explorationManager";
import { FOXMQ_AUTH_TOKEN, FOXMQ_WORLD_MAP_KEY } from "@/config/foxmq";
import { useP2PStore } from "@/store/p2pStore";
import { setNetworkFaultPacketLoss } from "@/store/networkFaultContext";
import { applyHealthToAgents } from "@/features/health/HealthEngine";

const AGENT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
const GRID_ROWS = 8;
const GRID_COLS = 10;

function createMockAgent(index: number): Agent {
  const role: Agent["role"] = index === 0 ? "explorer" : index < 4 ? "relay" : "standby";
  return {
    id: `agent-${index}`,
    name: AGENT_NAMES[index] || `Agent-${index}`,
    role,
    position: { x: (Math.random() - 0.5) * 20, y: Math.random() * 2, z: (Math.random() - 0.5) * 20 },
    battery: 60 + Math.random() * 40,
    status: "active",
    trajectory: [],
    color: role === "explorer" ? "#00d4ff" : role === "relay" ? "#6366f1" : "#525252",
    latency: 10 + Math.random() * 40,
    tasksCompleted: Math.floor(Math.random() * 20),
    stakeAmount: 100 + Math.floor(Math.random() * 900),
    currentBehavior: role === "explorer" ? "exploring" : role === "relay" ? "relaying" : "idle",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
  };
}

function createGrid(): GridCell[][] {
  return Array.from({ length: GRID_ROWS }, (_, r) =>
    Array.from({ length: GRID_COLS }, (_, c) => ({ row: r, col: c, searched: false, searchedBy: null, timestamp: null }))
  );
}

function createMockTasks(): Task[] {
  return [
    { id: "task-1", title: "Rescue Victim Sector 7", description: "Navigate to coordinates and extract survivor", priority: "critical", status: "bidding", reward: 500, bids: [{ agentId: "agent-0", amount: 450, timestamp: Date.now(), stake: 200 }], createdAt: Date.now() - 60000, deadline: Date.now() + 300000 },
    { id: "task-2", title: "Map Tunnel Section B", description: "Full LIDAR scan of unexplored tunnel section", priority: "high", status: "open", reward: 300, bids: [], createdAt: Date.now() - 30000, deadline: Date.now() + 600000 },
    { id: "task-3", title: "Deploy Relay Node 4", description: "Position relay at optimal signal junction", priority: "medium", status: "assigned", reward: 200, bids: [], assignedAgent: "agent-2", createdAt: Date.now() - 120000, deadline: Date.now() + 180000 },
    { id: "task-4", title: "Battery Recharge Station", description: "Return to base for emergency recharge", priority: "low", status: "completed", reward: 100, bids: [], assignedAgent: "agent-5", createdAt: Date.now() - 300000, deadline: Date.now() + 60000 },
    { id: "task-5", title: "Structural Analysis Grid C", description: "Assess tunnel structural integrity", priority: "high", status: "bidding", reward: 350, bids: [{ agentId: "agent-1", amount: 320, timestamp: Date.now(), stake: 150 }, { agentId: "agent-3", amount: 300, timestamp: Date.now(), stake: 180 }], createdAt: Date.now() - 45000, deadline: Date.now() + 400000 },
  ];
}

function defaultMetrics(): ConsensusMetrics {
  return { totalAttempts: 0, successes: 0, failures: 0, avgLatencyMs: 0, latencyHistory: [], successRateHistory: [], byzantineFaultsDetected: 0 };
}

function defaultFaultConfig(): FaultConfig {
  return { packetLoss: 0, latencyMs: 0, byzantineNodes: 0, faultType: "none" };
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

const TRAJECTORY_MAX = 200;

function appendTrajectory(agent: Agent, pos: Agent["position"]): Agent["trajectory"] {
  const next = [...agent.trajectory, { x: pos.x, y: pos.y, z: pos.z }];
  return next.length > TRAJECTORY_MAX ? next.slice(-TRAJECTORY_MAX) : next;
}

interface SwarmState {
  swarm: SwarmData;
  agents: Agent[];
  tasks: Task[];
  missions: Mission[];
  isRunning: boolean;
  simulationTime: number;
  speed: number;
  selectedAgentId: string | null;
  totalStaked: number;
  rewardsEarned: number;
  grid: GridCell[][];
  targets: Target[];
  swarmTasks: SwarmTask[];
  handoffs: RoleHandoff[];
  eventLog: MissionEvent[];
  explorationProgress: number;
  /** Cells in the FoxMQ-replicated world map (row, col). */
  exploredCellsFoxmq: [number, number][];
  foxmqConnected: boolean;
  foxmqNodeId: string | null;
  behaviorMode: "idle" | "exploring" | "rescue" | "combined";

  // BFT state
  consensusInstances: ConsensusInstance[];
  faultConfig: FaultConfig;
  consensusMetrics: ConsensusMetrics;
  consensusSeq: number;
  /** Global order counter after successful BFT commits (UI / fair ordering). */
  consensusOrderedSeq: number;

  /** Live WebSocket / Webots bridge HUD */
  swarmWs: {
    connectionStatus: WsConnectionState;
    latencyMs: number;
    messagesPerSec: number;
    telemetryPeerUrls: string[];
    telemetryPeersConnected: number;
    telemetryMergeConflict: boolean;
  };
  /** When true, 3D tick should not advance local kinematics (stream owns poses). */
  realtimeTelemetryActive: boolean;
  /** Air-to-ground handoff HUD (Blind Handoff scenario). */
  blindHandoffOverlay: BlindHandoffOverlayState | null;
  /** Recent edge-local latency samples (newest first), e.g. `edge_latency` WebSocket frames. */
  edgeLatencyEvents: Array<{ operation: string; latencyMs: number; sender?: string; receiver?: string; ts: number }>;

  // Actions
  startSimulation: () => void;
  pauseSimulation: () => void;
  setSpeed: (speed: number) => void;
  selectAgent: (id: string | null) => void;
  updateAgentPositions: () => void;
  setBehaviorMode: (mode: SwarmState["behaviorMode"]) => void;
  triggerTargetDiscovery: () => void;
  triggerRoleHandoff: (agentId: string, reason: string) => void;
  resetSimulation: () => void;
  setFaultConfig: (config: Partial<FaultConfig>) => void;
  runConsensus: (type: ConsensusInstance["type"]) => void;
  toggleByzantine: (agentId: string) => void;
  /** Pull latest world_map from FoxMQ into the grid (e.g. after reconnect). */
  resyncWorldMapFromFoxmq: () => void;

  updateAgentsBatch: (agents: Agent[]) => void;
  /** Recompute vitals from current poses (e.g. viz idle with sim paused). */
  recomputeAgentHealth: () => void;
  applySwarmStatusUpdate: (u: SwarmStatusUpdate) => void;
  setSwarmWsMetrics: (m: Partial<SwarmState["swarmWs"]>) => void;
  setRealtimeTelemetryActive: (active: boolean) => void;
  pushEdgeLatencyEvent: (e: EdgeLatencyUpdate) => void;
  setBlindHandoffOverlay: (overlay: BlindHandoffOverlayState | null) => void;
  triggerBlindHandoffDemo: () => void;
}

let foxmqClient: FoxMQClient | null = null;
let explorationManager: ExplorationManager | null = null;

function getExplorerId(agents: Agent[]): string | null {
  const ex = agents.find((a) => (a.role === "explorer" || a.currentBehavior === "exploring") && a.status === "active");
  return ex?.id ?? null;
}

function ensureFoxmqExploration(
  set: (partial: Partial<SwarmState>) => void,
  get: () => SwarmState,
): ExplorationManager {
  if (explorationManager && foxmqClient?.connected) return explorationManager;
  const nodeId = createDroneNodeId();
  foxmqClient = new FoxMQClient(nodeId);
  foxmqClient.connect();
  explorationManager = new ExplorationManager(foxmqClient, (keys) => {
    const { grid, agents } = get();
    const merged = applyExploredKeysToGrid(grid, keys, getExplorerId(agents));
    const cells: [number, number][] = [...keys].map((k) => {
      const [r, c] = k.split(",").map(Number);
      return [r, c] as [number, number];
    });
    set({
      grid: merged,
      explorationProgress: explorationProgressPercent(merged),
      exploredCellsFoxmq: cells,
    });
  });
  set({ foxmqConnected: true, foxmqNodeId: nodeId });
  return explorationManager;
}

function teardownFoxmq() {
  explorationManager = null;
  foxmqClient?.disconnect();
  foxmqClient = null;
}

export const useSwarmStore = create<SwarmState>((set, get) => ({
  swarm: { id: "swarm-1", name: "Tashi Swarm Alpha", agentCount: 8, status: "exploring" },
  agents: applyHealthToAgents(
    Array.from({ length: 8 }, (_, i) => createMockAgent(i)),
    defaultFaultConfig(),
    Date.now(),
  ),
  tasks: createMockTasks(),
  missions: [{
    id: "mission-1", name: "Tunnel Rescue Op", startTime: Date.now() - 3600000, status: "active", agentCount: 8, tasksCompleted: 12,
    events: [
      { timestamp: Date.now() - 3600000, type: "agent_deployed", description: "Alpha deployed at tunnel entrance", agentId: "agent-0" },
      { timestamp: Date.now() - 3000000, type: "relay_inserted", description: "Relay node inserted at 50m depth", agentId: "agent-1" },
      { timestamp: Date.now() - 2400000, type: "task_assigned", description: "Sector 7 rescue assigned to Alpha", agentId: "agent-0" },
      { timestamp: Date.now() - 1800000, type: "agent_failed", description: "Delta went offline - low battery", agentId: "agent-3" },
      { timestamp: Date.now() - 1200000, type: "relay_inserted", description: "Echo promoted to relay role", agentId: "agent-4" },
    ],
  }],
  isRunning: false, simulationTime: 0, speed: 1, selectedAgentId: null,
  totalStaked: 4250, rewardsEarned: 1820,
  grid: createGrid(), targets: [], swarmTasks: [], handoffs: [],
  eventLog: [], explorationProgress: 0, exploredCellsFoxmq: [], foxmqConnected: false, foxmqNodeId: null,
  behaviorMode: "idle",

  // BFT
  consensusInstances: [],
  faultConfig: defaultFaultConfig(),
  consensusMetrics: defaultMetrics(),
  consensusSeq: 0,
  consensusOrderedSeq: 0,

  swarmWs: {
    connectionStatus: "disconnected",
    latencyMs: 0,
    messagesPerSec: 0,
    telemetryPeerUrls: [],
    telemetryPeersConnected: 0,
    telemetryMergeConflict: false,
  },
  realtimeTelemetryActive: false,
  blindHandoffOverlay: null,
  edgeLatencyEvents: [],

  updateAgentsBatch: (agents) => {
    const { faultConfig } = get();
    set({ agents: applyHealthToAgents(agents, faultConfig, Date.now()) });
  },

  recomputeAgentHealth: () => {
    const { agents, faultConfig } = get();
    set({ agents: applyHealthToAgents(agents, faultConfig, Date.now()) });
  },

  applySwarmStatusUpdate: (u) => {
    const { swarm } = get();
    set({
      swarm: {
        ...swarm,
        ...(u.name != null && u.name.length > 0 ? { name: u.name } : {}),
        ...(typeof u.agentCount === "number" && Number.isFinite(u.agentCount)
          ? { agentCount: Math.max(0, Math.floor(u.agentCount)) }
          : {}),
        ...(u.status != null ? { status: u.status } : {}),
      },
    });
  },

  setSwarmWsMetrics: (m) =>
    set((state) => ({ swarmWs: { ...state.swarmWs, ...m } })),

  setRealtimeTelemetryActive: (active) => set({ realtimeTelemetryActive: active }),

  pushEdgeLatencyEvent: (e) =>
    set((state) => ({
      edgeLatencyEvents: [
        {
          operation: e.operation,
          latencyMs: e.latencyMs,
          sender: e.sender,
          receiver: e.receiver,
          ts: e.timestamp ?? Date.now(),
        },
        ...state.edgeLatencyEvents,
      ].slice(0, 100),
    })),

  startSimulation: () => {
    ensureFoxmqExploration(set, get);
    set({ isRunning: true });
  },
  pauseSimulation: () => set({ isRunning: false }),
  setSpeed: (speed) => set({ speed }),
  selectAgent: (id) => set({ selectedAgentId: id }),

  setBehaviorMode: (mode) => {
    const { agents, eventLog, faultConfig } = get();
    if (mode === "exploring" || mode === "combined") ensureFoxmqExploration(set, get);
    const mapped = agents.map((a) => {
      if (mode === "exploring" && (a.role === "explorer" || a.role === "standby")) return { ...a, currentBehavior: "exploring" as const };
      return a;
    });
    set({
      behaviorMode: mode, isRunning: true,
      agents: applyHealthToAgents(mapped, faultConfig, Date.now()),
      eventLog: [...eventLog, { timestamp: Date.now(), type: "agent_deployed" as const, description: `Behavior mode set to ${mode}` }],
    });
  },

  triggerTargetDiscovery: () => {
    const { agents, targets, eventLog, swarmTasks } = get();
    const explorer = agents.find((a) => a.role === "explorer" && a.status === "active");
    if (!explorer) return;
    const newTarget: Target = {
      id: `target-${targets.length + 1}`, location: { ...explorer.position, x: explorer.position.x + 2 },
      timestamp: Date.now(), confidence: 0.85 + Math.random() * 0.15, discoveredBy: explorer.id, status: "discovered", assignedAgent: null,
    };
    const available = agents.filter((a) => a.id !== explorer.id && a.status === "active" && a.currentBehavior !== "rescuing");
    let bestAgent: Agent | null = null; let bestDist = Infinity;
    for (const a of available) { const d = dist(a.position, newTarget.location); if (d < bestDist) { bestDist = d; bestAgent = a; } }
    const newTask: SwarmTask = {
      id: `stask-${swarmTasks.length + 1}`, type: "rescue_victim", params: { targetId: newTarget.id, location: newTarget.location },
      status: bestAgent ? "awarded" : "announced",
      bids: bestAgent ? [{ agentId: bestAgent.id, score: 1 / bestDist, distance: bestDist, battery: bestAgent.battery, timestamp: Date.now() }] : [],
      awardedTo: bestAgent?.id || null, createdAt: Date.now(), deadline: Date.now() + 120000,
    };
    if (bestAgent) { newTarget.status = "assigned"; newTarget.assignedAgent = bestAgent.id; }
    const { faultConfig } = get();
    const nextAgents = agents.map((a) => a.id === bestAgent?.id ? { ...a, currentBehavior: "rescuing" as const, targetId: newTarget.id } : a);
    set({
      targets: [...targets, newTarget], swarmTasks: [...swarmTasks, newTask],
      agents: applyHealthToAgents(nextAgents, faultConfig, Date.now()),
      eventLog: [...eventLog,
        { timestamp: Date.now(), type: "target_found" as const, description: `${explorer.name} discovered victim`, agentId: explorer.id },
        ...(bestAgent ? [{ timestamp: Date.now(), type: "task_assigned" as const, description: `Rescue assigned to ${bestAgent.name}`, agentId: bestAgent.id }] : []),
      ],
    });
  },

  triggerRoleHandoff: (agentId, reason) => {
    const { agents, handoffs, eventLog, faultConfig } = get();
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    const candidates = agents.filter((a) => a.id !== agentId && a.status === "active" && a.role === "standby" && a.battery > 30);
    if (!candidates.length) return;
    const best = candidates.sort((a, b) => b.battery - a.battery)[0]!;
    const roleColor = agent.role === "explorer" ? "#00d4ff" : agent.role === "relay" ? "#6366f1" : "#525252";
    const handed = agents.map((a) => {
      if (a.id === agentId) return { ...a, role: "standby" as const, color: "#525252", currentBehavior: "idle" as const };
      if (a.id === best.id) return { ...a, role: agent.role, color: roleColor, currentBehavior: agent.currentBehavior };
      return a;
    });
    set({
      handoffs: [...handoffs, { id: `handoff-${handoffs.length + 1}`, fromAgent: agentId, toAgent: best.id, role: agent.role, reason, status: "completed" as const, timestamp: Date.now() }],
      agents: applyHealthToAgents(handed, faultConfig, Date.now()),
      eventLog: [...eventLog, { timestamp: Date.now(), type: "role_handoff" as const, description: `${agent.name} → ${best.name} (${agent.role}, ${reason})`, agentId: agent.id }],
    });
  },

  setBlindHandoffOverlay: (overlay) => set({ blindHandoffOverlay: overlay }),

  triggerBlindHandoffDemo: () => {
    const { agents, eventLog, handoffs, faultConfig } = get();
    const aerial = agents.find((a) => a.role === "explorer" && a.status === "active") ?? agents[0];
    if (!aerial) return;

    const victim = { x: aerial.position.x + 5.5, y: 0.2, z: aerial.position.z + 1.2 };
    const distXZ = (a: Agent) => Math.hypot(a.position.x - victim.x, a.position.z - victim.z);
    const others = agents.filter((a) => a.id !== aerial.id && a.status === "active");
    const ranked = [...others].sort((a, b) => distXZ(a) - distXZ(b));
    const winner = ranked[0] ?? null;

    const BH_ID = "bh-handoff-demo";
    const baseLog = [
      "RESCUE_HANDOFF_REQUEST — victim_location, aerial battery, deadline (Vertex broadcast, no cloud)",
    ];

    const withPlatform = agents.map((a) => {
      if (a.id === aerial.id) {
        return {
          ...a,
          platform: "aerial" as const,
          battery: Math.min(a.battery, 17),
          color: "#38bdf8",
          currentBehavior: "exploring" as const,
        };
      }
      return {
        ...a,
        platform: "ground" as const,
        color: a.role === "relay" ? "#64748b" : "#78716c",
      };
    });

    const t0 = Date.now();
    set({
      agents: applyHealthToAgents(withPlatform, faultConfig, Date.now()),
      blindHandoffOverlay: {
        phase: "request",
        aerialId: aerial.id,
        rescuerId: null,
        victim,
        logLines: baseLog,
      },
      eventLog: [
        ...eventLog,
        {
          timestamp: t0,
          type: "rescue_handoff",
          description: "Aerial (low battery) broadcasts RESCUE_HANDOFF_REQUEST to mesh",
          agentId: aerial.id,
        },
      ],
    });

    window.setTimeout(() => {
      const st = get();
      const lines = [
        ...baseLog,
        "HANDOFF_BID — each available ground rover replies with distance / ETA (unicast)",
      ];
      set({
        blindHandoffOverlay: st.blindHandoffOverlay
          ? { ...st.blindHandoffOverlay, phase: "bidding", logLines: lines }
          : null,
        eventLog: [
          ...st.eventLog,
          {
            timestamp: Date.now(),
            type: "rescue_handoff",
            description: "Ground rovers: HANDOFF_BID (distance-ranked)",
          },
        ],
      });
    }, 650);

    window.setTimeout(() => {
      if (!winner) return;
      const st = get();
      const lines = [
        ...(st.blindHandoffOverlay?.logLines ?? baseLog),
        `HANDOFF_ACCEPT + HANDOFF_ACK — ${winner.name} (${winner.id}) wins lowest bid`,
      ];
      set({
        blindHandoffOverlay: st.blindHandoffOverlay
          ? { ...st.blindHandoffOverlay, phase: "accepted", rescuerId: winner.id, logLines: lines }
          : null,
        agents: applyHealthToAgents(
          st.agents.map((a) =>
            a.id === winner.id ? { ...a, currentBehavior: "rescuing" as const, targetId: "bh-v1" } : a,
          ),
          st.faultConfig,
          Date.now(),
        ),
        handoffs: [
          ...st.handoffs.filter((h) => h.id !== BH_ID),
          {
            id: BH_ID,
            fromAgent: aerial.id,
            toAgent: winner.id,
            role: aerial.role,
            reason: "blind_handoff_air_to_ground",
            status: "accepted",
            timestamp: Date.now(),
          },
        ],
        eventLog: [
          ...st.eventLog,
          {
            timestamp: Date.now(),
            type: "rescue_handoff",
            description: `HANDOFF_ACCEPT → ${winner.name}; rover en route (P2P unicast)`,
            agentId: winner.id,
          },
        ],
      });
    }, 1400);

    window.setTimeout(() => {
      const st = get();
      const victimTarget: Target = {
        id: "bh-v1",
        location: victim,
        timestamp: Date.now(),
        confidence: 1,
        discoveredBy: aerial.id,
        status: "rescued",
        assignedAgent: winner?.id ?? null,
      };
      const lines = [
        ...(st.blindHandoffOverlay?.logLines ?? baseLog),
        "RESCUE_COMPLETE — victim cleared on mesh; aerial resumes sweep / RTB",
      ];
      set({
        targets: [...st.targets.filter((t) => t.id !== "bh-v1"), victimTarget],
        blindHandoffOverlay: st.blindHandoffOverlay
          ? { ...st.blindHandoffOverlay, phase: "complete", logLines: lines }
          : null,
        agents: applyHealthToAgents(
          st.agents.map((a) =>
            a.id === winner?.id ? { ...a, currentBehavior: "idle" as const, targetId: null } : a,
          ),
          st.faultConfig,
          Date.now(),
        ),
        handoffs: st.handoffs.map((h) =>
          h.id === BH_ID ? { ...h, status: "completed" as const } : h,
        ),
        eventLog: [
          ...st.eventLog,
          {
            timestamp: Date.now(),
            type: "rescue_handoff",
            description: "RESCUE_COMPLETE broadcast — air-to-ground blind handoff closed",
            agentId: winner?.id,
          },
        ],
      });
    }, 2400);
  },

  setFaultConfig: (config) => {
    const { faultConfig, agents, eventLog } = get();
    const newConfig = { ...faultConfig, ...config };
    setNetworkFaultPacketLoss(newConfig.packetLoss);
    // Mark agents as byzantine
    const updated = agents.map((a, i) => ({ ...a, isByzantine: i >= agents.length - newConfig.byzantineNodes }));
    set({
      faultConfig: newConfig,
      agents: applyHealthToAgents(updated, newConfig, Date.now()),
      eventLog: [...eventLog, { timestamp: Date.now(), type: "fault_injected" as const, description: `Fault config: ${newConfig.packetLoss}% loss, ${newConfig.latencyMs}ms delay, ${newConfig.byzantineNodes} byzantine, type=${newConfig.faultType}` }],
    });
  },

  toggleByzantine: (agentId) => {
    const { agents, faultConfig } = get();
    const next = agents.map((a) => a.id === agentId ? { ...a, isByzantine: !a.isByzantine } : a);
    set({ agents: applyHealthToAgents(next, faultConfig, Date.now()) });
  },

  runConsensus: (type) => {
    const { agents, consensusSeq, faultConfig, eventLog } = get();
    const seq = consensusSeq + 1;
    const activeAgents = agents.filter((a) => a.status === "active");
    const n = activeAgents.length;
    const f = agents.filter((a) => a.isByzantine).length;
    const quorum = Math.floor((2 * n) / 3) + 1;
    const baseDelay = 200 + faultConfig.latencyMs;

    set({
      consensusSeq: seq,
      eventLog: [
        ...eventLog,
        {
          timestamp: Date.now(),
          type: "consensus_start" as const,
          description: `BFT ${type} #${seq} (view-change enabled) n=${n} f=${f} q=${quorum}`,
        },
      ],
    });

    const runView = (viewIdx: number) => {
      const { agents: ag, faultConfig: fc } = get();
      const act = ag.filter((a) => a.status === "active");
      const nAct = act.length;
      if (nAct === 0) return;
      const q = Math.floor((2 * nAct) / 3) + 1;
      const proposer = act[viewIdx % nAct];
      const proposedValue =
        type === "explorer_election"
          ? (act.find((a) => a.role === "explorer") ?? proposer).id
          : proposer.id;

      const instance: ConsensusInstance = {
        id: `consensus-${seq}-v${viewIdx}`,
        seq,
        view: viewIdx,
        primaryId: proposer.id,
        type,
        proposedValue,
        proposedBy: proposer.id,
        phase: "pre_prepare",
        prepareVotes: [],
        commitVotes: [],
        startTime: Date.now(),
        endTime: null,
        latencyMs: null,
        result: "pending",
        byzantineVotes: 0,
      };

      setTimeout(() => {
        const prepareVotes: string[] = [];
        let byzantineVotes = 0;
        if (!proposer.isByzantine) prepareVotes.push(proposer.id);

        for (const a of act) {
          if (a.id === proposer.id) continue;
          if (proposer.isByzantine) continue;
          const dropped = Math.random() * 100 < fc.packetLoss;
          if (dropped) continue;
          if (a.isByzantine && fc.faultType === "corrupt") {
            byzantineVotes++;
            continue;
          }
          if (a.isByzantine && fc.faultType === "drop") continue;
          prepareVotes.push(a.id);
        }
        instance.prepareVotes = prepareVotes;
        instance.byzantineVotes = byzantineVotes;
        instance.phase = prepareVotes.length >= q ? "prepare" : "pre_prepare";

        setTimeout(() => {
          if (instance.phase !== "prepare") {
            instance.phase = "failed";
            instance.result = "failure";
            instance.endTime = Date.now();
            instance.latencyMs = instance.endTime - instance.startTime;
            const exhausted = viewIdx + 1 >= nAct;
            const m = get().consensusMetrics;
            set({
              consensusInstances: [...get().consensusInstances, instance],
              ...(exhausted
                ? {
                    consensusMetrics: {
                      ...m,
                      totalAttempts: m.totalAttempts + 1,
                      failures: m.failures + 1,
                      byzantineFaultsDetected: m.byzantineFaultsDetected + byzantineVotes,
                      successRateHistory: [
                        ...m.successRateHistory,
                        ((m.successes / (m.totalAttempts + 1)) * 100),
                      ],
                    },
                  }
                : {}),
              eventLog: [
                ...get().eventLog,
                {
                  timestamp: Date.now(),
                  type: "consensus_fail" as const,
                  description: `BFT #${seq} view ${viewIdx} (${proposer.name} primary) prepare failed — ${prepareVotes.length}/${q} (${byzantineVotes} byzantine)`,
                },
              ],
            });
            if (!exhausted) setTimeout(() => runView(viewIdx + 1), baseDelay * 0.35);
            return;
          }

          const commitVotes: string[] = [];
          for (const a of act) {
            if (!prepareVotes.includes(a.id)) continue;
            if (a.isByzantine) continue;
            const dropped = Math.random() * 100 < fc.packetLoss * 0.5;
            if (dropped) continue;
            commitVotes.push(a.id);
          }
          instance.commitVotes = commitVotes;

          setTimeout(() => {
            const success = commitVotes.length >= q;
            instance.phase = success ? "decided" : "failed";
            instance.result = success ? "success" : "failure";
            instance.endTime = Date.now();
            instance.latencyMs = instance.endTime - instance.startTime;

            const m = get().consensusMetrics;
            const newLatencies = success ? [...m.latencyHistory, instance.latencyMs!] : m.latencyHistory;
            const avgLat = newLatencies.length > 0 ? newLatencies.reduce((a, b) => a + b, 0) / newLatencies.length : 0;
            const exhausted = !success && viewIdx + 1 >= nAct;
            const newTotal = success || exhausted ? m.totalAttempts + 1 : m.totalAttempts;
            const newSuccesses = success ? m.successes + 1 : m.successes;
            const newFailures = exhausted ? m.failures + 1 : m.failures;

            const nextOrd = success ? get().consensusOrderedSeq + 1 : get().consensusOrderedSeq;
            if (success) instance.orderedSeq = nextOrd;

            set({
              consensusInstances: [...get().consensusInstances, instance],
              ...(success ? { consensusOrderedSeq: nextOrd } : {}),
              ...((success || exhausted)
                ? {
                    consensusMetrics: {
                      totalAttempts: newTotal,
                      successes: newSuccesses,
                      failures: newFailures,
                      avgLatencyMs: avgLat,
                      latencyHistory: newLatencies,
                      successRateHistory: [
                        ...m.successRateHistory,
                        newTotal > 0 ? (newSuccesses / newTotal) * 100 : 0,
                      ],
                      byzantineFaultsDetected: m.byzantineFaultsDetected + byzantineVotes,
                    },
                  }
                : {}),
              eventLog: [
                ...get().eventLog,
                {
                  timestamp: Date.now(),
                  type: success ? ("consensus_success" as const) : ("consensus_fail" as const),
                  description: success
                    ? `BFT #${seq} view ${viewIdx} DECIDED order=${nextOrd} — ${commitVotes.length} commits in ${instance.latencyMs}ms`
                    : `BFT #${seq} view ${viewIdx} commit failed — ${commitVotes.length}/${q}`,
                },
              ],
            });

            if (!success && !exhausted) setTimeout(() => runView(viewIdx + 1), baseDelay * 0.35);
          }, baseDelay * 0.6);
        }, baseDelay * 0.8);
      }, baseDelay);
    };

    runView(0);
  },

  resetSimulation: () => {
    setNetworkFaultPacketLoss(0);
    foxmqClient?.clearAll();
    teardownFoxmq();
    set({
      agents: applyHealthToAgents(
        Array.from({ length: 8 }, (_, i) => createMockAgent(i)),
        defaultFaultConfig(),
        Date.now(),
      ),
      grid: createGrid(), targets: [], swarmTasks: [], handoffs: [],
      blindHandoffOverlay: null,
      eventLog: [], explorationProgress: 0, exploredCellsFoxmq: [], foxmqConnected: false, foxmqNodeId: null,
      behaviorMode: "idle",
      isRunning: false, simulationTime: 0,
      consensusInstances: [], consensusMetrics: defaultMetrics(), consensusSeq: 0, consensusOrderedSeq: 0,
      faultConfig: defaultFaultConfig(),
      swarmWs: {
        connectionStatus: "disconnected",
        latencyMs: 0,
        messagesPerSec: 0,
        telemetryPeerUrls: [],
        telemetryPeersConnected: 0,
        telemetryMergeConflict: false,
      },
      realtimeTelemetryActive: false,
      edgeLatencyEvents: [],
    });
  },

  resyncWorldMapFromFoxmq: () => {
    const c = foxmqClient;
    if (!c?.connected) return;
    const cells = c.get<[number, number][]>(FOXMQ_WORLD_MAP_KEY, []);
    const keys = new Set(cells.map(([r, col]) => `${r},${col}`));
    const { grid, agents } = get();
    const merged = applyExploredKeysToGrid(grid, keys, getExplorerId(agents));
    set({
      grid: merged,
      explorationProgress: explorationProgressPercent(merged),
      exploredCellsFoxmq: cells,
    });
  },

  updateAgentPositions: () => {
    const { agents, simulationTime, speed, grid, behaviorMode, eventLog } = get();
    const t = simulationTime + 0.016 * speed;
    const newEvents: MissionEvent[] = [];
    let newGrid = grid;
    let progress = explorationProgressPercent(grid);
    let exploredCellsFoxmq = get().exploredCellsFoxmq;

    if (behaviorMode === "exploring" || behaviorMode === "combined") {
      try {
        const mgr = ensureFoxmqExploration(set, get);
        const auth = FOXMQ_AUTH_TOKEN || undefined;
        mgr.update(performance.now(), auth);

        newGrid = grid.map((row) => row.map((cell) => {
          if (!cell.searched && Math.random() < 0.002 * speed) {
            const { soloMode, localNodeId } = useP2PStore.getState();
            const explorer = agents.find((a) => {
              if (a.status !== "active") return false;
              const soloExplorer = soloMode && a.id === localNodeId;
              return soloExplorer || a.role === "explorer" || a.currentBehavior === "exploring";
            });
            if (explorer) {
              mgr.markExplored(cell.row, cell.col, explorer.id);
              newEvents.push({ timestamp: Date.now(), type: "cell_searched" as const, description: `Cell (${cell.row},${cell.col}) searched → FoxMQ queue`, agentId: explorer.id });
              return { ...cell, searched: true, searchedBy: explorer.id, timestamp: Date.now() };
            }
          }
          return cell;
        }));

        const ex = mgr.getExploredKeys();
        const { soloMode: sm, localNodeId: lid } = useP2PStore.getState();
        const explorerId =
          sm && agents.some((a) => a.id === lid)
            ? lid
            : getExplorerId(agents);
        newGrid = applyExploredKeysToGrid(newGrid, new Set(ex) as Set<string>, explorerId);
        progress = explorationProgressPercent(newGrid);
        exploredCellsFoxmq = [...ex].map((k) => {
          const [r, c] = k.split(",").map(Number);
          return [r, c] as [number, number];
        });
      } catch (e) {
        if (import.meta.env.DEV) console.error("[SwarmStore] exploration / FoxMQ tick failed", e);
      }
    }

    const faultConfig = get().faultConfig;
    const moved = agents.map((agent, i) => {
        if (agent.currentBehavior === "rescuing" && agent.targetId) {
          const { targets } = get();
          const target = targets.find((tg) => tg.id === agent.targetId);
          if (target) {
            const dx = target.location.x - agent.position.x;
            const dz = target.location.z - agent.position.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < 0.5) {
              return { ...agent, currentBehavior: "idle" as const, targetId: null, tasksCompleted: agent.tasksCompleted + 1 };
            }
            const ms = 0.05 * speed;
            const position = {
              x: agent.position.x + (dx / d) * ms,
              y: agent.position.y + Math.cos(t * 0.3 + i * 2.1) * 0.005,
              z: agent.position.z + (dz / d) * ms,
            };
            return {
              ...agent,
              position,
              trajectory: appendTrajectory(agent, position),
              battery: Math.max(5, agent.battery - 0.002 * speed),
              latency: Math.max(5, 10 + Math.sin(t + i) * 15 + Math.random() * 5),
            };
          }
        }
        const { soloMode, localNodeId } = useP2PStore.getState();
        const forward = soloMode && agent.id === localNodeId;
        const fx = forward ? 0.06 * speed : Math.sin(t * 0.5 + i * 1.7) * 0.02;
        const fz = forward ? 0.04 * speed : Math.cos(t * 0.4 + i * 0.9) * 0.02;
        const position = {
          x: agent.position.x + fx,
          y: agent.position.y + Math.cos(t * 0.3 + i * 2.1) * 0.01,
          z: agent.position.z + fz,
        };
        return {
          ...agent,
          position,
          trajectory: appendTrajectory(agent, position),
          battery: Math.max(5, agent.battery - 0.001 * speed),
          latency: Math.max(5, 10 + Math.sin(t + i) * 15 + Math.random() * 5),
        };
      });
    set({
      simulationTime: t, grid: newGrid, explorationProgress: progress, exploredCellsFoxmq,
      eventLog: newEvents.length > 0 ? [...eventLog, ...newEvents] : eventLog,
      agents: applyHealthToAgents(moved, faultConfig, Date.now()),
    });
  },
}));
