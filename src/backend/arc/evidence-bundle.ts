import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { merkleRootHex, sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export type EvidenceKind =
  | "thermal_hit"
  | "optical_confirmation"
  | "audio_signal"
  | "gas_detection"
  | "map_displacement"
  | "manual_note"
  | "rescue_contact"
  | "extraction_confirmation";

export type EvidenceItem = {
  sourceNode: string;
  timestamp: number;
  evidenceType: EvidenceKind;
  confidence: number;
  payload: Record<string, unknown>;
  ledgerHash: string;
  latticeValidation: {
    nodeTrust: number;
    capabilityMatch: number;
  };
};

export type EvidenceBundleRecord = {
  missionId: string;
  bundleHash: string;
  items: EvidenceItem[];
  merkleRoot: string;
};

const EVIDENCE_SENSORS: Partial<Record<EvidenceKind, string[]>> = {
  thermal_hit: ["thermal", "ir", "lwir"],
  optical_confirmation: ["rgb", "camera", "eo", "visual"],
  gas_detection: ["gas", "chemical", "sniffer"],
  extraction_confirmation: ["carrier", "winch", "lidar"],
  rescue_contact: ["radio", "audio", "lte", "long_range_radio"],
};

function classifyEvidence(eventType: string): EvidenceKind | null {
  const map: Record<string, EvidenceKind> = {
    target_discovered: "thermal_hit",
    target_confirmed: "optical_confirmation",
    safety_alert: "gas_detection",
    extraction_confirmed: "extraction_confirmation",
  };
  return map[eventType] ?? null;
}

function capabilityMatch(registry: NodeRegistry, nodeId: string, kind: EvidenceKind): number {
  const required = EVIDENCE_SENSORS[kind];
  if (!required?.length) return 0.75;
  const hints = registry.listSensorHints(nodeId);
  if (hints.length === 0) return 0.45;
  const hit = required.filter((r) => hints.some((h) => h.includes(r) || r.includes(h))).length;
  return Math.min(1, 0.35 + (hit / required.length) * 0.65);
}

function confidenceFromPayload(payload: Record<string, unknown>): number {
  const c = payload.confidence;
  if (typeof c === "number" && Number.isFinite(c)) return Math.min(1, Math.max(0, c));
  const temp = payload.thermalTemp;
  if (typeof temp === "number" && temp > 37) return 0.9;
  return 0.72;
}

export async function buildEvidenceBundle(
  missionId: string,
  ledgerEvents: MissionLedgerEvent[],
  registry: NodeRegistry,
): Promise<EvidenceBundleRecord> {
  const items: EvidenceItem[] = [];

  for (const event of ledgerEvents) {
    if (event.missionId !== missionId) continue;
    if (event.plane === "arc") continue;

    const evidenceType = classifyEvidence(event.eventType);
    if (!evidenceType) continue;

    const nodeTrust = registry.latticeTrust01(event.actorId);
    const cap = capabilityMatch(registry, event.actorId, evidenceType);

    items.push({
      sourceNode: event.actorId,
      timestamp: event.timestamp,
      evidenceType,
      confidence: confidenceFromPayload(event.payload),
      payload: event.payload,
      ledgerHash: event.eventHash,
      latticeValidation: { nodeTrust, capabilityMatch: cap },
    });
  }

  const leaves = await Promise.all(
    items.map((item) => sha256Hex(`${item.ledgerHash}|${stableStringify(item.payload)}|${item.evidenceType}`)),
  );
  const merkleRoot = await merkleRootHex(leaves);

  const body = stableStringify({ missionId, items, merkleRoot });
  const bundleHash = await sha256Hex(`evidence|${body}`);

  return {
    missionId,
    bundleHash,
    items,
    merkleRoot,
  };
}
