import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type Track2Scenario = "fallen" | "handoff" | "daisy" | "none";

export type RoverTelemetry = {
  speed_mps?: number;
  heartbeat_age_s?: number;
  explored_unique_cells?: number;
  task?: string;
  assigned_victims?: string[];
};

export interface RoverState {
  id: string;
  position: [number, number, number];
  state: "exploring" | "dead" | "reallocating";
  battery: number;
  sector: { bounds: [number, number, number, number] };
  telemetry?: RoverTelemetry;
}

export interface AuctionBidRow {
  score: number;
  distance: number;
  battery?: number;
  capacity?: string;
}

export interface AuctionState {
  active: boolean;
  bids: Record<string, AuctionBidRow>;
  winner: string | null;
  task?: { coords: [number, number, number] };
}

export interface SwarmStreamState {
  rovers: RoverState[];
  globalMap: number[][];
  reallocated: boolean;
  time: number;
  aerial: {
    position: [number, number, number];
    battery: number;
    mode?: string;
    victim_detected?: { coords: [number, number, number] };
  } | null;
  groundRovers: RoverState[];
  auction: AuctionState;
  rescues_completed: number;
  tunnelDepth: number;
  relayChain: string[];
  signalQuality: Record<string, number>;
  scenario: Track2Scenario;
  wsConnected: boolean;
  isPlaying: boolean;
  speed: 1 | 2 | 4;
  lastError: string | null;
  fallenVictims: unknown[];
  fallenObstacles: unknown[];
  fallenEvents: unknown[];
  fallenScenarioMeta: Record<string, unknown> | null;
  /** Blind handoff: seconds since current cycle start (mock/Webots snapshot). */
  cycleT: number;
  /** Blind handoff judge timeline keyframes (seconds), when present. */
  timeline: Record<string, number> | null;
}

type WebotsJson = {
  rovers?: RoverState[];
  global_map?: number[][];
  reallocated?: boolean;
  /** Simulation clock (seconds) from mock or Webots bridge. */
  time?: number;
  cycle_t?: number;
  timeline?: Record<string, number>;
  aerial?: SwarmStreamState["aerial"];
  ground_rovers?: RoverState[];
  auction?: Partial<AuctionState> | AuctionState;
  rescues_completed?: number;
  tunnel_depth?: number;
  relay_chain?: string[];
  signal_quality?: Record<string, number>;
  victims?: unknown[];
  obstacles?: unknown[];
  events?: unknown[];
  scenario_meta?: Record<string, unknown>;
};

const defaultAuction: AuctionState = {
  active: false,
  bids: {},
  winner: null,
};

export const defaultAerialView: NonNullable<SwarmStreamState["aerial"]> = {
  position: [0, 12, 20],
  battery: 100,
};

function normalizeRover(r: RoverState, index: number): RoverState {
  if (!r || typeof r !== "object") {
    return {
      id: `rover-${index}`,
      position: [0, 0, 0],
      battery: 100,
      state: "exploring",
      sector: { bounds: [-10, 10, -10, 10] },
    };
  }
  const b = r.sector?.bounds;
  const bounds: [number, number, number, number] =
    Array.isArray(b) && b.length === 4 && b.every((n) => Number.isFinite(Number(n)))
      ? [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])]
      : [-10, 10, -10, 10];
  const pos = Array.isArray(r.position) && r.position.length >= 3;
  const position: [number, number, number] = pos
    ? [Number(r.position[0]) || 0, Number(r.position[1]) || 0, Number(r.position[2]) || 0]
    : [0, 0, 0];
  const rawTel = (r as { telemetry?: unknown }).telemetry;
  let telemetry: RoverTelemetry | undefined;
  if (rawTel && typeof rawTel === "object" && !Array.isArray(rawTel)) {
    const t = rawTel as Record<string, unknown>;
    telemetry = {
      speed_mps: typeof t.speed_mps === "number" && Number.isFinite(t.speed_mps) ? t.speed_mps : undefined,
      heartbeat_age_s:
        typeof t.heartbeat_age_s === "number" && Number.isFinite(t.heartbeat_age_s) ? t.heartbeat_age_s : undefined,
      explored_unique_cells:
        typeof t.explored_unique_cells === "number" && Number.isFinite(t.explored_unique_cells)
          ? t.explored_unique_cells
          : undefined,
      task: typeof t.task === "string" ? t.task : undefined,
      assigned_victims: Array.isArray(t.assigned_victims)
        ? (t.assigned_victims as unknown[]).filter((x): x is string => typeof x === "string")
        : undefined,
    };
  }

  return {
    ...r,
    id: typeof r.id === "string" && r.id.length ? r.id : `rover-${index}`,
    position,
    battery: typeof r.battery === "number" && Number.isFinite(r.battery) ? r.battery : 100,
    state: r.state === "dead" || r.state === "reallocating" || r.state === "exploring" ? r.state : "exploring",
    sector: { bounds },
    telemetry,
  };
}

