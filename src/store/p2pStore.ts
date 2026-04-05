/**
 * P2P Coordination Store — discovery, relay chain, state sync, solo mode,
 * persisted swarm snapshot, meet-and-greet merge, graceful degradation,
 * reliable retries, explorer takeover, and periodic state snapshots.
 */
import { create } from "zustand";
import type {
  PeerInfo,
  GossipMessage,
  RelayChainState,
  ElectionState,
  ChainRepairAttempt,
  CoordinationEvent,
  P2PMetrics,
  PartitionInfo,
  SwarmStatePayload,
} from "@/types/p2p";
import type { ManagedState } from "./stateManager";
import { createInitialPeers, updatePeerStatuses, performGossipRound, generateHeartbeats, generateDiscoverMessages } from "./peerDiscovery";
import {
  buildRelayChain,
  attemptChainRepair,
  runElection,
  checkVolunteerRelay,
  buildSwarmStatePayload,
  mergeSwarmStatePayloads,
  applyPayloadToPeers,
  handleExplorerTakeover,
} from "./chainManager";
import { STATE_SNAPSHOT_INTERVAL_MS, DISCOVER_INTERVAL_TICKS } from "@/config/swarmRobustness";
import { processReliableOutbox, clearReliableOutbox, enqueueReliable } from "@/lib/reliableSender";
import { saveDroneNodeState, loadDroneNodeState } from "@/lib/nodePersist";
import { getNetworkFaultPacketLoss } from "./networkFaultContext";
import {
  createInitialState,
  updateLocalState,
  generateVersionVectorBroadcast,
  detectPartitions,
  saveSwarmState,
  loadSwarmState,
} from "./stateManager";

const SOLO_TIMEOUT_MS = 30_000;
const SOLO_EXIT_STABLE_TICKS = 3;
const PERSIST_EVERY_TICKS = 10;

interface P2PCoordinationState {
  peers: Record<string, PeerInfo>;
  localNodeId: string;
  messageLog: GossipMessage[];
  pendingMessages: GossipMessage[];
  relayChain: RelayChainState;
  chainRepairs: ChainRepairAttempt[];
  elections: ElectionState[];
  currentExplorerId: string | null;
  managedState: ManagedState;
  partitions: PartitionInfo[];
  metrics: P2PMetrics;
  coordinationEvents: CoordinationEvent[];
  p2pRunning: boolean;
  p2pTick: number;

  soloMode: boolean;
  lastPeerHeardAt: number;
  soloExitStableTicks: number;
  lastStateSnapshotAt: number;

  initializeP2P: (agents: { id: string; name: string; role: string; battery: number; position: { x: number; y: number; z: number } }[]) => void;
  tickP2P: () => void;
  startP2P: () => void;
  stopP2P: () => void;
  resetP2P: () => void;
  triggerElection: (candidateId: string) => void;
  triggerChainRepair: (failedNodeId: string) => void;
  injectPartition: (nodeIds: string[]) => void;
  mergePartitions: () => void;
  broadcastStateUpdate: (key: string, value: unknown) => void;
  simulateNodeFailure: (nodeId: string) => void;
  simulateNodeRecovery: (nodeId: string) => void;
  /** LEAVING + immediate chain repair (graceful dropout). */
  gracefulLeavePeer: (nodeId: string) => void;
  /** Deeper node reclaims explorer (TAKEOVER handshake). */
  requestExplorerTakeover: (requesterId: string) => void;
  /** Meet-and-greet: request full state merge with persisted / remote snapshot (demo). */
  requestStateMerge: () => void;
}

function defaultMetrics(): P2PMetrics {
  return {
    gossipMessagesSent: 0,
    gossipMessagesReceived: 0,
    heartbeatsSent: 0,
    heartbeatsReceived: 0,
    peersDiscovered: 0,
    staleTransitions: 0,
    deadTransitions: 0,
    electionsHeld: 0,
    electionsWon: 0,
    chainRepairsAttempted: 0,
    chainRepairsSucceeded: 0,
    partitionsDetected: 0,
    partitionsMerged: 0,
    stateSyncsCompleted: 0,
    volunteerRelays: 0,
    bypassAttempts: 0,
    bypassSuccesses: 0,
    messageLatencyAvg: 0,
    messageLatencyHistory: [],
    stateMergesCompleted: 0,
    reliableDeliveries: 0,
    reliableFailures: 0,
    stateSnapshotsBroadcast: 0,
    discoverBroadcasts: 0,
  };
}

