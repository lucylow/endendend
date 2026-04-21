import type { FlatMissionEnvelope, RuntimeEventEntry, TaskViewModel } from "./types";

export function selectIsConnected(health: { httpReachable: boolean; wsConnected: boolean; pollActive: boolean }): boolean {
  return health.httpReachable && (health.wsConnected || health.pollActive);
}

export function selectIsDemoMode(transport: string, source: FlatMissionEnvelope["source"]): boolean {
  return transport === "fallback_mock" || source === "mock" || source === "fallback";
}

export function selectCoveragePct(flat: FlatMissionEnvelope): number {
  return flat.mapSummary.coveragePercent;
}

export function selectActiveNodeCount(flat: FlatMissionEnvelope): number {
  return flat.nodes.filter((n) => n.health === "online" || n.health === "syncing").length;
}

export function selectStaleNodeCount(flat: FlatMissionEnvelope): number {
  return flat.nodes.filter((n) => n.health === "stale").length;
}

export function selectPendingTaskCount(tasks: TaskViewModel[]): number {
  return tasks.filter((t) => t.status === "pending" || t.status === "bidding").length;
}

export function selectRewardBalance(rewards: { amount: string }[]): number {
  return rewards.reduce((s, r) => s + (Number.parseFloat(r.amount) || 0), 0);
}

export function selectMissionPhaseLabel(flat: FlatMissionEnvelope): string {
  return flat.phase.replace(/_/g, " ");
}

export function selectBackendHealthLabel(httpReachable: boolean, lastError: string | null): string {
  if (lastError) return `degraded: ${lastError}`;
  return httpReachable ? "reachable" : "unavailable";
}

export function selectMapSyncLabel(flat: FlatMissionEnvelope): string {
  return `${flat.mapSummary.exploredCells} cells · ${flat.mapSummary.coveragePercent.toFixed(0)}%`;
}

export function selectWalletStatusLabel(status: string, mock: boolean): string {
  if (mock) return "demo wallet";
  return status;
}

export function selectIsSettlementReady(
  flat: FlatMissionEnvelope,
  preview: { ready: boolean } | null,
): boolean {
  if (preview?.ready) return true;
  return flat.settlement?.ready === true;
}

export function recentEvents(events: RuntimeEventEntry[], max = 50): RuntimeEventEntry[] {
  return events.slice(-max);
}
