/**
 * Typed runtime models for frontend integration. All payloads attach a ``source`` tag
 * so the UI can label live vs mock vs restored data.
 */

import type { TashiStateEnvelope as BackendEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import type { MeshSummaryViewModel, TelemetryPacket } from "@/mock/types";

export type DataSource = "live" | "live_http" | "local_engine" | "mock" | "restored" | "fallback" | "stale";

export type TransportMode = "live_http" | "local_engine" | "fallback_mock" | "hybrid";

/** Flat SAR envelope used by scenario shell components (stable UI contract). */
/** Rich mock / hybrid simulation layer attached to the flat envelope. */
export type SimulationAugmentation = {
  mesh: MeshSummaryViewModel;
  telemetryByNode: Record<string, TelemetryPacket>;
  /** Extra explored cells from the map simulator (added to ledger-derived counts in UI). */
  mapExploredBoost: number;
  source: DataSource;
};

export type FlatMissionEnvelope = {
  missionId: string;
  scenario: string;
  phase: string;
  mapSummary: {
    exploredCells: number;
    coveragePercent: number;
    targets: { id: string; confidence: number; status: string }[];
  };
  nodes: {
    nodeId: string;
    role: string;
    trust: number;
    battery: number;
    health: "online" | "syncing" | "degraded" | "stale";
    activeTasks: number;
  }[];
  alerts: { type: string; severity: "warning" | "critical"; nodeId: string; message: string }[];
  recovery: {
    state: "syncing" | "replaying" | "revalidating" | "recovered" | "degraded" | "stale" | "isolated";
    checkpointLag: number;
    mapLagPct: number;
  };
  settlement?: { ready: boolean; manifestHash: string };
  /** Normalized backend envelope when available (full Vertex/Lattice/Arc view). */
  backend?: BackendEnvelope;
  source: DataSource;
  capturedAtMs?: number;
  simulation?: SimulationAugmentation;
};

export type TaskViewModel = {
  id: string;
  type: string;
  assignee?: string;
  status: "pending" | "assigned" | "bidding" | "complete";
  scoreHint?: string;
  source: DataSource;
};

export type MapCellViewModel = {
  row: number;
  col: number;
  state: "unknown" | "explored" | "frontier" | "blocked" | "target";
  dirty: boolean;
};

export type MapViewModel = {
  grid: MapCellViewModel[];
  rows: number;
  cols: number;
  syncLabel: string;
  source: DataSource;
};

export type RewardLineViewModel = {
  id: string;
  nodeId: string;
  kind: string;
  amount: string;
  source: DataSource;
};

export type SettlementPreviewViewModel = {
  ready: boolean;
  manifestHash: string;
  settlementAmount?: string;
  chainRef?: string;
  operatorAddress?: string;
  mockLabeled: boolean;
  source: DataSource;
};

export type WalletSessionViewModel = {
  status: "disconnected" | "connecting" | "connected" | "demo";
  address: string | null;
  chainId: number | null;
  label: string;
  source: DataSource;
};

export type RuntimeEventEntry = {
  id: string;
  ts: number;
  kind: string;
  message: string;
  source: DataSource;
  payload?: Record<string, unknown>;
};

export type ConnectionHealth = {
  httpReachable: boolean;
  wsConnected: boolean;
  pollActive: boolean;
  lastSyncAtMs: number | null;
  lastError: string | null;
  reconnectAttempt: number;
};

export type RuntimeBootstrapOptions = {
  scenario: ScenarioKey;
  preferHttp?: boolean;
  demoWallet?: boolean;
};
