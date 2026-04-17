import type { MissionPolicy } from "@/backend/shared/mission-policy";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { MissionLedger, MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export type SafetyAlertType =
  | "battery_critical"
  | "geo_fence_violation"
  | "temp_spike"
  | "link_loss"
  | "gas_detected"
  | "water_level_rising";

export type SafetySeverity = "warning" | "critical";

export type SafetyEvent = {
  nodeId: string;
  type: SafetyAlertType;
  severity: SafetySeverity;
  timestamp: number;
  payload: Record<string, unknown>;
  responseRequired: Array<"replan" | "reassign" | "evacuate" | "halt">;
};

export type SafetyTelemetry = {
  battery?: number;
  /** Preferred heartbeat field (0–1). */
  batteryReserve?: number;
  distanceFromGeofence?: number;
  gasLevel?: number;
  temperatureC?: number;
  waterLevel?: number;
  linkQuality?: number;
  position?: { lat: number; lng: number };
};

export type SafetyState = {
  activeAlerts: SafetyEvent[];
  escalatedCount: number;
  emergencyMode: boolean;
  trustImpact: Record<string, number>;
  /** Vertex proof hash after ``escalate`` append (ordering anchor). */
  committedEventHash?: string;
};

const SEVERITY_RANK: Record<SafetySeverity, number> = { critical: 2, warning: 1 };

function pickHighestSeverity(alerts: SafetyEvent[]): SafetyEvent | null {
  if (!alerts.length) return null;
  return [...alerts].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
}

function ledgerLevelToSeverity(level: unknown): SafetySeverity {
  if (level === "critical") return "critical";
  return "warning";
}

function inferAlertType(e: MissionLedgerEvent): SafetyAlertType {
  const k = String(e.payload?.kind ?? "").toLowerCase();
  const msg = String(e.payload?.message ?? "").toLowerCase();
  if (k.includes("battery") || msg.includes("battery")) return "battery_critical";
  if (k.includes("geo") || msg.includes("geofence")) return "geo_fence_violation";
  if (k.includes("gas") || msg.includes("gas")) return "gas_detected";
  if (k.includes("water") || msg.includes("water")) return "water_level_rising";
  if (k.includes("temp") || msg.includes("temp")) return "temp_spike";
  if (k.includes("link") || k.includes("comm") || msg.includes("link")) return "link_loss";
  return "link_loss";
}

function safetyEventFromLedger(e: MissionLedgerEvent): SafetyEvent | null {
  if (e.eventType !== "safety_alert") return null;
  const type = inferAlertType(e);
  const resp = e.payload?.responseRequired;
  return {
    nodeId: e.actorId,
    type,
    severity: ledgerLevelToSeverity(e.payload?.level),
    timestamp: e.timestamp,
    payload: { ...(e.payload as Record<string, unknown>) },
    responseRequired: Array.isArray(resp) ? (resp as SafetyEvent["responseRequired"]) : ["replan"],
  };
}

export class SafetyEngine {
  constructor(
    private readonly ledger: MissionLedger,
    private readonly registry: NodeRegistry,
    private readonly policy: MissionPolicy,
  ) {}

  assessTelemetry(nodeId: string, telemetry: SafetyTelemetry): SafetyEvent | null {
    const alerts: SafetyEvent[] = [];
    const t = Date.now();
    const battery = telemetry.batteryReserve ?? telemetry.battery;

    if (typeof battery === "number" && battery < this.policy.safety.batteryThreshold) {
      alerts.push({
        nodeId,
        type: "battery_critical",
        severity: "warning",
        timestamp: t,
        payload: { battery },
        responseRequired: ["replan"],
      });
    }

    if (typeof telemetry.distanceFromGeofence === "number" && telemetry.distanceFromGeofence < 5) {
      alerts.push({
        nodeId,
        type: "geo_fence_violation",
        severity: "critical",
        timestamp: t,
        payload: { distance: telemetry.distanceFromGeofence, coords: telemetry.position },
        responseRequired: ["reassign", "halt"],
      });
    }

    if (typeof telemetry.gasLevel === "number" && telemetry.gasLevel > 50) {
      alerts.push({
        nodeId,
        type: "gas_detected",
        severity: "critical",
        timestamp: t,
        payload: { gasLevel: telemetry.gasLevel },
        responseRequired: ["evacuate", "halt"],
      });
    }

    if (typeof telemetry.temperatureC === "number" && telemetry.temperatureC > 48) {
      alerts.push({
        nodeId,
        type: "temp_spike",
        severity: "warning",
        timestamp: t,
        payload: { temperatureC: telemetry.temperatureC },
        responseRequired: ["replan"],
      });
    }

    if (typeof telemetry.waterLevel === "number" && telemetry.waterLevel > 0.85) {
      alerts.push({
        nodeId,
        type: "water_level_rising",
        severity: "critical",
        timestamp: t,
        payload: { waterLevel: telemetry.waterLevel },
        responseRequired: ["evacuate", "reassign"],
      });
    }

    if (typeof telemetry.linkQuality === "number" && telemetry.linkQuality < 0.12) {
      alerts.push({
        nodeId,
        type: "link_loss",
        severity: "warning",
        timestamp: t,
        payload: { linkQuality: telemetry.linkQuality },
        responseRequired: ["replan"],
      });
    }

    return pickHighestSeverity(alerts);
  }

  async escalate(missionId: string, event: SafetyEvent, nowMs: number): Promise<SafetyState> {
    const level = event.severity === "critical" ? "critical" : "warn";
    const committed = await this.ledger.append({
      missionId,
      actorId: event.nodeId,
      eventType: "safety_alert",
      plane: "vertex",
      payload: {
        alertId: `se-${nowMs}-${event.type}`,
        level,
        message: event.type,
        kind: event.type,
        responseRequired: event.responseRequired,
        safetyPayload: event.payload,
        severity: event.severity,
      },
      timestamp: nowMs,
      previousHash: this.ledger.tailHash(),
    });

    const trustDelta = event.severity === "critical" ? -24 : -8;
    const reason = event.severity === "critical" ? "safety_critical" : "safety_warning";
    this.registry.adjustTrust(event.nodeId, trustDelta, reason);

    const response: SafetyState = {
      activeAlerts: [event],
      escalatedCount: 1,
      emergencyMode: event.severity === "critical",
      trustImpact: { [event.nodeId]: trustDelta },
      committedEventHash: committed.eventHash,
    };

    if (event.severity === "critical") {
      await this.triggerEmergencyConsensus(missionId, committed.eventHash, event);
    }

    return response;
  }

  private async triggerEmergencyConsensus(missionId: string, safetyEventHash: string, event: SafetyEvent): Promise<void> {
    const consensusPayload = {
      type: "EMERGENCY_RESPONSE",
      missionId,
      safetyEventHash,
      requiredActions: event.responseRequired,
    };
    void consensusPayload;
  }

  getSafetySummary(missionId: string): SafetyState {
    const events = this.ledger.eventsForMission(missionId).filter((e) => e.eventType === "safety_alert");
    const mapped = events.map((e) => safetyEventFromLedger(e)).filter((x): x is SafetyEvent => x !== null);
    const critical = mapped.filter((a) => a.severity === "critical");
    return {
      activeAlerts: mapped.slice(-8),
      escalatedCount: mapped.length,
      emergencyMode: critical.length > 0,
      trustImpact: {},
    };
  }
}
