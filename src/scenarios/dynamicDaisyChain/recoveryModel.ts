import type { EngineConfig, SimNode } from "./types";
import { emitEvent } from "./eventStream";
import type { DaisyEvent } from "./types";

export function applyRelayFailure(
  nodes: SimNode[],
  nodeId: string,
  t: number,
  events: DaisyEvent[],
): SimNode | null {
  const n = nodes.find((x) => x.id === nodeId);
  if (!n || !n.isRelay) return null;
  n.isRelay = false;
  n.relayFrozen = false;
  n.connectivity = "offline";
  n.role = "standby";
  n.localTask = "recovery";
  events.push(emitEvent(t, "relay_drop", `Relay ${nodeId} lost — buffering state`, [nodeId]));
  return n;
}

export function tryActivateBackup(
  nodes: SimNode[],
  lead: SimNode,
  cfg: EngineConfig,
  t: number,
  events: DaisyEvent[],
  rng: () => number,
): string | null {
  const backup = nodes
    .filter((n) => n.id !== lead.id && n.connectivity !== "offline" && n.profile.backupLeadSuitability > 0.75)
    .sort((a, b) => b.profile.backupLeadSuitability - a.profile.backupLeadSuitability)[0];
  if (!backup) return null;
  if (rng() > 0.55) return null;
  backup.isRelay = true;
  backup.relayFrozen = true;
  backup.role = "backup_relay";
  backup.localTask = "relay_hold";
  backup.s = Math.min(backup.s + 2, lead.s * 0.55);
  events.push(emitEvent(t, "fallback_relay", `Backup ${backup.id} activated toward entrance`, [backup.id]));
  void cfg;
  return backup.id;
}

export function recoverySyncPulse(t: number, events: DaisyEvent[], involved: string[]): void {
  events.push(emitEvent(t, "recovery_sync", "Collective map deltas merged after chain repair", involved));
}
