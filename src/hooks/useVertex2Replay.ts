import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

export function useVertex2Replay() {
  const mesh = useVertexSwarmStore((s) => s.view?.meshV2 ?? null);
  return {
    ledgerTail: mesh?.ledgerTail ?? [],
    replay: mesh?.replay ?? [],
    missionLedgerTail: useVertexSwarmStore((s) => s.view?.ledgerTail ?? []),
  };
}