function pickExplorerId(peers: Record<string, PeerInfo>): string | null {
  const ex = Object.values(peers).find((p) => p.role === "explorer" && p.status !== "dead");
  return ex?.nodeId ?? null;
}

export const useP2PStore = create<P2PCoordinationState>((set, get) => ({
  peers: {},
  localNodeId: "agent-0",
  messageLog: [],
  pendingMessages: [],
  relayChain: { chain: [], version: 0, updatedAt: Date.now(), updatedBy: "system", chainHealth: "forming" },
  chainRepairs: [],
  elections: [],
  currentExplorerId: null,
  managedState: createInitialState(),
  partitions: [],
  metrics: defaultMetrics(),
  coordinationEvents: [],
  p2pRunning: false,
  p2pTick: 0,
  soloMode: false,
  lastPeerHeardAt: Date.now(),
  soloExitStableTicks: 0,
  lastStateSnapshotAt: Date.now(),

  initializeP2P: (agents) => {
    let peers = createInitialPeers(agents);
    const restored = loadDroneNodeState();
    if (restored?.nodeId && peers[restored.nodeId] && restored.savedAt && Date.now() - restored.savedAt < 86_400_000) {
      const cur = peers[restored.nodeId];
      peers = {
        ...peers,
        [restored.nodeId]: {
          ...cur,
          depth: typeof restored.depth === "number" ? restored.depth : cur.depth,
          role: restored.role && ["explorer", "relay", "standby"].includes(restored.role) ? restored.role : cur.role,
        },
      };
    }
    const explorerId = agents.find((a) => a.role === "explorer")?.id || null;
    let relayChain = buildRelayChain(peers, explorerId, "stable");

    const disk = loadSwarmState();
    if (disk?.shadowChain?.length && disk.savedAt && Date.now() - disk.savedAt < 86_400_000) {
      relayChain = {
        ...relayChain,
        shadowChain: [...disk.shadowChain],
      };
    }

    let state = createInitialState();
    let u = updateLocalState(state, "explorer_id", explorerId, "agent-0");
    state = u.state;
    u = updateLocalState(state, "relay_chain", relayChain.chain, "agent-0");
    state = u.state;

    set({
      peers,
      localNodeId: "agent-0",
      currentExplorerId: explorerId,
      relayChain,
      managedState: state,
      soloMode: false,
      lastPeerHeardAt: Date.now(),
      soloExitStableTicks: 0,
      lastStateSnapshotAt: Date.now(),
      coordinationEvents: [
        {
          id: `ev-init-${Date.now()}`,
          timestamp: Date.now(),
          type: "peer_discovered",
          description: `P2P network initialized with ${agents.length} nodes`,
        },
      ],
      metrics: { ...defaultMetrics(), peersDiscovered: agents.length },
      partitions: [
        {
          id: "main",
          members: agents.map((a) => a.id),
          explorerId,
          explorerVersion: 0,
          detectedAt: Date.now(),
        },
      ],
    });
  },

  startP2P: () => set({ p2pRunning: true }),

  stopP2P: () => {
    const { localNodeId, relayChain, peers, coordinationEvents, messageLog, chainRepairs, metrics } = get();
    const now = Date.now();
    const me = peers[localNodeId];
    const leaving: GossipMessage = {
      id: `lv-${now}`,
      type: "LEAVING",
      source: localNodeId,
      target: "broadcast",
      payload: { node_id: localNodeId },
      timestamp: now,
      ttl: 6,
    };
    const leaveEvt: CoordinationEvent = {
      id: `ev-lv-${now}`,
      timestamp: now,
      type: "peer_leaving",
      description: `${me?.name ?? localNodeId} broadcast LEAVING (graceful shutdown)`,
      nodeId: localNodeId,
    };
    let nextChain = relayChain;
    let nextRepairs = chainRepairs;
    const nextMetrics = { ...metrics };
    const nextEvents = [...coordinationEvents, leaveEvt].slice(-220);
    if (relayChain.chain.includes(localNodeId)) {
      const result = attemptChainRepair(relayChain, localNodeId, peers);
      nextEvents.push(...result.events);
      if (result.newChain) nextChain = result.newChain;
      nextRepairs = [...chainRepairs, result.repair].slice(-20);
      nextMetrics.chainRepairsAttempted += 1;
      if (result.repair.status === "success") nextMetrics.chainRepairsSucceeded += 1;
    }
    saveDroneNodeState({
      nodeId: localNodeId,
      role: me?.role ?? "standby",
      depth: me?.depth ?? 0,
      chainHint: [...relayChain.chain],
      peerIds: Object.keys(peers),
      savedAt: now,
    });
    set({
      p2pRunning: false,
      relayChain: nextChain,
      chainRepairs: nextRepairs,
      coordinationEvents: nextEvents,
      metrics: nextMetrics,
      messageLog: [...messageLog, leaving].slice(-120),
    });
  },

  resetP2P: () => {
    clearReliableOutbox();
    set({
      peers: {},
      messageLog: [],
      pendingMessages: [],
      relayChain: { chain: [], version: 0, updatedAt: Date.now(), updatedBy: "system", chainHealth: "forming" },
      chainRepairs: [],
      elections: [],
      currentExplorerId: null,
      managedState: createInitialState(),
      partitions: [],
      metrics: defaultMetrics(),
      coordinationEvents: [],
      p2pRunning: false,
      p2pTick: 0,
      soloMode: false,
      lastPeerHeardAt: Date.now(),
      soloExitStableTicks: 0,
      lastStateSnapshotAt: Date.now(),
    });
  },

  tickP2P: () => {
    const {
      peers,
      localNodeId,
      p2pTick,
      metrics,
      coordinationEvents,
      relayChain,
      currentExplorerId,
      managedState,
      soloMode,
      lastPeerHeardAt,
      soloExitStableTicks,
      lastStateSnapshotAt,
    } = get();
    const now = Date.now();
    const tick = p2pTick + 1;
    const allEvents: CoordinationEvent[] = [];
    const updatedMetrics = { ...metrics };
    let updatedPeers = { ...peers };
    let lastHeard = lastPeerHeardAt;
    let soloStable = soloExitStableTicks;
    let solo = soloMode;
    let updatedChain = relayChain;
    let explorerId = currentExplorerId;

    const statusResult = updatePeerStatuses(updatedPeers, now, localNodeId);
    updatedPeers = statusResult.updatedPeers;
    allEvents.push(...statusResult.events);
    updatedMetrics.staleTransitions += statusResult.metrics.staleTransitions || 0;
    updatedMetrics.deadTransitions += statusResult.metrics.deadTransitions || 0;

    const hasActiveRemote = Object.entries(updatedPeers).some(
      ([id, p]) => id !== localNodeId && p.status === "active",
    );

    const newMessages: GossipMessage[] = [];

    const reliable = processReliableOutbox(now, localNodeId, {
      packetLossPercent: getNetworkFaultPacketLoss(),
    });
    newMessages.push(...reliable.messages);
    updatedMetrics.reliableDeliveries += reliable.sent.length;
    updatedMetrics.reliableFailures += reliable.failed.length;
    for (const _ of reliable.failed) {
      allEvents.push({
        id: `ev-rel-fail-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        type: "reliable_degraded",
        description: "Reliable message exhausted retries — target may be unreachable",
      });
    }

    if (!hasActiveRemote && !solo && tick % DISCOVER_INTERVAL_TICKS === 0) {
      const me = updatedPeers[localNodeId];
      newMessages.push(...generateDiscoverMessages(localNodeId, me?.depth ?? 0, me?.battery ?? 0));
      updatedMetrics.discoverBroadcasts += 1;
      allEvents.push({
        id: `ev-disc-${now}`,
        timestamp: now,
        type: "discover_sent",
        description: "DISCOVER broadcast while seeking peers",
        nodeId: localNodeId,
      });
    }

    if (tick % 3 === 0) {
      const gossipResult = performGossipRound(updatedPeers, localNodeId);
      newMessages.push(...gossipResult.messages);
      allEvents.push(...gossipResult.events);
      updatedMetrics.gossipMessagesSent += gossipResult.messages.length;
    }

    if (tick % 2 === 0) {
      const heartbeats = generateHeartbeats(updatedPeers, localNodeId);
      newMessages.push(...heartbeats);
      updatedMetrics.heartbeatsSent += heartbeats.length;

      for (const [id, peer] of Object.entries(updatedPeers)) {
        if (id !== localNodeId && peer.status !== "dead" && Math.random() > 0.1) {
          updatedPeers[id] = { ...peer, lastHeartbeat: now };
          updatedMetrics.heartbeatsReceived++;
          lastHeard = now;
        }
      }
    }

    if (hasActiveRemote) {
      lastHeard = now;
    }

    if (!solo && !hasActiveRemote && now - lastHeard > SOLO_TIMEOUT_MS) {
      solo = true;
      const me = updatedPeers[localNodeId];
      if (me) {
        updatedPeers[localNodeId] = {
          ...me,
          role: "explorer",
          explorerSince: me.explorerSince || now,
          explorerVersion: me.explorerVersion + 1,
        };
      }
      explorerId = localNodeId;
      updatedChain = buildRelayChain(updatedPeers, localNodeId, "solo", updatedChain);
      allEvents.push({
        id: `ev-solo-in-${now}`,
        timestamp: now,
        type: "solo_mode_entered",
        description: `${me?.name ?? localNodeId} entering solo mode — no reachable peers for ${SOLO_TIMEOUT_MS / 1000}s`,
        nodeId: localNodeId,
      });
    }

    if (solo && hasActiveRemote) {
      soloStable += 1;
    } else if (solo) {
      soloStable = 0;
    }

    if (solo && hasActiveRemote && soloStable >= SOLO_EXIT_STABLE_TICKS) {
      const localPayload = buildSwarmStatePayload(updatedPeers, updatedChain, explorerId);
      const disk = loadSwarmState();
      let mergedPeers = updatedPeers;

      if (disk && Array.isArray(disk.drones) && disk.drones.length > 0) {
        const remotePayload: SwarmStatePayload = {
          drones: disk.drones,
          chain: disk.chain ?? [],
          shadowChain: disk.shadowChain ?? disk.chain ?? [],
          explorerId: disk.explorerId ?? null,
          chainHealth: (disk.chainHealth as SwarmStatePayload["chainHealth"]) ?? "stable",
          savedAt: disk.savedAt ?? now,
        };
        const merged = mergeSwarmStatePayloads(localPayload, remotePayload);
        mergedPeers = applyPayloadToPeers(updatedPeers, merged);
        updatedMetrics.stateMergesCompleted += 1;
        explorerId = merged.explorerId ?? pickExplorerId(mergedPeers) ?? localNodeId;

        newMessages.push({
          id: `sr-${now}`,
          type: "STATE_REQUEST",
          source: localNodeId,
          target: "broadcast",
          payload: { reason: "post_solo_reintegration" },
          timestamp: now,
          ttl: 4,
        });
        newMessages.push({
          id: `srsp-${now}`,
          type: "STATE_RESPONSE",
          source: "peer-sim",
          target: localNodeId,
          payload: { state: remotePayload },
          timestamp: now,
          ttl: 4,
        });

        allEvents.push(
          {
            id: `ev-merge-${now}`,
            timestamp: now,
            type: "state_merge",
            description: `Merged persisted swarm state with live mesh (${merged.drones.length} drones)`,
          },
          {
            id: `ev-mg-${now}`,
            timestamp: now,
            type: "meet_greet",
            description: "Meet-and-greet: STATE_REQUEST / STATE_RESPONSE exchange (simulated)",
          },
        );
      } else {
        explorerId = pickExplorerId(mergedPeers) ?? localNodeId;
        allEvents.push({
          id: `ev-reint-${now}`,
          timestamp: now,
          type: "meet_greet",
          description: "Reintegrated after solo — no disk snapshot; using live peer roles",
        });
      }

      updatedPeers = mergedPeers;
      const cand = explorerId ?? localNodeId;
      const elect = runElection(cand, updatedPeers);
      allEvents.push(...elect.events);
      newMessages.push(...elect.messages);
      updatedMetrics.electionsHeld += 1;
      if (elect.election.status === "won") {
        updatedMetrics.electionsWon += 1;
        for (const [id, p] of Object.entries(updatedPeers)) {
          if (p.role === "explorer" && id !== cand) {
            updatedPeers[id] = { ...p, role: "standby" };
          }
        }
        if (updatedPeers[cand]) {
          updatedPeers[cand] = {
            ...updatedPeers[cand],
            role: "explorer",
            explorerVersion: elect.election.explorerVersion,
            explorerSince: updatedPeers[cand].explorerSince || now,
          };
        }
        explorerId = cand;
      }

      explorerId = pickExplorerId(updatedPeers) ?? cand;
      updatedChain = buildRelayChain(updatedPeers, explorerId, "forming", updatedChain);
      solo = false;
      soloStable = 0;
      lastHeard = now;

      allEvents.push({
        id: `ev-solo-out-${now}`,
        timestamp: now,
        type: "solo_mode_exited",
        description: "Exiting solo mode — peers stable, chain rebuilt",
        nodeId: localNodeId,
      });
    }

    const deadRelays = Object.values(updatedPeers).filter((p) => p.status === "dead" && p.role === "relay");
    for (const dead of deadRelays) {
      if (updatedChain.chain.includes(dead.nodeId)) {
        const repairResult = attemptChainRepair(updatedChain, dead.nodeId, updatedPeers);
        allEvents.push(...repairResult.events);
        newMessages.push(...repairResult.messages);
        updatedMetrics.chainRepairsAttempted++;
        if (repairResult.newChain) {
          updatedChain = repairResult.newChain;
          updatedMetrics.chainRepairsSucceeded++;
          if (repairResult.repair.strategy === "bypass") updatedMetrics.bypassSuccesses++;
        }
      }
    }

    if (tick % 10 === 0) {
      const vvMsg = generateVersionVectorBroadcast(managedState, localNodeId);
      newMessages.push(vvMsg);
      updatedMetrics.stateSyncsCompleted++;
    }

    let snapshotAt = lastStateSnapshotAt;
    if (now - lastStateSnapshotAt >= STATE_SNAPSHOT_INTERVAL_MS) {
      const snapExplorer = explorerId ?? pickExplorerId(updatedPeers);
      const snapPayload = buildSwarmStatePayload(updatedPeers, updatedChain, snapExplorer);
      const snapshotVersion = updatedChain.version + Math.floor(now / 1000);
      newMessages.push({
        id: `snap-${now}`,
        type: "STATE_SNAPSHOT",
        source: localNodeId,
        target: "broadcast",
        payload: { version: snapshotVersion, state: snapPayload },
        timestamp: now,
        ttl: 8,
      });
      updatedMetrics.stateSnapshotsBroadcast += 1;
      allEvents.push({
        id: `ev-snap-${now}`,
        timestamp: now,
        type: "state_sync",
        description: `STATE_SNAPSHOT v${snapshotVersion} (${snapPayload.drones.length} drones)`,
      });
      snapshotAt = now;
    }

    if (tick % 5 === 0) {
      const standbys = Object.values(updatedPeers).filter((p) => p.role === "standby" && p.status === "active");
      for (const standby of standbys) {
        const volResult = checkVolunteerRelay(standby, updatedChain, updatedPeers, metrics.gossipMessagesSent > 0 ? 15 : 0);
        if (volResult.shouldVolunteer && volResult.event && volResult.message) {
          allEvents.push(volResult.event);
          newMessages.push(volResult.message);
          updatedMetrics.volunteerRelays++;
          break;
        }
      }
    }

    const partitions = detectPartitions(updatedPeers);
    if (partitions.length > 1) {
      updatedMetrics.partitionsDetected = partitions.length;
    }

    if (tick % PERSIST_EVERY_TICKS === 0) {
      const snap = buildSwarmStatePayload(updatedPeers, updatedChain, explorerId ?? pickExplorerId(updatedPeers));
      saveSwarmState({ ...snap, soloMode: solo });
      const me = updatedPeers[localNodeId];
      if (me) {
        saveDroneNodeState({
          nodeId: localNodeId,
          role: me.role,
          depth: me.depth,
          chainHint: [...updatedChain.chain],
          peerIds: Object.keys(updatedPeers),
          savedAt: now,
        });
      }
    }

    const latency = 10 + Math.random() * 30;
    updatedMetrics.messageLatencyHistory = [...metrics.messageLatencyHistory, latency].slice(-50);
    updatedMetrics.messageLatencyAvg =
      updatedMetrics.messageLatencyHistory.reduce((a, b) => a + b, 0) / updatedMetrics.messageLatencyHistory.length;

    set({
      p2pTick: tick,
      peers: updatedPeers,
      relayChain: updatedChain,
      currentExplorerId: explorerId ?? pickExplorerId(updatedPeers),
      pendingMessages: newMessages,
      messageLog: [...get().messageLog, ...newMessages].slice(-120),
      metrics: updatedMetrics,
      coordinationEvents: [...coordinationEvents, ...allEvents].slice(-220),
      partitions,
      soloMode: solo,
      lastPeerHeardAt: lastHeard,
      soloExitStableTicks: soloStable,
      lastStateSnapshotAt: snapshotAt,
    });
  },

  triggerElection: (candidateId) => {
    const { peers, elections, metrics, coordinationEvents, relayChain } = get();
    const result = runElection(candidateId, peers);
    const updatedPeers = { ...peers };
    const now = Date.now();

    if (result.election.status === "won") {
      for (const [id, p] of Object.entries(updatedPeers)) {
        if (p.role === "explorer" && id !== candidateId) {
          updatedPeers[id] = { ...p, role: "standby" };
        }
      }
      updatedPeers[candidateId] = {
        ...updatedPeers[candidateId],
        role: "explorer",
        explorerVersion: result.election.explorerVersion,
        explorerSince: updatedPeers[candidateId].explorerSince || now,
      };
    }

    set({
      elections: [...elections, result.election].slice(-20),
      peers: updatedPeers,
      currentExplorerId: result.election.status === "won" ? candidateId : get().currentExplorerId,
      relayChain:
        result.election.status === "won"
          ? buildRelayChain(updatedPeers, candidateId, "stable", relayChain)
          : get().relayChain,
      metrics: {
        ...metrics,
        electionsHeld: metrics.electionsHeld + 1,
        electionsWon: metrics.electionsWon + (result.election.status === "won" ? 1 : 0),
      },
      coordinationEvents: [...coordinationEvents, ...result.events].slice(-220),
      messageLog: [...get().messageLog, ...result.messages].slice(-120),
    });
  },

  triggerChainRepair: (failedNodeId) => {
    const { relayChain, peers, chainRepairs, metrics, coordinationEvents, currentExplorerId, localNodeId } = get();
    const result = attemptChainRepair(relayChain, failedNodeId, peers);
    const now = Date.now();
    const dest = currentExplorerId && peers[currentExplorerId] ? currentExplorerId : localNodeId;
    enqueueReliable(dest, "CHAIN_UPDATE", { chain: result.newChain?.chain ?? relayChain.chain, failedNodeId }, now);
    set({
      relayChain: result.newChain || relayChain,
      chainRepairs: [...chainRepairs, result.repair].slice(-20),
      metrics: {
        ...metrics,
        chainRepairsAttempted: metrics.chainRepairsAttempted + 1,
        chainRepairsSucceeded: metrics.chainRepairsSucceeded + (result.repair.status === "success" ? 1 : 0),
      },
      coordinationEvents: [...coordinationEvents, ...result.events].slice(-220),
      messageLog: [...get().messageLog, ...result.messages].slice(-120),
    });
  },

  injectPartition: (nodeIds) => {
    const { peers, coordinationEvents } = get();
    const updatedPeers = { ...peers };
    const partitionId = `partition-${Date.now()}`;
    for (const id of nodeIds) {
      if (updatedPeers[id]) {
        updatedPeers[id] = { ...updatedPeers[id], partitionId };
      }
    }
    const names = nodeIds.map((id) => peers[id]?.name || id).join(", ");
    const evt: CoordinationEvent = {
      id: `ev-part-${Date.now()}`,
      timestamp: Date.now(),
      type: "partition_detected",
      description: `Network partition injected: ${names} isolated`,
    };
    set({
      peers: updatedPeers,
      coordinationEvents: [...coordinationEvents, evt].slice(-220),
    });
  },

  mergePartitions: () => {
    const { peers, coordinationEvents, relayChain } = get();
    const updatedPeers = { ...peers };
    const now = Date.now();
    for (const id of Object.keys(updatedPeers)) {
      updatedPeers[id] = { ...updatedPeers[id], partitionId: "main", lastHeartbeat: now, status: "active" };
    }
    const explorers = Object.values(updatedPeers).filter((p) => p.role === "explorer");
    if (explorers.length > 1) {
      const winner = explorers.reduce((a, b) =>
        b.depth > a.depth
          ? b
          : b.depth === a.depth
            ? b.explorerVersion > a.explorerVersion
              ? b
              : b.explorerVersion === a.explorerVersion && b.nodeId < a.nodeId
                ? b
                : a
            : a,
      );
      for (const e of explorers) {
        if (e.nodeId !== winner.nodeId) {
          updatedPeers[e.nodeId] = { ...updatedPeers[e.nodeId], role: "standby" };
        }
      }
    }
    const winnerId = Object.values(updatedPeers).find((p) => p.role === "explorer")?.nodeId ?? null;
    const mergeEvt: CoordinationEvent = {
      id: `ev-merge-${Date.now()}`,
      timestamp: Date.now(),
      type: "partition_merged",
      description: "All partitions merged — explorer conflict resolved (depth / version / id tie-break)",
    };
    const newChain = buildRelayChain(updatedPeers, winnerId, "stable", relayChain);
    saveSwarmState({
      ...buildSwarmStatePayload(updatedPeers, newChain, winnerId),
      soloMode: get().soloMode,
    });
    set({
      peers: updatedPeers,
      partitions: [
        {
          id: "main",
          members: Object.keys(updatedPeers),
          explorerId: winnerId,
          explorerVersion: 0,
          detectedAt: Date.now(),
        },
      ],
      relayChain: newChain,
      currentExplorerId: winnerId,
      coordinationEvents: [...coordinationEvents, mergeEvt].slice(-220),
      metrics: { ...get().metrics, partitionsMerged: get().metrics.partitionsMerged + 1 },
    });
  },

  broadcastStateUpdate: (key, value) => {
    const { managedState, localNodeId, messageLog, coordinationEvents } = get();
    const result = updateLocalState(managedState, key, value, localNodeId);
    const stateEvt: CoordinationEvent = {
      id: `ev-state-bcast-${Date.now()}`,
      timestamp: Date.now(),
      type: "state_sync",
      description: `State "${key}" broadcast (v${result.state.localVersionVector[key]})`,
    };
    set({
      managedState: result.state,
      messageLog: [...messageLog, result.message].slice(-120),
      coordinationEvents: [...coordinationEvents, stateEvt].slice(-220),
    });
  },

  simulateNodeFailure: (nodeId) => {
    const { peers, coordinationEvents } = get();
    if (!peers[nodeId]) return;
    const failEvt: CoordinationEvent = {
      id: `ev-fail-${Date.now()}`,
      timestamp: Date.now(),
      type: "peer_dead",
      description: `${peers[nodeId].name} FAILED (simulated)`,
      nodeId,
    };
    set({
      peers: { ...peers, [nodeId]: { ...peers[nodeId], status: "dead", lastHeartbeat: 0 } },
      coordinationEvents: [...coordinationEvents, failEvt].slice(-220),
    });
  },

  simulateNodeRecovery: (nodeId) => {
    const { peers, coordinationEvents } = get();
    if (!peers[nodeId]) return;
    const now = Date.now();
    const recoverEvt: CoordinationEvent = {
      id: `ev-recover-${now}`,
      timestamp: now,
      type: "peer_discovered",
      description: `${peers[nodeId].name} recovered — use Takeover if this node should reclaim explorer`,
      nodeId,
    };
    set({
      peers: { ...peers, [nodeId]: { ...peers[nodeId], status: "active", lastHeartbeat: now } },
      coordinationEvents: [...coordinationEvents, recoverEvt].slice(-220),
    });
  },

  gracefulLeavePeer: (nodeId) => {
    const { peers, relayChain, coordinationEvents, messageLog, chainRepairs, metrics, localNodeId } = get();
    if (!peers[nodeId]) return;
    const now = Date.now();
    const leaving: GossipMessage = {
      id: `lv-${nodeId}-${now}`,
      type: "LEAVING",
      source: nodeId,
      target: "broadcast",
      payload: { node_id: nodeId },
      timestamp: now,
      ttl: 6,
    };
    const leaveEvt: CoordinationEvent = {
      id: `ev-gl-${now}`,
      timestamp: now,
      type: "peer_leaving",
      description: `${peers[nodeId].name} LEAVING — fast-path chain repair`,
      nodeId,
    };
    let nextChain = relayChain;
    let nextRepairs = chainRepairs;
    const nextMetrics = { ...metrics };
    const evs = [...coordinationEvents, leaveEvt];
    if (relayChain.chain.includes(nodeId)) {
      const result = attemptChainRepair(relayChain, nodeId, peers);
      evs.push(...result.events);
      if (result.newChain) nextChain = result.newChain;
      nextRepairs = [...chainRepairs, result.repair].slice(-20);
      nextMetrics.chainRepairsAttempted += 1;
      if (result.repair.status === "success") nextMetrics.chainRepairsSucceeded += 1;
    }
    const dest = get().currentExplorerId || localNodeId;
    enqueueReliable(dest, "CHAIN_UPDATE", { chain: nextChain.chain, leaving: nodeId }, now);
    set({
      relayChain: nextChain,
      chainRepairs: nextRepairs,
      metrics: nextMetrics,
      coordinationEvents: evs.slice(-220),
      messageLog: [...messageLog, leaving].slice(-120),
    });
  },

  requestExplorerTakeover: (requesterId) => {
    const { peers, currentExplorerId, relayChain, coordinationEvents, messageLog } = get();
    const p = peers[requesterId];
    if (!p) return;
    const now = Date.now();
    enqueueReliable(currentExplorerId || requesterId, "TAKEOVER", { requester: requesterId, depth: p.depth }, now);
    const takeover = handleExplorerTakeover(peers, currentExplorerId, requesterId, p.depth);
    if (!takeover.accepted) return;
    set({
      peers: takeover.nextPeers,
      currentExplorerId: takeover.nextExplorerId,
      relayChain: buildRelayChain(takeover.nextPeers, takeover.nextExplorerId, "stable", relayChain),
      coordinationEvents: [...coordinationEvents, ...takeover.events].slice(-220),
      messageLog: [...messageLog, ...takeover.messages].slice(-120),
    });
  },

  requestStateMerge: () => {
    const { peers, relayChain, localNodeId, coordinationEvents, metrics, messageLog } = get();
    const explorerId = pickExplorerId(peers);
    const localPayload = buildSwarmStatePayload(peers, relayChain, explorerId);
    const disk = loadSwarmState();
    if (!disk?.drones?.length) {
      const evt: CoordinationEvent = {
        id: `ev-nodisk-${Date.now()}`,
        timestamp: Date.now(),
        type: "state_sync",
        description: "No persisted swarm_state on disk to merge",
      };
      set({ coordinationEvents: [...coordinationEvents, evt].slice(-220) });
      return;
    }
    const remotePayload: SwarmStatePayload = {
      drones: disk.drones,
      chain: disk.chain ?? [],
      shadowChain: disk.shadowChain ?? [],
      explorerId: disk.explorerId ?? null,
      chainHealth: (disk.chainHealth as SwarmStatePayload["chainHealth"]) ?? "stable",
      savedAt: disk.savedAt ?? Date.now(),
    };
    const merged = mergeSwarmStatePayloads(localPayload, remotePayload);
    const updatedPeers = applyPayloadToPeers(peers, merged);
    const newChain = buildRelayChain(updatedPeers, merged.explorerId ?? explorerId, "forming", relayChain);
    const now = Date.now();
    const msgs: GossipMessage[] = [
      {
        id: `sr-manual-${now}`,
        type: "STATE_REQUEST",
        source: localNodeId,
        target: "broadcast",
        payload: {},
        timestamp: now,
        ttl: 4,
      },
      {
        id: `srsp-manual-${now}`,
        type: "STATE_RESPONSE",
        source: "peer-sim",
        target: localNodeId,
        payload: { state: remotePayload },
        timestamp: now,
        ttl: 4,
      },
    ];
    set({
      peers: updatedPeers,
      relayChain: newChain,
      currentExplorerId: merged.explorerId ?? explorerId,
      metrics: { ...metrics, stateMergesCompleted: metrics.stateMergesCompleted + 1 },
      messageLog: [...messageLog, ...msgs].slice(-120),
      coordinationEvents: [
        ...coordinationEvents,
        {
          id: `ev-merge-manual-${now}`,
          timestamp: now,
          type: "state_merge" as const,
          description: "Manual STATE_REQUEST merge with persisted snapshot",
        },
      ].slice(-220),
    });
  },
}));