function inferScenario(next: Partial<SwarmStreamState>, prev: SwarmStreamState): Track2Scenario {
  if (next.relayChain && next.relayChain.length > 0) return "daisy";
  if (next.aerial != null) return "handoff";
  if (next.rovers && next.rovers.length >= 4) return "fallen";
  if (next.rovers && next.rovers.length > 0) return "fallen";
  return prev.scenario === "none" ? "none" : prev.scenario;
}

function sanitizeBids(raw: AuctionState["bids"] | undefined): AuctionState["bids"] {
  if (!raw || typeof raw !== "object") return {};
  const out: AuctionState["bids"] = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    const score = typeof v.score === "number" && Number.isFinite(v.score) ? v.score : 0;
    const distance = typeof v.distance === "number" && Number.isFinite(v.distance) ? v.distance : 0;
    const battery = typeof v.battery === "number" && Number.isFinite(v.battery) ? v.battery : undefined;
    const capacity = typeof v.capacity === "string" && v.capacity.length ? v.capacity : undefined;
    const row: AuctionBidRow = { score, distance };
    if (battery !== undefined) row.battery = battery;
    if (capacity !== undefined) row.capacity = capacity;
    out[k] = row;
  }
  return out;
}

function mergeAuction(prev: AuctionState, incoming?: Partial<AuctionState> | AuctionState): AuctionState {
  if (!incoming) return prev;
  const winner =
    "winner" in incoming
      ? typeof incoming.winner === "string" || incoming.winner === null
        ? incoming.winner
        : prev.winner
      : prev.winner;
  return {
    active: Boolean(incoming.active ?? prev.active),
    bids: incoming.bids !== undefined ? sanitizeBids(incoming.bids) : prev.bids,
    winner,
    task: incoming.task ?? prev.task,
  };
}

let socket: WebSocket | null = null;

async function websocketPayloadToString(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView;
    return new TextDecoder().decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  }
  throw new Error(`Unsupported WebSocket payload (${Object.prototype.toString.call(data)})`);
}

function sendSim(playing: boolean, speed: 1 | 2 | 4) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type: "sim_control", playing, speed }));
  } catch {
    /* ignore */
  }
}

type SwarmActions = {
  connectWebots: (port?: number, host?: string) => void;
  disconnectWebots: () => void;
  setScenario: (scenario: Track2Scenario) => void;
  togglePlay: () => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  sendSimControl: () => void;
  /** Merge Track2 fields from the Dynamic Daisy Chain mock engine (no WebSocket required). */
  ingestMockFrame: (j: Partial<WebotsJson>) => void;
};

export type SwarmStore = SwarmStreamState & SwarmActions;

const initial: SwarmStreamState = {
  rovers: [],
  globalMap: [],
  reallocated: false,
  time: 0,
  aerial: null,
  groundRovers: [],
  auction: { ...defaultAuction },
  rescues_completed: 0,
  tunnelDepth: 0,
  relayChain: [],
  signalQuality: {},
  scenario: "none",
  wsConnected: false,
  isPlaying: true,
  speed: 1,
  lastError: null,
  fallenVictims: [],
  fallenObstacles: [],
  fallenEvents: [],
  fallenScenarioMeta: null,
  cycleT: 0,
  timeline: null,
};

