export type MissionScenarioKind =
  | "collapsed_building"
  | "tunnel"
  | "wildfire"
  | "extraction"
  | "flood_rescue"
  | "hazmat";

const KNOWN = new Set<string>([
  "collapsed_building",
  "tunnel",
  "wildfire",
  "extraction",
  "flood_rescue",
  "hazmat",
]);

/** Accepts ``collapsed-building`` / ``Collapsed Building`` style inputs. */
export function coerceMissionScenarioKind(raw: string | undefined | null): MissionScenarioKind | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const k = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  return KNOWN.has(k) ? (k as MissionScenarioKind) : undefined;
}
