export type SettlementActionResult =
  | { ok: true; mockTxHash?: string }
  | { ok: false; error: string };
