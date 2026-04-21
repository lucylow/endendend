import type { MeshLedgerEvent, ReplayNarrativeEntry } from "./types";

export function buildReplayNarrative(events: MeshLedgerEvent[]): ReplayNarrativeEntry[] {
  const out: ReplayNarrativeEntry[] = [];
  for (const e of events) {
    switch (e.eventType) {
      case "peer_discovered":
        out.push({
          atMs: e.timestamp,
          label: "Lattice discovery",
          detail: `Peer ${String(e.payload.peerId ?? e.actorPeerId)} seen via mesh`,
          severity: "info",
        });
        break;
      case "packet_loss_sim":
        out.push({
          atMs: e.timestamp,
          label: "Packet loss",
          detail: String(e.payload.note ?? "synthetic loss"),
          severity: "warn",
        });
        break;
      case "delay_spike":
        out.push({
          atMs: e.timestamp,
          label: "Latency spike",
          detail: `+${String(e.payload.deltaMs ?? "?")} ms effective`,
          severity: "warn",
        });
        break;
      case "partition_start":
        out.push({ atMs: e.timestamp, label: "Partition", detail: "Subgroups diverged", severity: "critical" });
        break;
      case "partition_end":
        out.push({ atMs: e.timestamp, label: "Partition healed", detail: "Mesh routes restabilized", severity: "info" });
        break;
      case "consensus_committed":
        out.push({
          atMs: e.timestamp,
          label: "Proof-of-Coordination",
          detail: `Committed ${String(e.payload.proposalId ?? "")}`,
          severity: "info",
        });
        break;
      case "recovery_sync":
        out.push({ atMs: e.timestamp, label: "Recovery sync", detail: "Buffered state reconciled", severity: "info" });
        break;
      default:
        break;
    }
  }
  return out.slice(-120);
}
