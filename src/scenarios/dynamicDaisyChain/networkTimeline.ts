import type { MissionPhase } from "./types";

/** Human-readable phase transitions for debug / UI badges. */
export function phaseLabel(phase: MissionPhase): string {
  switch (phase) {
    case "preflight":
      return "Preflight";
    case "tunnel_entry":
      return "Tunnel entry";
    case "stable":
      return "Stable RF";
    case "weakening":
      return "Weakening";
    case "intermittent":
      return "Intermittent";
    case "relay_dependent":
      return "Relay-dependent";
    case "partitioned":
      return "Partitioned";
    case "recovering":
      return "Recovering";
    case "mission_complete":
      return "Mission complete";
  }
  const _exhaustive: never = phase;
  return _exhaustive;
}
