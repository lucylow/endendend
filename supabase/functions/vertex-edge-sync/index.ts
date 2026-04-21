const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type VertexBody = {
  swarm_id?: string;
  drone_id?: string;
  lamport_clock?: number;
  state?: { role?: string; targets?: unknown[]; node_id?: string };
  vertex?: Record<string, unknown>;
  position_m?: number[];
};

const bySwarm = new Map<string, Map<string, { lamport: number; body: VertexBody }>>();

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function mergeSwarm(swarmId: string) {
  const drones = bySwarm.get(swarmId);
  if (!drones?.size) {
    return {
      swarm_id: swarmId,
      lamport_max: 0,
      roles: {} as Record<string, string>,
      drones: {} as Record<string, VertexBody>,
      victim_hints: [] as unknown[],
    };
  }
  let lamport_max = 0;
  const roles: Record<string, string> = {};
  const out: Record<string, VertexBody> = {};
  const victims: unknown[] = [];
  for (const [droneId, rec] of drones) {
    lamport_max = Math.max(lamport_max, rec.lamport);
    out[droneId] = rec.body;
    const role = rec.body.state?.role;
    if (role) roles[droneId] = role;
    const targets = rec.body.state?.targets;
    if (Array.isArray(targets)) {
      for (const t of targets) victims.push(t);
    }
  }
  return {
    swarm_id: swarmId,
    lamport_max,
    roles,
    drones: out,
    victim_hints: victims.slice(0, 200),
    drone_count: drones.size,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const swarmParam = url.searchParams.get("swarm_id")?.trim();

  if (req.method === "GET") {
    const sid = swarmParam || "track2";
    return json({ ok: true, merged: mergeSwarm(sid), ts: Date.now() });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: VertexBody;
  try {
    body = (await req.json()) as VertexBody;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const swarmId = (body.swarm_id || swarmParam || "track2").trim();
  const droneId = (body.drone_id || "unknown").trim();
  const lamport = Math.max(0, Number(body.lamport_clock) || 0);

  let drones = bySwarm.get(swarmId);
  if (!drones) {
    drones = new Map();
    bySwarm.set(swarmId, drones);
  }
  const prev = drones.get(droneId);
  if (!prev || lamport >= prev.lamport) {
    drones.set(droneId, { lamport, body });
  }

  const merged = mergeSwarm(swarmId);
  return json({
    status: "synced",
    clock: merged.lamport_max,
    victims_found: merged.victim_hints.length,
    merged,
  });
});
