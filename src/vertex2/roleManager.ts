import type { MeshPeerRuntime, Vertex2MeshRole } from "./types";
import type { NetworkStressMode } from "./types";
import type { RoleHandoffMeshRecord } from "./types";

export function evaluateRoleHandoffs(
  peers: MeshPeerRuntime[],
  stress: NetworkStressMode,
  rng: () => number,
  nowMs: number,
): RoleHandoffMeshRecord[] {
  const out: RoleHandoffMeshRecord[] = [];
  const relays = peers.filter((p) => p.meshRole === "relay" && p.health !== "offline");
  for (const p of peers) {
    if (p.health === "isolated" && p.meshRole === "coordinator") {
      const standby = peers.find((x) => x.meshRole === "standby" && x.health === "ok");
      if (standby && rng() < 0.55) {
        out.push({
          peerId: standby.peerId,
          from: standby.meshRole,
          to: "coordinator",
          reason: "coordinator_isolated",
          atMs: nowMs,
        });
      }
    }
    if ((stress === "partitioned" || stress === "offline") && p.meshRole === "explorer" && p.health === "isolated") {
      if (rng() < 0.35) {
        out.push({
          peerId: p.peerId,
          from: p.meshRole,
          to: "emergency",
          reason: "local_leadership_under_partition",
          atMs: nowMs,
        });
      }
    }
    if (p.meshRole === "relay" && p.health === "offline" && relays.length > 1) {
      const backup = peers.find((x) => x.meshRole === "standby");
      if (backup) {
        out.push({
          peerId: backup.peerId,
          from: backup.meshRole,
          to: "relay",
          reason: "relay_unavailable",
          atMs: nowMs,
        });
      }
    }
  }
  return out;
}

export function applyHandoff(peer: MeshPeerRuntime, to: Vertex2MeshRole): void {
  peer.meshRole = to;
}
