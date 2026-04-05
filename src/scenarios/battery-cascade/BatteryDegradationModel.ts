import type { Agent } from "@/types";

/** Role-based drain with mild depth penalty (deeper = slightly higher load). */
export class BatteryDegradationModel {
  getDrainRate(role: Agent["role"], depthZ: number): number {
    const depthFactor = 1 + Math.min(0.35, Math.abs(depthZ) / 400);
    switch (role) {
      case "explorer":
        return 0.022 * depthFactor;
      case "relay":
        return 0.014 * depthFactor;
      case "standby":
        return 0.0045 * depthFactor;
      default:
        return 0.01;
    }
  }
}
