/** Visual / ops status for a single robot */
export type HealthStatus = "healthy" | "warning" | "degraded" | "critical" | "offline";

export interface RobotVitals {
  batteryLevel: number;
  signalStrength: number;
  coordinationLatency: number;
  collisionRisk: number;
  temperature: number;
  uptime: number;
  healthScore: number;
}

export interface RobotHealth {
  status: HealthStatus;
  vitals: RobotVitals;
  issues: string[];
  recommendations: string[];
}

export interface HealthHistoryPoint {
  t: number;
  score: number;
  status: HealthStatus;
}

export type HealthAlertType = "battery" | "signal" | "collision" | "consensus";

export interface HealthAlert {
  id: string;
  type: HealthAlertType;
  agentId: string;
  severity: "warning" | "critical";
  message: string;
  timestamp: number;
}

const HISTORY_MAX = 288;

export function appendHealthHistory(
  prev: HealthHistoryPoint[] | undefined,
  point: HealthHistoryPoint,
  windowMs: number,
): HealthHistoryPoint[] {
  const now = point.t;
  const base = (prev ?? []).filter((p) => now - p.t <= windowMs);
  const next = [...base, point];
  return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
}
