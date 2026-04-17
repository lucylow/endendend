/** Maps wagmi / viem errors (incl. `shortMessage`) to a single UI string. */
export function userFacingError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const sm =
      "shortMessage" in err && typeof (err as { shortMessage?: unknown }).shortMessage === "string"
        ? (err as { shortMessage: string }).shortMessage
        : "";
    return sm || err.message;
  }
  if (typeof err === "object" && err !== null && "shortMessage" in err) {
    const sm = (err as { shortMessage?: unknown }).shortMessage;
    if (typeof sm === "string" && sm.length > 0) return sm;
  }
  return "Something went wrong";
}
