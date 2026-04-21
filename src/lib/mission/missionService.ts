/**
 * Thin façade for mission operations used by hooks and tests.
 * Canonical behavior lives in ``LocalMissionRuntime`` and the runtime store.
 */
export { LocalMissionRuntime } from "@/lib/runtime/localMissionRuntime";
export { bootstrapMission, missionEnvelopeView, proposeAndCommitPhaseTransition } from "@/backend/api/missions";
export { loadCheckpoint, saveCheckpoint, clearCheckpoint } from "@/lib/mission/checkpoints";
