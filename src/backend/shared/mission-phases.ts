/**
 * SAR mission lifecycle — Vertex-committed phase transitions only change ``phase`` via ledger replay.
 */

export const MISSION_PHASES = [
  "init",
  "discovery",
  "search",
  "triage",
  "rescue",
  "extraction",
  "return",
  "complete",
  "aborted",
] as const;

export type MissionPhase = (typeof MISSION_PHASES)[number];

export const TERMINAL_PHASES: ReadonlySet<MissionPhase> = new Set(["complete", "aborted"]);

const LINEAR: MissionPhase[] = [
  "init",
  "discovery",
  "search",
  "triage",
  "rescue",
  "extraction",
  "return",
  "complete",
];

const forward = new Map<MissionPhase, MissionPhase>();
for (let i = 0; i < LINEAR.length - 1; i++) forward.set(LINEAR[i], LINEAR[i + 1]);

/** Next phase in the nominal SAR pipeline (single hop). */
export function nominalNextPhase(from: MissionPhase): MissionPhase | null {
  return forward.get(from) ?? null;
}

/** Phases that may follow ``from`` when committed through Vertex (includes rollback one step for search). */
export function validVertexNextPhases(from: MissionPhase): MissionPhase[] {
  if (TERMINAL_PHASES.has(from)) return [];
  const next = nominalNextPhase(from);
  const out: MissionPhase[] = [];
  if (next) out.push(next);
  if (from === "search") out.push("discovery");
  out.push("aborted");
  return out;
}

export type PhaseGateContext = {
  peerCount: number;
  hasThermal: boolean;
  hasRelay: boolean;
  hasCarrier: boolean;
};

/**
 * Lattice-side readiness (not Vertex ordering). Vertex still commits the transition;
 * Lattice only informs whether the roster looks viable for the *target* phase.
 */
export function latticePhaseReadiness(phase: MissionPhase, ctx: PhaseGateContext): { ok: boolean; reason?: string } {
  if (phase === "init" || phase === "aborted" || phase === "complete") return { ok: true };
  if (ctx.peerCount < 1) return { ok: false, reason: "no_nodes" };
  if (phase === "discovery" || phase === "search") return { ok: ctx.peerCount >= 1 };
  if (phase === "triage") return { ok: ctx.peerCount >= 1 };
  if (phase === "rescue") return { ok: ctx.peerCount >= 1 };
  if (phase === "extraction") {
    if (!ctx.hasCarrier) return { ok: false, reason: "need_carrier" };
    return { ok: true };
  }
  if (phase === "return") return { ok: true };
  return { ok: true };
}
