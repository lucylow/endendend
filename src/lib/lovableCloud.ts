/**
 * Judge / dashboard helpers for edge endpoints deployed next to the Lovable app
 * (e.g. Supabase Edge Functions). Set `VITE_LOVABLE_EDGE_BASE_URL` at build time.
 */

const base = (): string | undefined => {
  const v = import.meta.env.VITE_LOVABLE_EDGE_BASE_URL as string | undefined;
  return v?.replace(/\/$/, "");
};

const authHeaders = (): Record<string, string> => {
  const token = import.meta.env.VITE_LOVABLE_EDGE_ANON_KEY as string | undefined;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

export type MergedSwarmVertex = {
  swarm_id: string;
  lamport_max: number;
  roles: Record<string, string>;
  drone_count: number;
  victim_hints: unknown[];
};

export type SwarmTelemetryStats = {
  swarm_id: string;
  active_drones: number;
  avg_health: number;
  avg_battery_pct: number;
  max_depth_m: number;
};

export async function fetchVertexMerge(swarmId: string): Promise<{ ok: boolean; merged: MergedSwarmVertex }> {
  const b = base();
  if (!b) throw new Error("VITE_LOVABLE_EDGE_BASE_URL is not set");
  const url = `${b}/vertex-edge-sync?swarm_id=${encodeURIComponent(swarmId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", ...authHeaders() } });
  if (!res.ok) throw new Error(`vertex-edge-sync ${res.status}`);
  return res.json() as Promise<{ ok: boolean; merged: MergedSwarmVertex }>;
}

export async function fetchTelemetryStats(swarmId: string): Promise<{ ok: boolean; stats: SwarmTelemetryStats }> {
  const b = base();
  if (!b) throw new Error("VITE_LOVABLE_EDGE_BASE_URL is not set");
  const url = `${b}/swarm-telemetry?swarm_id=${encodeURIComponent(swarmId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", ...authHeaders() } });
  if (!res.ok) throw new Error(`swarm-telemetry ${res.status}`);
  return res.json() as Promise<{ ok: boolean; stats: SwarmTelemetryStats }>;
}

export function isLovableEdgeConfigured(): boolean {
  return Boolean(base());
}
