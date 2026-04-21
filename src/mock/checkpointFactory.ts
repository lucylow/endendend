export type CheckpointSummary = {
  label: string;
  at: number;
  ledgerSize: number;
  mapCells: number;
};

export function describeCheckpoint(label: string, ledgerSize: number, mapCells: number): CheckpointSummary {
  return { label, at: Date.now(), ledgerSize, mapCells };
}