/** Webots ↔ Track 2 UI bridge (browser WebSocket). */
export const useSwarmStore = create<SwarmStore>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    disconnectWebots: () => {
      socket?.close();
      socket = null;
      set({ wsConnected: false, lastError: null });
    },

    connectWebots: (port = 8765, host = "127.0.0.1") => {
      get().disconnectWebots();
      try {
        const ws = new WebSocket(`ws://${host}:${port}`);
        socket = ws;

        ws.onopen = () => {
          set({ wsConnected: true, lastError: null });
        };

        ws.onmessage = (ev) => {
          void (async () => {
            try {
              const raw = await websocketPayloadToString(ev.data);
              const j = JSON.parse(raw) as WebotsJson;
              const prev = get();

              const rovers = (j.rovers ?? prev.rovers).map((r, i) => normalizeRover(r, i));
              const groundRovers = (j.ground_rovers ?? prev.groundRovers).map((r, i) =>
                normalizeRover(r, i),
              );
              const globalMap = j.global_map ?? prev.globalMap;
              const aerial = j.aerial !== undefined ? j.aerial : prev.aerial;
              const relayChain = j.relay_chain ?? prev.relayChain;
              const signalQuality = j.signal_quality ?? prev.signalQuality;

              const fallenVictims = Array.isArray(j.victims) ? j.victims : prev.fallenVictims;
              const fallenObstacles = Array.isArray(j.obstacles) ? j.obstacles : prev.fallenObstacles;
              const fallenEvents = Array.isArray(j.events) ? j.events : prev.fallenEvents;
              const fallenScenarioMeta =
                j.scenario_meta && typeof j.scenario_meta === "object" && !Array.isArray(j.scenario_meta)
                  ? j.scenario_meta
                  : prev.fallenScenarioMeta;

              const partial: Partial<SwarmStreamState> = {
                rovers,
                globalMap,
                reallocated: j.reallocated ?? prev.reallocated,
                time: typeof j.time === "number" ? j.time : prev.time,
                cycleT: typeof j.cycle_t === "number" ? j.cycle_t : prev.cycleT,
                timeline: j.timeline && typeof j.timeline === "object" ? j.timeline : prev.timeline,
                aerial,
                groundRovers,
                auction: mergeAuction(prev.auction, j.auction),
                rescues_completed: j.rescues_completed ?? prev.rescues_completed,
                tunnelDepth: typeof j.tunnel_depth === "number" ? j.tunnel_depth : prev.tunnelDepth,
                relayChain,
                signalQuality,
                fallenVictims,
                fallenObstacles,
                fallenEvents,
                fallenScenarioMeta,
              };

              const scenario = inferScenario(
                {
                  ...prev,
                  ...partial,
                },
                prev,
              );

              set({
                ...partial,
                scenario,
                lastError: null,
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              set({ lastError: message });
            }
          })();
        };

        ws.onerror = () => {
          set({ lastError: "WebSocket transport error (check host/port and controller)", wsConnected: false });
        };

        ws.onclose = (closeEv) => {
          if (socket === ws) socket = null;
          set(() => {
            const patch: Partial<SwarmStreamState> = { wsConnected: false };
            const normal = closeEv.wasClean && (closeEv.code === 1000 || closeEv.code === 1001);
            if (!normal) {
              const reason = closeEv.reason ? `: ${closeEv.reason}` : "";
              patch.lastError = `WebSocket closed (code ${closeEv.code})${reason}`;
            }
            return patch;
          });
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        set({ lastError: message, wsConnected: false });
      }
    },

    setScenario: (scenario) => set({ scenario }),

    togglePlay: () => {
      const playing = !get().isPlaying;
      set({ isPlaying: playing });
      const { speed } = get();
      sendSim(playing, speed);
    },

    setSpeed: (speed) => {
      set({ speed });
      const { isPlaying } = get();
      sendSim(isPlaying, speed);
    },

    sendSimControl: () => {
      const { isPlaying, speed } = get();
      sendSim(isPlaying, speed);
    },

    ingestMockFrame: (j) => {
      const prev = get();
      const rovers = (j.rovers ?? prev.rovers).map((r, i) => normalizeRover(r, i));
      const groundRovers = (j.ground_rovers ?? prev.groundRovers).map((r, i) => normalizeRover(r, i));
      const globalMap = j.global_map ?? prev.globalMap;
      const aerial = j.aerial !== undefined ? j.aerial : prev.aerial;
      const relayChain = j.relay_chain ?? prev.relayChain;
      const signalQuality = j.signal_quality ?? prev.signalQuality;

      const fallenVictims = Array.isArray(j.victims) ? j.victims : prev.fallenVictims;
      const fallenObstacles = Array.isArray(j.obstacles) ? j.obstacles : prev.fallenObstacles;
      const fallenEvents = Array.isArray(j.events) ? j.events : prev.fallenEvents;
      const fallenScenarioMeta =
        j.scenario_meta && typeof j.scenario_meta === "object" && !Array.isArray(j.scenario_meta)
          ? j.scenario_meta
          : prev.fallenScenarioMeta;

      const partial: Partial<SwarmStreamState> = {
        rovers,
        globalMap,
        reallocated: j.reallocated ?? prev.reallocated,
        time: typeof j.time === "number" ? j.time : prev.time,
        cycleT: typeof j.cycle_t === "number" ? j.cycle_t : prev.cycleT,
        timeline: j.timeline && typeof j.timeline === "object" ? j.timeline : prev.timeline,
        aerial,
        groundRovers,
        auction: mergeAuction(prev.auction, j.auction),
        rescues_completed: j.rescues_completed ?? prev.rescues_completed,
        tunnelDepth: typeof j.tunnel_depth === "number" ? j.tunnel_depth : prev.tunnelDepth,
        relayChain,
        signalQuality,
        fallenVictims,
        fallenObstacles,
        fallenEvents,
        fallenScenarioMeta,
      };

      const scenario = inferScenario({ ...prev, ...partial }, prev);

      set({
        ...partial,
        scenario,
        lastError: null,
      });
    },
  })),
);

export default useSwarmStore;
