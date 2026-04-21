const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Telem = {
  swarm_id?: string;
  drone_id?: string;
  timestamp_ns?: number;
  position?: number[];
  role?: string;
  health?: number;
  battery_pct?: number;
  depth_m?: number;
  behavior?: string;
  safety_halt?: boolean;
};

const lastBySwarm = new Map<string, Map<string, Telem>>();

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function aggregate(swarmId: string) {
  const m = lastBySwarm.get(swarmId);
  if (!m?.size) {
    return {
      swarm_id: swarmId,
      active_drones: 0,
      avg_health: 0,
      max_depth_m: 0,
      avg_battery_pct: 0,
      rows: [] as Telem[],
    };
  }
  const rows = [...m.values()];
  let sumHealth = 0;
  let sumBat = 0;
  let maxDepth = 0;
  for (const r of rows) {
    sumHealth += Number(r.health ?? 0);
    sumBat += Number(r.battery_pct ?? 0);
    const z = Array.isArray(r.position) && r.position.length > 2 ? Number(r.position[2]) : Number(r.depth_m ?? 0);
    maxDepth = Math.max(maxDepth, Math.abs(z));
  }
  const n = rows.length;
  return {
    swarm_id: swarmId,
    active_drones: n,
    avg_health: n ? sumHealth / n : 0,
    avg_battery_pct: n ? sumBat / n : 0,
    max_depth_m: maxDepth,
    rows,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const swarmQ = url.searchParams.get("swarm_id")?.trim();

  if (req.method === "GET") {
    const sid = swarmQ || "track2";
    return json({ ok: true, stats: aggregate(sid), ts: Date.now() });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let row: Telem;
  try {
    row = (await req.json()) as Telem;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const swarmId = (row.swarm_id || swarmQ || "track2").trim();
  const droneId = (row.drone_id || "unknown").trim();

  let m = lastBySwarm.get(swarmId);
  if (!m) {
    m = new Map();
    lastBySwarm.set(swarmId, m);
  }
  m.set(droneId, row);

  return new Response(null, { status: 204, headers: cors });
});
