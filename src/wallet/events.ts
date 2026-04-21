export const WALLET_CONNECTED_EVENT = "tashi:wallet-connected";
export const WALLET_DISCONNECTED_EVENT = "tashi:wallet-disconnected";
export const WALLET_PERSONA_CHANGED_EVENT = "tashi:wallet-persona-changed";

export type WalletConnectedDetail = {
  mode: "mock" | "real";
  address: string;
  isMock: boolean;
  personaId: string | null;
};

export function emitWalletConnected(detail: WalletConnectedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECTED_EVENT, { detail }));
}

export function emitWalletDisconnected(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_DISCONNECTED_EVENT));
}

export function emitWalletPersonaChanged(detail: { personaId: string; address: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_PERSONA_CHANGED_EVENT, { detail }));
}
